// ============================================================================
// PostgreSQL Banking Database Seed
// ============================================================================
// Creates 15 tables with realistic Indian banking data.
// ~1200 employees, 60 branches across 6 states, departments, designations,
// salary history, transfers, customers, accounts, loans, transactions,
// and performance metrics with fiscal year data.
//
// Usage: npx tsx src/backend/db/seed-banking-pg.ts
// Requires: DATABASE_URL env var (postgres://user:pass@host:port/dbname)
// ============================================================================

import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bank_ai';

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('[Seed] Connected to PostgreSQL');

  // Drop existing tables (order matters for FK constraints)
  const dropOrder = [
    'training_records', 'performance_metrics', 'employee_leave', 'transfers',
    'salary_history', 'transactions', 'loans', 'accounts', 'customers',
    'employees', 'designations', 'departments', 'branches', 'districts', 'states'
  ];
  for (const table of dropOrder) {
    await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  console.log('[Seed] Dropped existing tables');

  // -------------------------------------------------------------------------
  // CREATE TABLES
  // -------------------------------------------------------------------------

  await client.query(`
    CREATE TABLE states (
      id SERIAL PRIMARY KEY,
      state_name VARCHAR(100) NOT NULL,
      state_code VARCHAR(10) NOT NULL UNIQUE,
      region VARCHAR(50)
    );

    CREATE TABLE districts (
      id SERIAL PRIMARY KEY,
      district_name VARCHAR(100) NOT NULL,
      state_id INTEGER NOT NULL REFERENCES states(id)
    );

    CREATE TABLE branches (
      id SERIAL PRIMARY KEY,
      branch_name VARCHAR(200) NOT NULL,
      branch_code VARCHAR(20) NOT NULL UNIQUE,
      ifsc_code VARCHAR(20) NOT NULL UNIQUE,
      district_id INTEGER NOT NULL REFERENCES districts(id),
      address TEXT,
      branch_type VARCHAR(30) DEFAULT 'BRANCH',
      established_date DATE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE departments (
      id SERIAL PRIMARY KEY,
      dept_name VARCHAR(100) NOT NULL,
      dept_code VARCHAR(20) NOT NULL UNIQUE,
      head_employee_id INTEGER
    );

    CREATE TABLE designations (
      id SERIAL PRIMARY KEY,
      designation_name VARCHAR(50) NOT NULL UNIQUE,
      grade INTEGER NOT NULL,
      pay_scale_min NUMERIC(12,2),
      pay_scale_max NUMERIC(12,2)
    );

    CREATE TABLE employees (
      id SERIAL PRIMARY KEY,
      employee_code VARCHAR(20) NOT NULL UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(200),
      phone VARCHAR(20),
      date_of_birth DATE,
      gender VARCHAR(5),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      department_id INTEGER NOT NULL REFERENCES departments(id),
      designation_id INTEGER NOT NULL REFERENCES designations(id),
      employment_type VARCHAR(20) NOT NULL DEFAULT 'PERMANENT',
      join_date DATE NOT NULL,
      confirmation_date DATE,
      retirement_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      basic_salary NUMERIC(12,2) NOT NULL,
      gross_salary NUMERIC(12,2) NOT NULL,
      reporting_to INTEGER REFERENCES employees(id)
    );

    -- Add FK for department head after employees table exists
    ALTER TABLE departments ADD CONSTRAINT fk_dept_head
      FOREIGN KEY (head_employee_id) REFERENCES employees(id);

    CREATE TABLE salary_history (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      month_year DATE NOT NULL,
      basic_pay NUMERIC(12,2) NOT NULL,
      da NUMERIC(12,2) DEFAULT 0,
      hra NUMERIC(12,2) DEFAULT 0,
      special_allowance NUMERIC(12,2) DEFAULT 0,
      gross_pay NUMERIC(12,2) NOT NULL,
      deductions NUMERIC(12,2) DEFAULT 0,
      net_pay NUMERIC(12,2) NOT NULL
    );

    CREATE TABLE transfers (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      from_branch_id INTEGER NOT NULL REFERENCES branches(id),
      to_branch_id INTEGER NOT NULL REFERENCES branches(id),
      transfer_date DATE NOT NULL,
      reason VARCHAR(30),
      order_number VARCHAR(50)
    );

    CREATE TABLE employee_leave (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      leave_type VARCHAR(10) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
    );

    CREATE TABLE customers (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(200),
      phone VARCHAR(20),
      customer_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL',
      kyc_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETE',
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      risk_category VARCHAR(10) DEFAULT 'LOW',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE accounts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      account_number VARCHAR(20) NOT NULL UNIQUE,
      account_type VARCHAR(20) NOT NULL DEFAULT 'SAVINGS',
      balance NUMERIC(15,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      opened_date DATE NOT NULL,
      closed_date DATE
    );

    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      transaction_type VARCHAR(10) NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      description TEXT,
      channel VARCHAR(20),
      transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reference_number VARCHAR(50)
    );

    CREATE TABLE loans (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      loan_type VARCHAR(20) NOT NULL,
      principal_amount NUMERIC(15,2) NOT NULL,
      interest_rate NUMERIC(5,2) NOT NULL,
      tenure_months INTEGER NOT NULL,
      disbursement_date DATE NOT NULL,
      maturity_date DATE,
      outstanding_amount NUMERIC(15,2),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      npa_date DATE
    );

    CREATE TABLE performance_metrics (
      id SERIAL PRIMARY KEY,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      quarter VARCHAR(5) NOT NULL,
      fiscal_year INTEGER NOT NULL,
      total_deposits NUMERIC(15,2),
      total_advances NUMERIC(15,2),
      npa_ratio NUMERIC(5,2),
      profit_loss NUMERIC(15,2),
      customer_count INTEGER,
      employee_count INTEGER,
      attrition_count INTEGER DEFAULT 0
    );

    CREATE TABLE training_records (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      training_name VARCHAR(200) NOT NULL,
      training_type VARCHAR(20),
      start_date DATE NOT NULL,
      end_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
      score NUMERIC(5,2)
    );

    -- Create indexes for common query patterns
    CREATE INDEX idx_employees_branch ON employees(branch_id);
    CREATE INDEX idx_employees_dept ON employees(department_id);
    CREATE INDEX idx_employees_status ON employees(status);
    CREATE INDEX idx_employees_type ON employees(employment_type);
    CREATE INDEX idx_employees_join_date ON employees(join_date);
    CREATE INDEX idx_branches_district ON branches(district_id);
    CREATE INDEX idx_districts_state ON districts(state_id);
    CREATE INDEX idx_accounts_customer ON accounts(customer_id);
    CREATE INDEX idx_transactions_account ON transactions(account_id);
    CREATE INDEX idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX idx_loans_customer ON loans(customer_id);
    CREATE INDEX idx_loans_branch ON loans(branch_id);
    CREATE INDEX idx_perf_branch_fy ON performance_metrics(branch_id, fiscal_year);
    CREATE INDEX idx_salary_history_emp ON salary_history(employee_id);
  `);
  console.log('[Seed] Created all tables and indexes');

  // -------------------------------------------------------------------------
  // SEED DATA
  // -------------------------------------------------------------------------

  // States
  const stateData: [string, string, string][] = [
    ['Jharkhand', 'JH', 'East'],
    ['Bihar', 'BR', 'East'],
    ['West Bengal', 'WB', 'East'],
    ['Madhya Pradesh', 'MP', 'Central'],
    ['Maharashtra', 'MH', 'West'],
    ['Uttar Pradesh', 'UP', 'North'],
  ];
  for (const [name, code, region] of stateData) {
    await client.query('INSERT INTO states (state_name, state_code, region) VALUES ($1, $2, $3)', [name, code, region]);
  }
  console.log('[Seed] States inserted');

  // Districts (10-12 per state)
  const districtsByState: Record<string, string[]> = {
    JH: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Dumka', 'Palamu', 'Chaibasa'],
    BR: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Begusarai', 'Munger', 'Arrah', 'Saharsa'],
    WB: ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol', 'Bardhaman', 'Malda', 'Kharagpur', 'Haldia', 'Baharampur'],
    MP: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa', 'Satna', 'Ratlam', 'Dewas'],
    MH: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Thane', 'Kolhapur', 'Amravati', 'Sangli'],
    UP: ['Lucknow', 'Varanasi', 'Kanpur', 'Agra', 'Allahabad', 'Meerut', 'Gorakhpur', 'Bareilly', 'Jhansi', 'Mathura'],
  };

  const stateIds: Record<string, number> = {};
  const stateRes = await client.query('SELECT id, state_code FROM states');
  for (const row of stateRes.rows) stateIds[row.state_code] = row.id;

  const districtIds: Record<string, number> = {};
  for (const [code, districts] of Object.entries(districtsByState)) {
    for (const dname of districts) {
      const res = await client.query(
        'INSERT INTO districts (district_name, state_id) VALUES ($1, $2) RETURNING id',
        [dname, stateIds[code]]
      );
      districtIds[dname] = res.rows[0].id;
    }
  }
  console.log('[Seed] Districts inserted');

  // Branches (1 per district = 60 branches)
  const branchTypes = ['MAIN', 'BRANCH', 'BRANCH', 'BRANCH', 'EXTENSION_COUNTER'];
  const allDistricts = Object.entries(districtIds);
  const branchIds: number[] = [];
  const branchDistrictMap: Map<number, string> = new Map();
  for (let i = 0; i < allDistricts.length; i++) {
    const [dname, did] = allDistricts[i];
    const bCode = `BR${String(i + 1).padStart(4, '0')}`;
    const ifsc = `BANK${bCode}`;
    const bType = branchTypes[i % branchTypes.length];
    const estYear = 2000 + (i % 20);
    const res = await client.query(
      `INSERT INTO branches (branch_name, branch_code, ifsc_code, district_id, address, branch_type, established_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id`,
      [`${dname} Branch`, bCode, ifsc, did, `Main Road, ${dname}`, bType, `${estYear}-01-15`]
    );
    branchIds.push(res.rows[0].id);
    branchDistrictMap.set(res.rows[0].id, dname);
  }
  console.log(`[Seed] ${branchIds.length} branches inserted`);

  // Departments
  const deptData: [string, string][] = [
    ['Operations', 'OPS'],
    ['Lending', 'LND'],
    ['Recovery', 'REC'],
    ['Human Resources', 'HR'],
    ['Information Technology', 'IT'],
    ['Compliance', 'CMP'],
    ['Treasury', 'TRE'],
    ['Retail Banking', 'RET'],
    ['Corporate Banking', 'COR'],
    ['Audit', 'AUD'],
  ];
  const deptIds: number[] = [];
  for (const [name, code] of deptData) {
    const res = await client.query(
      'INSERT INTO departments (dept_name, dept_code) VALUES ($1, $2) RETURNING id',
      [name, code]
    );
    deptIds.push(res.rows[0].id);
  }
  console.log('[Seed] Departments inserted');

  // Designations
  const desigData: [string, number, number, number][] = [
    ['CLERK', 1, 25000, 45000],
    ['OFFICER', 2, 35000, 60000],
    ['SENIOR_OFFICER', 3, 45000, 75000],
    ['MANAGER', 4, 55000, 90000],
    ['SENIOR_MANAGER', 5, 70000, 110000],
    ['CHIEF_MANAGER', 6, 85000, 130000],
    ['AGM', 7, 100000, 155000],
    ['DGM', 8, 120000, 180000],
    ['GM', 9, 150000, 220000],
    ['ED', 10, 200000, 300000],
    ['CMD', 11, 250000, 400000],
  ];
  const desigIds: number[] = [];
  for (const [name, grade, minPay, maxPay] of desigData) {
    const res = await client.query(
      'INSERT INTO designations (designation_name, grade, pay_scale_min, pay_scale_max) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, grade, minPay, maxPay]
    );
    desigIds.push(res.rows[0].id);
  }
  console.log('[Seed] Designations inserted');

  // Employees (~1200)
  const firstNames = ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vijay', 'Anjali', 'Suresh', 'Neha', 'Ravi', 'Kavita', 'Manoj', 'Sunita', 'Ashok', 'Deepa', 'Rajesh', 'Pooja', 'Sanjay', 'Meena', 'Anil', 'Rekha'];
  const lastNames = ['Sharma', 'Patel', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Yadav', 'Tiwari', 'Jha', 'Mishra', 'Dubey', 'Pandey', 'Sinha', 'Das', 'Roy', 'Thakur', 'Prasad', 'Mehta', 'Chopra'];
  const empTypes = ['PERMANENT', 'PERMANENT', 'PERMANENT', 'PERMANENT', 'CONTRACT', 'DEPUTATION'];
  const empStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'RETIRED', 'TERMINATED'];
  const genders = ['M', 'F', 'M', 'F', 'M'];

  const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  let empCount = 0;
  for (let i = 0; i < 1200; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const empCode = `EMP${String(i + 1).padStart(5, '0')}`;
    const branchId = branchIds[i % branchIds.length];
    const deptId = deptIds[i % deptIds.length];
    // Most employees are lower grades, fewer at top
    const desigIndex = i < 600 ? rng(0, 2) : i < 900 ? rng(2, 4) : i < 1100 ? rng(4, 6) : rng(6, Math.min(8, desigIds.length - 1));
    const desigId = desigIds[desigIndex];
    const empType = empTypes[i % empTypes.length];
    const status = empStatuses[i % empStatuses.length];
    const gender = genders[i % genders.length];

    // Join dates spread from 2010 to 2024
    const joinYear = 2010 + (i % 15);
    const joinMonth = (i % 12) + 1;
    const joinDate = `${joinYear}-${String(joinMonth).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;

    // Salary based on designation
    const basicSalary = desigData[desigIndex][2] + rng(0, Math.floor((desigData[desigIndex][3] - desigData[desigIndex][2]) * 0.7));
    const grossSalary = Math.round(basicSalary * 1.45); // ~45% allowances

    const dob = `${1965 + rng(0, 30)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;

    await client.query(
      `INSERT INTO employees (employee_code, first_name, last_name, email, phone, date_of_birth, gender, branch_id, department_id, designation_id, employment_type, join_date, status, basic_salary, gross_salary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [empCode, fn, ln, `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@bank.co.in`, `9${String(rng(100000000, 999999999))}`, dob, gender, branchId, deptId, desigId, empType, joinDate, status, basicSalary, grossSalary]
    );
    empCount++;
  }
  console.log(`[Seed] ${empCount} employees inserted`);

  // Salary History (last 12 months for active employees — sample 300 employees)
  const activeEmps = await client.query("SELECT id, basic_salary, gross_salary FROM employees WHERE status = 'ACTIVE' LIMIT 300");
  let salaryCount = 0;
  for (const emp of activeEmps.rows) {
    for (let m = 0; m < 12; m++) {
      const month = new Date();
      month.setMonth(month.getMonth() - m);
      const monthYear = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
      const basic = Number(emp.basic_salary);
      const da = Math.round(basic * 0.17);
      const hra = Math.round(basic * 0.12);
      const special = Math.round(basic * 0.16);
      const gross = basic + da + hra + special;
      const deductions = Math.round(gross * 0.12);
      const net = gross - deductions;
      await client.query(
        `INSERT INTO salary_history (employee_id, month_year, basic_pay, da, hra, special_allowance, gross_pay, deductions, net_pay)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [emp.id, monthYear, basic, da, hra, special, gross, deductions, net]
      );
      salaryCount++;
    }
  }
  console.log(`[Seed] ${salaryCount} salary_history records inserted`);

  // Transfers (sample 200)
  for (let i = 0; i < 200; i++) {
    const empId = rng(1, empCount);
    const fromBranch = branchIds[rng(0, branchIds.length - 1)];
    let toBranch = branchIds[rng(0, branchIds.length - 1)];
    while (toBranch === fromBranch) toBranch = branchIds[rng(0, branchIds.length - 1)];
    const reasons = ['PROMOTION', 'REQUEST', 'POLICY', 'POLICY', 'DISCIPLINARY'];
    const tDate = `${rng(2018, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;
    await client.query(
      'INSERT INTO transfers (employee_id, from_branch_id, to_branch_id, transfer_date, reason) VALUES ($1, $2, $3, $4, $5)',
      [empId, fromBranch, toBranch, tDate, reasons[i % reasons.length]]
    );
  }
  console.log('[Seed] Transfers inserted');

  // Customers (1000)
  let custCount = 0;
  const custTypes = ['INDIVIDUAL', 'INDIVIDUAL', 'INDIVIDUAL', 'CORPORATE', 'SME'];
  for (let i = 0; i < 1000; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i + 3) % lastNames.length];
    const cType = custTypes[i % custTypes.length];
    const branchId = branchIds[i % branchIds.length];
    const risk = ['LOW', 'LOW', 'LOW', 'MEDIUM', 'HIGH'][i % 5];
    const created = `${rng(2015, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;
    await client.query(
      `INSERT INTO customers (first_name, last_name, email, phone, customer_type, kyc_status, branch_id, risk_category, created_at)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETE', $6, $7, $8)`,
      [fn, ln, `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@email.com`, `8${String(rng(100000000, 999999999))}`, cType, branchId, risk, created]
    );
    custCount++;
  }
  console.log(`[Seed] ${custCount} customers inserted`);

  // Accounts (1500 — some customers have multiple)
  const acctTypes = ['SAVINGS', 'SAVINGS', 'CURRENT', 'FD', 'RD'];
  for (let i = 0; i < 1500; i++) {
    const custId = (i % custCount) + 1;
    const branchId = branchIds[i % branchIds.length];
    const acctType = acctTypes[i % acctTypes.length];
    const balance = rng(1000, 5000000);
    const opened = `${rng(2015, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;
    const acctNum = `ACCT${String(i + 1).padStart(8, '0')}`;
    await client.query(
      `INSERT INTO accounts (customer_id, branch_id, account_number, account_type, balance, status, opened_date)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)`,
      [custId, branchId, acctNum, acctType, balance, opened]
    );
  }
  console.log('[Seed] Accounts inserted');

  // Transactions (5000)
  const channels = ['BRANCH', 'ATM', 'NETBANKING', 'UPI', 'NEFT', 'RTGS', 'IMPS'];
  for (let i = 0; i < 5000; i++) {
    const acctId = rng(1, 1500);
    const txType = i % 3 === 0 ? 'DEBIT' : 'CREDIT';
    const amount = rng(100, 500000);
    const channel = channels[i % channels.length];
    const txDate = `${rng(2022, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')} ${String(rng(8, 20)).padStart(2, '0')}:${String(rng(0, 59)).padStart(2, '0')}:00`;
    const descs = ['Salary Credit', 'EMI Payment', 'ATM Withdrawal', 'Fund Transfer', 'UPI Payment', 'Bill Payment', 'Interest Credit'];
    await client.query(
      `INSERT INTO transactions (account_id, transaction_type, amount, description, channel, transaction_date, reference_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [acctId, txType, amount, descs[i % descs.length], channel, txDate, `TXN${String(i + 1).padStart(10, '0')}`]
    );
  }
  console.log('[Seed] Transactions inserted');

  // Loans (500)
  const loanTypes = ['HOME', 'VEHICLE', 'PERSONAL', 'EDUCATION', 'AGRICULTURE', 'MSME', 'GOLD'];
  const loanStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'CLOSED', 'NPA'];
  for (let i = 0; i < 500; i++) {
    const custId = rng(1, custCount);
    const branchId = branchIds[i % branchIds.length];
    const lType = loanTypes[i % loanTypes.length];
    const principal = rng(50000, 5000000);
    const rate = 7 + Math.random() * 8;
    const tenure = [12, 24, 36, 60, 120, 180, 240][i % 7];
    const disbDate = `${rng(2018, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;
    const status = loanStatuses[i % loanStatuses.length];
    const outstanding = status === 'CLOSED' ? 0 : Math.round(principal * (0.3 + Math.random() * 0.7));
    const npaDate = status === 'NPA' ? `${rng(2022, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-01` : null;

    await client.query(
      `INSERT INTO loans (customer_id, branch_id, loan_type, principal_amount, interest_rate, tenure_months, disbursement_date, outstanding_amount, status, npa_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [custId, branchId, lType, principal, Math.round(rate * 100) / 100, tenure, disbDate, outstanding, status, npaDate]
    );
  }
  console.log('[Seed] Loans inserted');

  // Performance Metrics (4 quarters × 3 fiscal years × 60 branches = 720 records)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const fyears = [2022, 2023, 2024];
  for (const fy of fyears) {
    for (const q of quarters) {
      for (const bId of branchIds) {
        const deposits = rng(10000000, 500000000);
        const advances = rng(5000000, 300000000);
        const npaRatio = Math.round((Math.random() * 8) * 100) / 100;
        const profit = rng(-2000000, 15000000);
        const custCnt = rng(100, 5000);
        const empCnt = rng(10, 40);
        const attrition = rng(0, 3);

        await client.query(
          `INSERT INTO performance_metrics (branch_id, quarter, fiscal_year, total_deposits, total_advances, npa_ratio, profit_loss, customer_count, employee_count, attrition_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [bId, q, fy, deposits, advances, npaRatio, profit, custCnt, empCnt, attrition]
        );
      }
    }
  }
  console.log('[Seed] Performance metrics inserted');

  // Training records (400)
  const trainings = ['AML/KYC Compliance', 'Credit Risk Assessment', 'Digital Banking', 'Customer Service', 'Leadership Development', 'Cybersecurity Awareness', 'Treasury Operations', 'CAIIB Preparation', 'JAIIB Preparation', 'Retail Lending'];
  for (let i = 0; i < 400; i++) {
    const empId = rng(1, empCount);
    const tName = trainings[i % trainings.length];
    const tType = ['MANDATORY', 'ELECTIVE', 'CERTIFICATION'][i % 3];
    const sDate = `${rng(2022, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;
    const score = rng(50, 100);
    await client.query(
      `INSERT INTO training_records (employee_id, training_name, training_type, start_date, end_date, status, score)
       VALUES ($1, $2, $3, $4, $4::date + INTERVAL '5 days', 'COMPLETED', $5)`,
      [empId, tName, tType, sDate, score]
    );
  }
  console.log('[Seed] Training records inserted');

  // Employee leave (600)
  const leaveTypes = ['CL', 'EL', 'SL', 'ML', 'STUDY', 'LWP'];
  for (let i = 0; i < 600; i++) {
    const empId = rng(1, empCount);
    const lType = leaveTypes[i % leaveTypes.length];
    const days = rng(1, 15);
    const sDate = `${rng(2022, 2024)}-${String(rng(1, 12)).padStart(2, '0')}-${String(rng(1, 28)).padStart(2, '0')}`;
    const statuses = ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'REJECTED'];
    await client.query(
      `INSERT INTO employee_leave (employee_id, leave_type, start_date, end_date, days, status)
       VALUES ($1, $2, $3, $3::date + $4 * INTERVAL '1 day', $4, $5)`,
      [empId, lType, sDate, days, statuses[i % statuses.length]]
    );
  }
  console.log('[Seed] Employee leave records inserted');

  // Summary
  console.log('\n[Seed] === SEED COMPLETE ===');
  console.log(`  States: ${stateData.length}`);
  console.log(`  Districts: ${Object.values(districtsByState).flat().length}`);
  console.log(`  Branches: ${branchIds.length}`);
  console.log(`  Departments: ${deptData.length}`);
  console.log(`  Designations: ${desigData.length}`);
  console.log(`  Employees: ${empCount}`);
  console.log(`  Customers: ${custCount}`);
  console.log(`  Accounts: 1500`);
  console.log(`  Transactions: 5000`);
  console.log(`  Loans: 500`);
  console.log(`  Performance Metrics: ${branchIds.length * quarters.length * fyears.length}`);

  await client.end();
  console.log('[Seed] Disconnected.');
}

seed().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
