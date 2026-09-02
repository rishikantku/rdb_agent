-- ============================================================================
-- Indexes — Optimized for analytical and join-heavy NL-to-SQL queries
-- ============================================================================

-- GEOGRAPHY
CREATE INDEX idx_regions_state ON regions(state_id);
CREATE INDEX idx_zones_region ON zones(region_id);
CREATE INDEX idx_branches_zone ON branches(zone_id);
CREATE INDEX idx_branches_active ON branches(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_branches_type ON branches(branch_type);

-- EMPLOYEE
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_type ON employees(employment_type);
CREATE INDEX idx_employees_join_date ON employees(join_date);
CREATE INDEX idx_employees_exit_date ON employees(exit_date) WHERE exit_date IS NOT NULL;
CREATE INDEX idx_employees_designation ON employees(designation);
CREATE INDEX idx_emp_dept_hist_emp ON employee_department_history(employee_id);
CREATE INDEX idx_emp_dept_hist_dates ON employee_department_history(start_date, end_date);
CREATE INDEX idx_emp_perf_emp ON employee_performance(employee_id);
CREATE INDEX idx_emp_perf_fy_q ON employee_performance(financial_year, quarter);
CREATE INDEX idx_emp_attendance_emp ON employee_attendance(employee_id);
CREATE INDEX idx_emp_attendance_month ON employee_attendance(month_year);

-- CUSTOMER
CREATE INDEX idx_customers_branch ON customers(branch_id);
CREATE INDEX idx_customers_segment ON customers(segment_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_type ON customers(customer_type);
CREATE INDEX idx_customers_risk ON customers(risk_category);
CREATE INDEX idx_customers_registration ON customers(registration_date);
CREATE INDEX idx_cust_addr_customer ON customer_addresses(customer_id);
CREATE INDEX idx_cust_rel_primary ON customer_relationships(primary_customer_id);
CREATE INDEX idx_cust_rel_related ON customer_relationships(related_customer_id);

-- ACCOUNT
CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_accounts_branch ON accounts(branch_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_opening ON accounts(opening_date);
CREATE INDEX idx_acct_bal_account ON account_balances(account_id);
CREATE INDEX idx_acct_bal_date ON account_balances(balance_date);
CREATE INDEX idx_acct_holders_account ON account_holders(account_id);
CREATE INDEX idx_acct_holders_customer ON account_holders(customer_id);

-- TRANSACTION
CREATE INDEX idx_txn_account ON transactions(account_id);
CREATE INDEX idx_txn_type ON transactions(txn_type_id);
CREATE INDEX idx_txn_date ON transactions(transaction_date);
CREATE INDEX idx_txn_branch ON transactions(branch_id);
CREATE INDEX idx_txn_status ON transactions(status);
CREATE INDEX idx_txn_channel ON transactions(channel);
CREATE INDEX idx_txn_debit_credit ON transactions(debit_credit);

-- LOAN
CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_branch ON loans(branch_id);
CREATE INDEX idx_loans_type ON loans(loan_type_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_sanction_date ON loans(sanction_date);
CREATE INDEX idx_loans_risk ON loans(risk_category);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_date ON loan_payments(payment_date);
CREATE INDEX idx_loan_payments_status ON loan_payments(payment_status);
CREATE INDEX idx_loan_status_hist_loan ON loan_status_history(loan_id);

-- PRODUCT
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_cust_products_customer ON customer_products(customer_id);
CREATE INDEX idx_cust_products_product ON customer_products(product_id);
CREATE INDEX idx_cust_products_branch ON customer_products(branch_id);
CREATE INDEX idx_cust_products_status ON customer_products(status);

-- CUSTOMER SERVICE
CREATE INDEX idx_complaints_customer ON customer_complaints(customer_id);
CREATE INDEX idx_complaints_branch ON customer_complaints(branch_id);
CREATE INDEX idx_complaints_date ON customer_complaints(complaint_date);
CREATE INDEX idx_complaints_status ON customer_complaints(resolution_status);
CREATE INDEX idx_complaints_employee ON customer_complaints(assigned_employee_id);
CREATE INDEX idx_interactions_customer ON customer_interactions(customer_id);
CREATE INDEX idx_interactions_employee ON customer_interactions(employee_id);
CREATE INDEX idx_interactions_date ON customer_interactions(interaction_date);
CREATE INDEX idx_interactions_branch ON customer_interactions(branch_id);
