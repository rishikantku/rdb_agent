-- ============================================================================
-- Bank AI POC — Comprehensive Banking Schema
-- PostgreSQL (Neon-compatible)
-- ============================================================================
-- 28 tables organized across 7 domains:
--   Geography (4), Customer (4), Account (4), Transaction (2),
--   Loan (4), Employee (5), Product (3), Customer Service (2)
-- ============================================================================

-- Drop in reverse dependency order
DROP VIEW IF EXISTS vw_branch_quarterly_performance CASCADE;
DROP VIEW IF EXISTS vw_employee_quarterly_performance CASCADE;
DROP VIEW IF EXISTS vw_branch_loan_metrics CASCADE;
DROP VIEW IF EXISTS vw_customer_transaction_summary CASCADE;
DROP VIEW IF EXISTS vw_customer_balance_summary CASCADE;
DROP VIEW IF EXISTS vw_branch_employee_metrics CASCADE;
DROP VIEW IF EXISTS vw_active_employees CASCADE;
DROP VIEW IF EXISTS vw_customer_product_summary CASCADE;

DROP TABLE IF EXISTS customer_interactions CASCADE;
DROP TABLE IF EXISTS customer_complaints CASCADE;
DROP TABLE IF EXISTS customer_products CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS employee_attendance CASCADE;
DROP TABLE IF EXISTS employee_performance CASCADE;
DROP TABLE IF EXISTS employee_department_history CASCADE;
DROP TABLE IF EXISTS loan_status_history CASCADE;
DROP TABLE IF EXISTS loan_payments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS loan_types CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS transaction_types CASCADE;
DROP TABLE IF EXISTS account_holders CASCADE;
DROP TABLE IF EXISTS account_balances CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS account_types CASCADE;
DROP TABLE IF EXISTS customer_relationships CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS customer_segments CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS states CASCADE;

-- ============================================================================
-- DOMAIN 1: GEOGRAPHY / ORGANIZATION
-- ============================================================================

CREATE TABLE states (
    state_id SERIAL PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL UNIQUE,
    state_code VARCHAR(10) NOT NULL UNIQUE,
    capital VARCHAR(100),
    geographic_zone VARCHAR(30) NOT NULL
        CHECK (geographic_zone IN ('NORTH','SOUTH','EAST','WEST','CENTRAL','NORTHEAST'))
);

CREATE TABLE regions (
    region_id SERIAL PRIMARY KEY,
    region_name VARCHAR(100) NOT NULL UNIQUE,
    region_code VARCHAR(10) NOT NULL UNIQUE,
    state_id INTEGER NOT NULL REFERENCES states(state_id),
    regional_head VARCHAR(100)
);

CREATE TABLE zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    zone_code VARCHAR(10) NOT NULL UNIQUE,
    region_id INTEGER NOT NULL REFERENCES regions(region_id),
    zonal_head VARCHAR(100)
);

CREATE TABLE branches (
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(200) NOT NULL,
    branch_code VARCHAR(20) NOT NULL UNIQUE,
    ifsc_code VARCHAR(20) NOT NULL UNIQUE,
    zone_id INTEGER NOT NULL REFERENCES zones(zone_id),
    address TEXT,
    city VARCHAR(100),
    pincode VARCHAR(10),
    branch_type VARCHAR(30) NOT NULL DEFAULT 'BRANCH'
        CHECK (branch_type IN ('MAIN','BRANCH','EXTENSION_COUNTER','SATELLITE','DIGITAL')),
    established_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    tier VARCHAR(10) CHECK (tier IN ('METRO','URBAN','SEMI_URBAN','RURAL'))
);

-- ============================================================================
-- DOMAIN 2: EMPLOYEE
-- ============================================================================

CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL UNIQUE,
    dept_code VARCHAR(20) NOT NULL UNIQUE,
    parent_department_id INTEGER REFERENCES departments(department_id),
    description TEXT
);

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    employee_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(5) CHECK (gender IN ('M','F','O')),
    date_of_birth DATE,
    join_date DATE NOT NULL,
    exit_date DATE,
    employment_type VARCHAR(20) NOT NULL DEFAULT 'PERMANENT'
        CHECK (employment_type IN ('PERMANENT','CONTRACT','TEMPORARY','PROBATION')),
    designation VARCHAR(50) NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    manager_id INTEGER REFERENCES employees(employee_id),
    salary NUMERIC(12,2) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','INACTIVE','RETIRED','RESIGNED','TERMINATED'))
);

CREATE TABLE employee_department_history (
    history_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    department_id INTEGER NOT NULL REFERENCES departments(department_id),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    designation VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    reason VARCHAR(50)
        CHECK (reason IN ('JOINING','PROMOTION','TRANSFER','REORGANIZATION','REQUEST'))
);

CREATE TABLE employee_performance (
    performance_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    performance_date DATE NOT NULL,
    financial_year INTEGER NOT NULL,
    quarter VARCHAR(5) NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
    performance_score NUMERIC(4,2) CHECK (performance_score BETWEEN 0 AND 10),
    productivity_score NUMERIC(4,2) CHECK (productivity_score BETWEEN 0 AND 10),
    sales_score NUMERIC(4,2) CHECK (sales_score BETWEEN 0 AND 10),
    customer_service_score NUMERIC(4,2) CHECK (customer_service_score BETWEEN 0 AND 10),
    attendance_score NUMERIC(4,2) CHECK (attendance_score BETWEEN 0 AND 10),
    UNIQUE(employee_id, financial_year, quarter)
);

CREATE TABLE employee_attendance (
    attendance_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    month_year DATE NOT NULL,
    working_days INTEGER NOT NULL,
    days_present INTEGER NOT NULL,
    days_absent INTEGER NOT NULL DEFAULT 0,
    leaves_taken INTEGER NOT NULL DEFAULT 0,
    late_arrivals INTEGER DEFAULT 0,
    UNIQUE(employee_id, month_year)
);

-- ============================================================================
-- DOMAIN 3: CUSTOMER
-- ============================================================================

CREATE TABLE customer_segments (
    segment_id SERIAL PRIMARY KEY,
    segment_name VARCHAR(50) NOT NULL UNIQUE,
    segment_code VARCHAR(10) NOT NULL UNIQUE,
    min_balance NUMERIC(15,2),
    min_income NUMERIC(15,2),
    description TEXT
);

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    customer_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(5) CHECK (gender IN ('M','F','O')),
    customer_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL'
        CHECK (customer_type IN ('INDIVIDUAL','CORPORATE','SME','GOVERNMENT','INSTITUTIONAL')),
    segment_id INTEGER REFERENCES customer_segments(segment_id),
    risk_category VARCHAR(10) DEFAULT 'LOW'
        CHECK (risk_category IN ('LOW','MEDIUM','HIGH','VERY_HIGH')),
    occupation VARCHAR(100),
    annual_income NUMERIC(15,2),
    registration_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','INACTIVE','CLOSED','SUSPENDED','DECEASED')),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_addresses (
    address_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    address_type VARCHAR(20) NOT NULL
        CHECK (address_type IN ('PERMANENT','CURRENT','OFFICE','REGISTERED')),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    is_primary BOOLEAN DEFAULT FALSE
);

CREATE TABLE customer_relationships (
    relationship_id SERIAL PRIMARY KEY,
    primary_customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    related_customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    relationship_type VARCHAR(30) NOT NULL
        CHECK (relationship_type IN ('JOINT','GUARDIAN','NOMINEE','AUTHORIZED_REP','GUARANTOR','SPOUSE','PARENT')),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- ============================================================================
-- DOMAIN 4: ACCOUNT
-- ============================================================================

CREATE TABLE account_types (
    account_type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    type_code VARCHAR(10) NOT NULL UNIQUE,
    category VARCHAR(30) NOT NULL
        CHECK (category IN ('DEPOSIT','LENDING','INVESTMENT')),
    interest_rate NUMERIC(5,2),
    min_balance NUMERIC(12,2) DEFAULT 0,
    description TEXT
);

CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    account_type_id INTEGER NOT NULL REFERENCES account_types(account_type_id),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    opening_date DATE NOT NULL,
    closing_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','DORMANT','CLOSED','FROZEN','SUSPENDED')),
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    credit_limit NUMERIC(15,2),
    interest_rate NUMERIC(5,2),
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 0
);

CREATE TABLE account_balances (
    balance_id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(account_id),
    balance_date DATE NOT NULL,
    opening_balance NUMERIC(15,2) NOT NULL,
    closing_balance NUMERIC(15,2) NOT NULL,
    total_credits NUMERIC(15,2) DEFAULT 0,
    total_debits NUMERIC(15,2) DEFAULT 0,
    UNIQUE(account_id, balance_date)
);

CREATE TABLE account_holders (
    holder_id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(account_id),
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    holder_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY'
        CHECK (holder_type IN ('PRIMARY','JOINT','NOMINEE','AUTHORIZED')),
    start_date DATE NOT NULL,
    end_date DATE,
    UNIQUE(account_id, customer_id, holder_type)
);

-- ============================================================================
-- DOMAIN 5: TRANSACTION
-- ============================================================================

CREATE TABLE transaction_types (
    txn_type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    type_code VARCHAR(10) NOT NULL UNIQUE,
    category VARCHAR(20) NOT NULL
        CHECK (category IN ('DEPOSIT','WITHDRAWAL','TRANSFER','FEE','INTEREST','LOAN'))
);

CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(account_id),
    txn_type_id INTEGER NOT NULL REFERENCES transaction_types(txn_type_id),
    transaction_date TIMESTAMP NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    debit_credit VARCHAR(2) NOT NULL CHECK (debit_credit IN ('DR','CR')),
    channel VARCHAR(20)
        CHECK (channel IN ('BRANCH','ATM','NETBANKING','UPI','NEFT','RTGS','IMPS','MOBILE','CHEQUE','POS')),
    branch_id INTEGER REFERENCES branches(branch_id),
    counterparty_account_id INTEGER REFERENCES accounts(account_id),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('COMPLETED','PENDING','FAILED','REVERSED','PROCESSING')),
    reference_number VARCHAR(50),
    description TEXT
);

-- ============================================================================
-- DOMAIN 6: LOAN
-- ============================================================================

CREATE TABLE loan_types (
    loan_type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    type_code VARCHAR(10) NOT NULL UNIQUE,
    max_tenure_months INTEGER,
    min_rate NUMERIC(5,2),
    max_rate NUMERIC(5,2),
    description TEXT
);

CREATE TABLE loans (
    loan_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    loan_type_id INTEGER NOT NULL REFERENCES loan_types(loan_type_id),
    loan_number VARCHAR(20) NOT NULL UNIQUE,
    sanction_date DATE NOT NULL,
    sanction_amount NUMERIC(15,2) NOT NULL,
    disbursed_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(5,2) NOT NULL,
    tenure_months INTEGER NOT NULL,
    maturity_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','CLOSED','NPA','WRITTEN_OFF','RESTRUCTURED','SANCTIONED')),
    risk_category VARCHAR(10) DEFAULT 'STANDARD'
        CHECK (risk_category IN ('STANDARD','SMA1','SMA2','SUBSTANDARD','DOUBTFUL','LOSS')),
    npa_date DATE,
    disbursement_date DATE
);

CREATE TABLE loan_payments (
    payment_id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id),
    payment_date DATE NOT NULL,
    due_date DATE NOT NULL,
    due_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    principal_amount NUMERIC(12,2) DEFAULT 0,
    interest_amount NUMERIC(12,2) DEFAULT 0,
    penalty_amount NUMERIC(12,2) DEFAULT 0,
    days_overdue INTEGER DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PAID','PARTIAL','OVERDUE','PENDING','WAIVED'))
);

CREATE TABLE loan_status_history (
    history_id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id),
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    change_date DATE NOT NULL,
    reason TEXT,
    changed_by VARCHAR(50)
);

-- ============================================================================
-- DOMAIN 7: PRODUCT
-- ============================================================================

CREATE TABLE product_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE,
    category_code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    product_code VARCHAR(20) NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES product_categories(category_id),
    is_active BOOLEAN DEFAULT TRUE,
    launch_date DATE,
    description TEXT
);

CREATE TABLE customer_products (
    customer_product_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    activation_date DATE NOT NULL,
    deactivation_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','INACTIVE','CANCELLED','EXPIRED','SUSPENDED'))
);

-- ============================================================================
-- DOMAIN 8: CUSTOMER SERVICE
-- ============================================================================

CREATE TABLE customer_complaints (
    complaint_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
    complaint_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL
        CHECK (category IN ('ACCOUNT','LOAN','CARD','ATM','NETBANKING','UPI','STAFF','CHARGES','FRAUD','OTHER')),
    priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    description TEXT,
    resolution_date DATE,
    resolution_status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (resolution_status IN ('OPEN','IN_PROGRESS','RESOLVED','ESCALATED','CLOSED','REOPENED')),
    assigned_employee_id INTEGER REFERENCES employees(employee_id),
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5)
);

CREATE TABLE customer_interactions (
    interaction_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    employee_id INTEGER REFERENCES employees(employee_id),
    branch_id INTEGER REFERENCES branches(branch_id),
    interaction_date TIMESTAMP NOT NULL,
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('BRANCH','PHONE','EMAIL','CHAT','VIDEO','MOBILE_APP','WEBSITE')),
    interaction_type VARCHAR(30) NOT NULL
        CHECK (interaction_type IN ('ENQUIRY','COMPLAINT','SERVICE_REQUEST','SALES','FEEDBACK','KYC','ACCOUNT_OPENING')),
    duration_minutes INTEGER,
    outcome VARCHAR(30)
        CHECK (outcome IN ('RESOLVED','FOLLOW_UP','ESCALATED','SALE_COMPLETED','NO_ACTION','REFERRED'))
);
