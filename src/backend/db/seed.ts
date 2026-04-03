import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'banking_poc.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);

// Create Tables
db.exec(`
  CREATE TABLE AccountTypes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    interest_rate REAL,
    min_balance REAL
  );

  CREATE TABLE Customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    address TEXT,
    dob DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE Branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_name TEXT NOT NULL,
    ifsc_code TEXT UNIQUE,
    city TEXT,
    address TEXT
  );

  CREATE TABLE Accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    account_type_id INTEGER,
    branch_id INTEGER,
    account_number TEXT UNIQUE,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customers(id),
    FOREIGN KEY (account_type_id) REFERENCES AccountTypes(id),
    FOREIGN KEY (branch_id) REFERENCES Branches(id)
  );

  CREATE TABLE Transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    transaction_type TEXT CHECK(transaction_type IN ('Credit', 'Debit')),
    amount REAL,
    description TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    counterparty_account TEXT,
    FOREIGN KEY (account_id) REFERENCES Accounts(id)
  );

  CREATE TABLE Employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    salary REAL,
    FOREIGN KEY (branch_id) REFERENCES Branches(id)
  );

  CREATE TABLE Loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    loan_type TEXT,
    principal_amount REAL,
    interest_rate REAL,
    term_months INTEGER,
    start_date DATE,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY (customer_id) REFERENCES Customers(id)
  );

  CREATE TABLE CreditCards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    card_number TEXT UNIQUE,
    expiry_date DATE,
    credit_limit REAL,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY (customer_id) REFERENCES Customers(id)
  );

  CREATE TABLE Payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id INTEGER, -- loan_id or card_id
    type TEXT CHECK(type IN ('Loan', 'CreditCard')),
    amount REAL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    method TEXT,
    FOREIGN KEY (reference_id) REFERENCES Loans(id) -- Simplified
  );

  CREATE TABLE AuditLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    table_name TEXT,
    record_id INTEGER,
    user_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Views
  CREATE VIEW v_customer_summary AS
  SELECT 
    c.id, c.first_name, c.last_name, 
    COUNT(a.id) as account_count, 
    SUM(a.balance) as total_balance
  FROM Customers c
  LEFT JOIN Accounts a ON c.id = a.customer_id
  GROUP BY c.id;

  CREATE VIEW v_high_value_transactions AS
  SELECT * FROM Transactions WHERE amount > 50000;
`);

// Seeding
const insertAccountType = db.prepare('INSERT INTO AccountTypes (name, interest_rate, min_balance) VALUES (?, ?, ?)');
insertAccountType.run('Savings', 3.5, 5000);
insertAccountType.run('Current', 0, 10000);
insertAccountType.run('Fixed Deposit', 6.5, 25000);

const insertBranch = db.prepare('INSERT INTO Branches (branch_name, ifsc_code, city, address) VALUES (?, ?, ?, ?)');
insertBranch.run('Mumbai Main', 'IDBI0000101', 'Mumbai', 'Cuffe Parade, Mumbai');
insertBranch.run('Delhi Central', 'IDBI0000202', 'Delhi', 'Connaught Place, Delhi');
insertBranch.run('Bangalore East', 'IDBI0000303', 'Bangalore', 'Indiranagar, Bangalore');

const insertCustomer = db.prepare('INSERT INTO Customers (first_name, last_name, email, phone, address, dob) VALUES (?, ?, ?, ?, ?, ?)');
const customers = [
  ['Amit', 'Sharma', 'amit.s@gmail.com', '9876543210', 'Mumbai', '1985-05-15'],
  ['Priya', 'Patel', 'priya.p@yahoo.com', '8765432109', 'Ahmedabad', '1990-08-22'],
  ['Rahul', 'Verma', 'rahul.v@outlook.com', '7654321098', 'Delhi', '1982-12-10'],
  ['Sneha', 'Reddy', 'sneha.r@gmail.com', '6543210987', 'Hyderabad', '1995-03-05'],
  ['Vijay', 'Kumar', 'vijay.k@gmail.com', '5432109876', 'Bangalore', '1988-11-20'],
  ['Anjali', 'Gupta', 'anjali.g@gmail.com', '4321098765', 'Pune', '1992-07-14']
];
customers.forEach(c => insertCustomer.run(...c));

const insertAccount = db.prepare('INSERT INTO Accounts (customer_id, account_type_id, branch_id, account_number, balance) VALUES (?, ?, ?, ?, ?)');
insertAccount.run(1, 1, 1, '10000001', 750000);
insertAccount.run(1, 3, 1, '30000001', 1500000);
insertAccount.run(2, 1, 1, '10000002', 45000);
insertAccount.run(3, 2, 2, '20000003', 1200000);
insertAccount.run(4, 1, 3, '10000004', 85000);
insertAccount.run(5, 1, 3, '10000005', 250000);

const insertTransaction = db.prepare('INSERT INTO Transactions (account_id, transaction_type, amount, description) VALUES (?, ?, ?, ?)');
insertTransaction.run(1, 'Debit', 5000, 'ATM Withdrawal');
insertTransaction.run(1, 'Credit', 150000, 'Salary Credit');
insertTransaction.run(2, 'Debit', 2000, 'Grocery Shop');
insertTransaction.run(4, 'Debit', 60000, 'Car EMI');
insertTransaction.run(4, 'Credit', 100000, 'Dividend Received');

const insertLoan = db.prepare('INSERT INTO Loans (customer_id, loan_type, principal_amount, interest_rate, term_months, start_date) VALUES (?, ?, ?, ?, ?, ?)');
insertLoan.run(1, 'Home Loan', 5000000, 8.5, 240, '2023-01-01');
insertLoan.run(3, 'Auto Loan', 800000, 9.5, 60, '2024-02-15');

console.log('Database seeded successfully!');
db.close();
