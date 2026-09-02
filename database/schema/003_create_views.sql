-- ============================================================================
-- Business Views — Analytical assets the AI can query directly
-- ============================================================================

-- Active employees with full organizational context
CREATE OR REPLACE VIEW vw_active_employees AS
SELECT
    e.employee_id,
    e.employee_number,
    e.first_name || ' ' || e.last_name AS full_name,
    e.designation,
    e.employment_type,
    e.join_date,
    e.salary,
    e.gender,
    d.dept_name AS department,
    b.branch_name,
    b.branch_code,
    z.zone_name,
    r.region_name,
    s.state_name,
    s.geographic_zone,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.join_date)) AS years_of_service
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN branches b ON e.branch_id = b.branch_id
JOIN zones z ON b.zone_id = z.zone_id
JOIN regions r ON z.region_id = r.region_id
JOIN states s ON r.state_id = s.state_id
WHERE e.status = 'ACTIVE';

-- Branch employee metrics
CREATE OR REPLACE VIEW vw_branch_employee_metrics AS
SELECT
    b.branch_id,
    b.branch_name,
    b.branch_code,
    z.zone_name,
    r.region_name,
    s.state_name,
    COUNT(e.employee_id) FILTER (WHERE e.status = 'ACTIVE') AS active_employee_count,
    COUNT(e.employee_id) FILTER (WHERE e.employment_type = 'PERMANENT' AND e.status = 'ACTIVE') AS permanent_count,
    COUNT(e.employee_id) FILTER (WHERE e.employment_type = 'CONTRACT' AND e.status = 'ACTIVE') AS contract_count,
    ROUND(AVG(e.salary) FILTER (WHERE e.status = 'ACTIVE'), 2) AS avg_salary,
    ROUND(SUM(e.salary) FILTER (WHERE e.status = 'ACTIVE'), 2) AS total_salary_cost,
    MIN(e.join_date) FILTER (WHERE e.status = 'ACTIVE') AS earliest_join,
    COUNT(e.employee_id) FILTER (WHERE e.status IN ('RESIGNED','TERMINATED')) AS attrition_total
FROM branches b
LEFT JOIN zones z ON b.zone_id = z.zone_id
LEFT JOIN regions r ON z.region_id = r.region_id
LEFT JOIN states s ON r.state_id = s.state_id
LEFT JOIN employees e ON e.branch_id = b.branch_id
GROUP BY b.branch_id, b.branch_name, b.branch_code, z.zone_name, r.region_name, s.state_name;

-- Customer balance summary
CREATE OR REPLACE VIEW vw_customer_balance_summary AS
SELECT
    c.customer_id,
    c.customer_number,
    c.first_name || ' ' || c.last_name AS customer_name,
    c.customer_type,
    cs.segment_name,
    c.risk_category,
    b.branch_name,
    r.region_name,
    s.state_name,
    COUNT(a.account_id) AS total_accounts,
    COUNT(a.account_id) FILTER (WHERE a.status = 'ACTIVE') AS active_accounts,
    COALESCE(SUM(a.current_balance) FILTER (WHERE a.status = 'ACTIVE'), 0) AS total_balance,
    COALESCE(AVG(a.current_balance) FILTER (WHERE a.status = 'ACTIVE'), 0) AS avg_balance
FROM customers c
LEFT JOIN customer_segments cs ON c.segment_id = cs.segment_id
LEFT JOIN branches b ON c.branch_id = b.branch_id
LEFT JOIN zones z ON b.zone_id = z.zone_id
LEFT JOIN regions r ON z.region_id = r.region_id
LEFT JOIN states s ON r.state_id = s.state_id
LEFT JOIN accounts a ON a.customer_id = c.customer_id
WHERE c.status = 'ACTIVE'
GROUP BY c.customer_id, c.customer_number, c.first_name, c.last_name,
         c.customer_type, cs.segment_name, c.risk_category,
         b.branch_name, r.region_name, s.state_name;

-- Customer transaction summary
CREATE OR REPLACE VIEW vw_customer_transaction_summary AS
SELECT
    c.customer_id,
    c.customer_number,
    c.first_name || ' ' || c.last_name AS customer_name,
    COUNT(t.transaction_id) AS total_transactions,
    COUNT(t.transaction_id) FILTER (WHERE t.debit_credit = 'CR') AS credit_count,
    COUNT(t.transaction_id) FILTER (WHERE t.debit_credit = 'DR') AS debit_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.debit_credit = 'CR'), 0) AS total_credits,
    COALESCE(SUM(t.amount) FILTER (WHERE t.debit_credit = 'DR'), 0) AS total_debits,
    MAX(t.transaction_date) AS last_transaction_date
FROM customers c
LEFT JOIN accounts a ON a.customer_id = c.customer_id
LEFT JOIN transactions t ON t.account_id = a.account_id AND t.status = 'COMPLETED'
GROUP BY c.customer_id, c.customer_number, c.first_name, c.last_name;

-- Branch loan metrics
CREATE OR REPLACE VIEW vw_branch_loan_metrics AS
SELECT
    b.branch_id,
    b.branch_name,
    b.branch_code,
    r.region_name,
    s.state_name,
    COUNT(l.loan_id) AS total_loans,
    COUNT(l.loan_id) FILTER (WHERE l.status = 'ACTIVE') AS active_loans,
    COUNT(l.loan_id) FILTER (WHERE l.status = 'NPA') AS npa_loans,
    COALESCE(SUM(l.sanction_amount), 0) AS total_sanctioned,
    COALESCE(SUM(l.disbursed_amount), 0) AS total_disbursed,
    COALESCE(SUM(l.outstanding_amount) FILTER (WHERE l.status = 'ACTIVE'), 0) AS active_outstanding,
    COALESCE(SUM(l.outstanding_amount) FILTER (WHERE l.status = 'NPA'), 0) AS npa_outstanding,
    CASE
        WHEN SUM(l.outstanding_amount) FILTER (WHERE l.status IN ('ACTIVE','NPA')) > 0
        THEN ROUND(SUM(l.outstanding_amount) FILTER (WHERE l.status = 'NPA') * 100.0 /
             NULLIF(SUM(l.outstanding_amount) FILTER (WHERE l.status IN ('ACTIVE','NPA')), 0), 2)
        ELSE 0
    END AS npa_ratio
FROM branches b
LEFT JOIN zones z ON b.zone_id = z.zone_id
LEFT JOIN regions r ON z.region_id = r.region_id
LEFT JOIN states s ON r.state_id = s.state_id
LEFT JOIN loans l ON l.branch_id = b.branch_id
GROUP BY b.branch_id, b.branch_name, b.branch_code, r.region_name, s.state_name;

-- Employee quarterly performance
CREATE OR REPLACE VIEW vw_employee_quarterly_performance AS
SELECT
    e.employee_id,
    e.employee_number,
    e.first_name || ' ' || e.last_name AS full_name,
    e.designation,
    d.dept_name AS department,
    b.branch_name,
    r.region_name,
    s.state_name,
    ep.financial_year,
    ep.quarter,
    ep.performance_score,
    ep.productivity_score,
    ep.sales_score,
    ep.customer_service_score,
    ep.attendance_score,
    ROUND((COALESCE(ep.performance_score,0) + COALESCE(ep.productivity_score,0) +
           COALESCE(ep.sales_score,0) + COALESCE(ep.customer_service_score,0) +
           COALESCE(ep.attendance_score,0)) / 5.0, 2) AS composite_score
FROM employee_performance ep
JOIN employees e ON ep.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.department_id
JOIN branches b ON e.branch_id = b.branch_id
JOIN zones z ON b.zone_id = z.zone_id
JOIN regions r ON z.region_id = r.region_id
JOIN states s ON r.state_id = s.state_id;

-- Branch quarterly performance (aggregated from employee performance)
CREATE OR REPLACE VIEW vw_branch_quarterly_performance AS
SELECT
    b.branch_id,
    b.branch_name,
    b.branch_code,
    r.region_name,
    s.state_name,
    ep.financial_year,
    ep.quarter,
    COUNT(DISTINCT ep.employee_id) AS employees_evaluated,
    ROUND(AVG(ep.performance_score), 2) AS avg_performance_score,
    ROUND(AVG(ep.productivity_score), 2) AS avg_productivity_score,
    ROUND(AVG(ep.sales_score), 2) AS avg_sales_score,
    ROUND(AVG(ep.customer_service_score), 2) AS avg_customer_service_score
FROM employee_performance ep
JOIN employees e ON ep.employee_id = e.employee_id
JOIN branches b ON e.branch_id = b.branch_id
JOIN zones z ON b.zone_id = z.zone_id
JOIN regions r ON z.region_id = r.region_id
JOIN states s ON r.state_id = s.state_id
GROUP BY b.branch_id, b.branch_name, b.branch_code, r.region_name, s.state_name,
         ep.financial_year, ep.quarter;

-- Customer product summary
CREATE OR REPLACE VIEW vw_customer_product_summary AS
SELECT
    c.customer_id,
    c.customer_number,
    c.first_name || ' ' || c.last_name AS customer_name,
    COUNT(cp.customer_product_id) AS total_products,
    COUNT(cp.customer_product_id) FILTER (WHERE cp.status = 'ACTIVE') AS active_products,
    STRING_AGG(DISTINCT p.product_name, ', ' ORDER BY p.product_name)
        FILTER (WHERE cp.status = 'ACTIVE') AS active_product_list
FROM customers c
LEFT JOIN customer_products cp ON cp.customer_id = c.customer_id
LEFT JOIN products p ON cp.product_id = p.product_id
GROUP BY c.customer_id, c.customer_number, c.first_name, c.last_name;
