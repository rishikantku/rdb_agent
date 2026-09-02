-- ============================================================================
-- Reference / Lookup Data
-- Deterministic, static data used as FK targets
-- ============================================================================

-- STATES (20 major Indian states)
INSERT INTO states (state_name, state_code, capital, geographic_zone) VALUES
  ('Jharkhand',       'JH', 'Ranchi',         'EAST'),
  ('Bihar',           'BR', 'Patna',          'EAST'),
  ('West Bengal',     'WB', 'Kolkata',        'EAST'),
  ('Odisha',          'OR', 'Bhubaneswar',    'EAST'),
  ('Uttar Pradesh',   'UP', 'Lucknow',        'NORTH'),
  ('Delhi',           'DL', 'New Delhi',      'NORTH'),
  ('Rajasthan',       'RJ', 'Jaipur',         'NORTH'),
  ('Madhya Pradesh',  'MP', 'Bhopal',         'CENTRAL'),
  ('Chhattisgarh',    'CG', 'Raipur',         'CENTRAL'),
  ('Maharashtra',     'MH', 'Mumbai',         'WEST'),
  ('Gujarat',         'GJ', 'Gandhinagar',    'WEST'),
  ('Karnataka',       'KA', 'Bengaluru',      'SOUTH'),
  ('Tamil Nadu',      'TN', 'Chennai',        'SOUTH'),
  ('Telangana',       'TS', 'Hyderabad',      'SOUTH'),
  ('Kerala',          'KL', 'Thiruvananthapuram', 'SOUTH'),
  ('Andhra Pradesh',  'AP', 'Amaravati',      'SOUTH'),
  ('Punjab',          'PB', 'Chandigarh',     'NORTH'),
  ('Haryana',         'HR', 'Chandigarh',     'NORTH'),
  ('Assam',           'AS', 'Dispur',         'NORTHEAST'),
  ('Uttarakhand',     'UK', 'Dehradun',       'NORTH');

-- REGIONS (12 administrative regions)
INSERT INTO regions (region_name, region_code, state_id) VALUES
  ('Jharkhand Region',       'REG_JH', (SELECT state_id FROM states WHERE state_code='JH')),
  ('Bihar Region',           'REG_BR', (SELECT state_id FROM states WHERE state_code='BR')),
  ('Eastern Region',         'REG_ER', (SELECT state_id FROM states WHERE state_code='WB')),
  ('Odisha Region',          'REG_OR', (SELECT state_id FROM states WHERE state_code='OR')),
  ('UP Region',              'REG_UP', (SELECT state_id FROM states WHERE state_code='UP')),
  ('Delhi NCR Region',       'REG_DL', (SELECT state_id FROM states WHERE state_code='DL')),
  ('Central Region',         'REG_CR', (SELECT state_id FROM states WHERE state_code='MP')),
  ('Western Region',         'REG_WR', (SELECT state_id FROM states WHERE state_code='MH')),
  ('South Region',           'REG_SR', (SELECT state_id FROM states WHERE state_code='KA')),
  ('Rajasthan Region',       'REG_RJ', (SELECT state_id FROM states WHERE state_code='RJ')),
  ('Gujarat Region',         'REG_GJ', (SELECT state_id FROM states WHERE state_code='GJ')),
  ('Northeast Region',       'REG_NE', (SELECT state_id FROM states WHERE state_code='AS'));

-- DEPARTMENTS (13)
INSERT INTO departments (dept_name, dept_code, description) VALUES
  ('Information Technology', 'IT',   'IT infrastructure, development, and support'),
  ('Human Resources',        'HR',   'People management and administration'),
  ('Finance',                'FIN',  'Financial planning, accounting, and reporting'),
  ('Operations',             'OPS',  'Branch operations and processing'),
  ('Retail Banking',         'RET',  'Retail customer services and products'),
  ('Corporate Banking',      'COR',  'Corporate client relationship management'),
  ('Risk Management',        'RISK', 'Risk assessment and mitigation'),
  ('Audit',                  'AUD',  'Internal audit and compliance checking'),
  ('Compliance',             'CMP',  'Regulatory compliance and reporting'),
  ('Credit',                 'CRD',  'Credit appraisal and sanctioning'),
  ('Treasury',               'TRE',  'Treasury operations and investments'),
  ('Marketing',              'MKT',  'Marketing and customer acquisition'),
  ('Customer Service',       'CSR',  'Customer relationship and service management');

-- CUSTOMER SEGMENTS (5)
INSERT INTO customer_segments (segment_name, segment_code, min_balance, min_income, description) VALUES
  ('Mass',       'MASS',   0,        0,       'General retail customers'),
  ('Preferred',  'PREF',   100000,   500000,  'Higher balance customers'),
  ('Premium',    'PREM',   500000,   1500000, 'Premium banking customers'),
  ('HNI',        'HNI',    2500000,  5000000, 'High Net-worth Individuals'),
  ('Corporate',  'CORP',   0,        0,       'Corporate and institutional');

-- ACCOUNT TYPES (7)
INSERT INTO account_types (type_name, type_code, category, interest_rate, min_balance, description) VALUES
  ('Savings Account',       'SAV', 'DEPOSIT',    3.50,  1000,   'Regular savings account'),
  ('Current Account',       'CUR', 'DEPOSIT',    0.00,  10000,  'Current/checking account'),
  ('Salary Account',        'SAL', 'DEPOSIT',    3.50,  0,      'Zero-balance salary account'),
  ('Fixed Deposit',         'FD',  'DEPOSIT',    7.10,  10000,  'Fixed term deposit'),
  ('Recurring Deposit',     'RD',  'DEPOSIT',    6.50,  500,    'Monthly recurring deposit'),
  ('NRE Account',           'NRE', 'DEPOSIT',    3.50,  10000,  'Non-Resident External'),
  ('Overdraft Account',     'OD',  'LENDING',    10.50, 0,      'Overdraft facility');

-- TRANSACTION TYPES (12)
INSERT INTO transaction_types (type_name, type_code, category) VALUES
  ('Cash Deposit',       'CDEP', 'DEPOSIT'),
  ('Cash Withdrawal',    'CWTH', 'WITHDRAWAL'),
  ('Fund Transfer',      'TRFR', 'TRANSFER'),
  ('NEFT',               'NEFT', 'TRANSFER'),
  ('RTGS',               'RTGS', 'TRANSFER'),
  ('IMPS',               'IMPS', 'TRANSFER'),
  ('UPI',                'UPI',  'TRANSFER'),
  ('Cheque',             'CHEQ', 'TRANSFER'),
  ('Interest Credit',    'INTC', 'INTEREST'),
  ('Fee/Charge',         'FEE',  'FEE'),
  ('Loan Disbursement',  'LDIS', 'LOAN'),
  ('Loan Repayment',     'LREP', 'LOAN');

-- LOAN TYPES (6)
INSERT INTO loan_types (type_name, type_code, max_tenure_months, min_rate, max_rate, description) VALUES
  ('Home Loan',        'HL',  360, 8.50, 12.00, 'Housing and construction loans'),
  ('Personal Loan',    'PL',   60, 10.50, 18.00, 'Unsecured personal loans'),
  ('Vehicle Loan',     'VL',   84, 8.50, 14.00, 'Car and two-wheeler loans'),
  ('Education Loan',   'EL',  180, 8.00, 12.00, 'Student education loans'),
  ('Business Loan',    'BL',  120, 10.00, 16.00, 'MSME and business loans'),
  ('Agriculture Loan', 'AL',   60, 7.00, 11.00, 'Crop and farm loans');

-- PRODUCT CATEGORIES (5)
INSERT INTO product_categories (category_name, category_code, description) VALUES
  ('Deposit Products',    'DEP', 'Savings, FD, RD accounts'),
  ('Lending Products',    'LND', 'Loans and credit facilities'),
  ('Card Products',       'CRD', 'Debit and credit cards'),
  ('Insurance Products',  'INS', 'Life and general insurance'),
  ('Investment Products', 'INV', 'Mutual funds, bonds, securities');

-- PRODUCTS (10)
INSERT INTO products (product_name, product_code, category_id, is_active, launch_date, description) VALUES
  ('Savings Account',      'P_SAV',  (SELECT category_id FROM product_categories WHERE category_code='DEP'), TRUE,  '2015-01-01', 'Regular savings account product'),
  ('Fixed Deposit',        'P_FD',   (SELECT category_id FROM product_categories WHERE category_code='DEP'), TRUE,  '2015-01-01', 'Term deposit product'),
  ('Credit Card',          'P_CC',   (SELECT category_id FROM product_categories WHERE category_code='CRD'), TRUE,  '2016-04-01', 'Visa/Mastercard credit card'),
  ('Debit Card',           'P_DC',   (SELECT category_id FROM product_categories WHERE category_code='CRD'), TRUE,  '2015-01-01', 'Debit card with ATM access'),
  ('Home Loan',            'P_HL',   (SELECT category_id FROM product_categories WHERE category_code='LND'), TRUE,  '2015-01-01', 'Housing loan product'),
  ('Personal Loan',        'P_PL',   (SELECT category_id FROM product_categories WHERE category_code='LND'), TRUE,  '2015-06-01', 'Quick personal loan'),
  ('Vehicle Loan',         'P_VL',   (SELECT category_id FROM product_categories WHERE category_code='LND'), TRUE,  '2016-01-01', 'Car/bike loan'),
  ('Term Life Insurance',  'P_TLI',  (SELECT category_id FROM product_categories WHERE category_code='INS'), TRUE,  '2017-04-01', 'Term life insurance policy'),
  ('Mutual Fund SIP',      'P_MF',   (SELECT category_id FROM product_categories WHERE category_code='INV'), TRUE,  '2018-01-01', 'Monthly SIP investment'),
  ('Recurring Deposit',    'P_RD',   (SELECT category_id FROM product_categories WHERE category_code='DEP'), TRUE,  '2015-01-01', 'Monthly recurring deposit');
