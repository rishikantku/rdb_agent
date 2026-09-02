// ============================================================================
// Banking Schema Configuration
// ============================================================================
// Registers the comprehensive banking schema into the Schema Intelligence
// and Semantic Layer. This is the "knowledge base" that makes the system
// understand banking data without dumping the entire schema into every prompt.
//
// Designed for PostgreSQL. Oracle-compatible schema can be added later.
// ============================================================================

import {
  SchemaIntelligence,
} from '../schema/schema-intelligence.js';
import type {
  TableMetadata,
  Relationship,
  JoinPattern,
} from '../schema/schema-intelligence.js';
import {
  SemanticLayer,
} from '../schema/semantic-layer.js';
import type {
  BusinessTerm,
  AmbiguousTerm,
} from '../schema/semantic-layer.js';

// ---------------------------------------------------------------------------
// Register all tables, columns, relationships, and business definitions
// ---------------------------------------------------------------------------

export function configureBankingSchema(
  schemaIntelligence: SchemaIntelligence,
  semanticLayer: SemanticLayer
): void {
  registerTables(schemaIntelligence);
  registerRelationships(schemaIntelligence);
  registerJoinPatterns(schemaIntelligence);
  registerBusinessTerms(semanticLayer);
  registerAmbiguousTerms(semanticLayer);
  registerGlobalRules(semanticLayer);
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function registerTables(schema: SchemaIntelligence): void {

  schema.registerTable({
    name: 'states',
    type: 'table',
    description: 'Indian states and union territories',
    businessName: 'State',
    tags: ['geography', 'location'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false, description: 'State ID' },
      { name: 'state_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Name of the state', businessName: 'State Name' },
      { name: 'state_code', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'State code abbreviation' },
      { name: 'region', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Geographic region (North, South, East, West, Central, Northeast)', businessName: 'Region' },
    ],
  });

  schema.registerTable({
    name: 'districts',
    type: 'table',
    description: 'Districts within states',
    businessName: 'District',
    tags: ['geography', 'location'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'district_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'District name' },
      { name: 'state_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'states', column: 'id' } },
    ],
  });

  schema.registerTable({
    name: 'branches',
    type: 'table',
    description: 'Bank branches across India',
    businessName: 'Branch',
    tags: ['branch', 'location', 'operations'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'branch_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Branch name', businessName: 'Branch Name' },
      { name: 'branch_code', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Unique branch code' },
      { name: 'ifsc_code', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'IFSC code for the branch' },
      { name: 'district_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'districts', column: 'id' } },
      { name: 'address', dataType: 'text', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'branch_type', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Type: MAIN, BRANCH, EXTENSION_COUNTER, SATELLITE' },
      { name: 'established_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'is_active', dataType: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Whether branch is currently active' },
    ],
  });

  schema.registerTable({
    name: 'departments',
    type: 'table',
    description: 'Bank departments (HR, Operations, Lending, IT, etc.)',
    businessName: 'Department',
    tags: ['department', 'hr', 'organization'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'dept_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Department name', businessName: 'Department Name' },
      { name: 'dept_code', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'head_employee_id', dataType: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'employees', column: 'id' } },
    ],
  });

  schema.registerTable({
    name: 'designations',
    type: 'table',
    description: 'Employee designations/grades (Officer, Manager, DGM, GM, etc.)',
    businessName: 'Designation',
    tags: ['designation', 'hr', 'grade'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'designation_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Title: CLERK, OFFICER, SENIOR_OFFICER, MANAGER, SENIOR_MANAGER, CHIEF_MANAGER, AGM, DGM, GM, ED, CMD', businessName: 'Designation' },
      { name: 'grade', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Numeric grade (1=Clerk to 11=CMD)' },
      { name: 'pay_scale_min', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Minimum pay scale', sensitive: true },
      { name: 'pay_scale_max', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Maximum pay scale', sensitive: true },
    ],
  });

  schema.registerTable({
    name: 'employees',
    type: 'table',
    description: 'All bank employees — permanent, contractual, and deputation',
    businessName: 'Employee',
    tags: ['employee', 'hr', 'staff', 'personnel'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'employee_code', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Unique employee code' },
      { name: 'first_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'last_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'email', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'phone', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'date_of_birth', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'gender', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'M, F, O' },
      { name: 'branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'department_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'departments', column: 'id' } },
      { name: 'designation_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'designations', column: 'id' } },
      { name: 'employment_type', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'PERMANENT, CONTRACT, DEPUTATION', businessName: 'Employment Type' },
      { name: 'join_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Date of joining the bank', businessName: 'Joining Date' },
      { name: 'confirmation_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'retirement_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'status', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'ACTIVE, INACTIVE, RETIRED, TERMINATED, ON_LEAVE', businessName: 'Employee Status' },
      { name: 'basic_salary', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Monthly basic salary in INR', sensitive: true, businessName: 'Basic Salary' },
      { name: 'gross_salary', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Monthly gross salary in INR (basic + allowances)', sensitive: true, businessName: 'Gross Salary' },
      { name: 'reporting_to', dataType: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'employees', column: 'id' }, description: 'Reporting manager employee ID' },
    ],
  });

  schema.registerTable({
    name: 'salary_history',
    type: 'table',
    description: 'Monthly salary records for each employee',
    businessName: 'Salary History',
    tags: ['salary', 'hr', 'payroll', 'compensation'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'employee_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'employees', column: 'id' } },
      { name: 'month_year', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'First day of the month for this salary record' },
      { name: 'basic_pay', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'da', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Dearness Allowance', sensitive: true },
      { name: 'hra', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'House Rent Allowance', sensitive: true },
      { name: 'special_allowance', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'gross_pay', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'deductions', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'net_pay', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, sensitive: true },
    ],
  });

  schema.registerTable({
    name: 'transfers',
    type: 'table',
    description: 'Employee transfer records between branches',
    businessName: 'Transfer',
    tags: ['transfer', 'hr', 'mobility'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'employee_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'employees', column: 'id' } },
      { name: 'from_branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'to_branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'transfer_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'reason', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'PROMOTION, REQUEST, POLICY, DISCIPLINARY' },
      { name: 'order_number', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
  });

  schema.registerTable({
    name: 'employee_leave',
    type: 'table',
    description: 'Employee leave records',
    businessName: 'Leave Record',
    tags: ['leave', 'hr', 'attendance'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'employee_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'employees', column: 'id' } },
      { name: 'leave_type', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'CL, EL, SL, ML, STUDY, LWP' },
      { name: 'start_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'end_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'days', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'status', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'APPROVED, PENDING, REJECTED' },
    ],
  });

  schema.registerTable({
    name: 'customers',
    type: 'table',
    description: 'Bank customers',
    businessName: 'Customer',
    tags: ['customer', 'retail', 'business'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'first_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'last_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'email', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'phone', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'customer_type', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'INDIVIDUAL, CORPORATE, SME, GOVERNMENT' },
      { name: 'kyc_status', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'COMPLETE, PENDING, EXPIRED' },
      { name: 'branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'risk_category', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'LOW, MEDIUM, HIGH' },
      { name: 'created_at', dataType: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
    ],
  });

  schema.registerTable({
    name: 'accounts',
    type: 'table',
    description: 'Customer bank accounts',
    businessName: 'Account',
    tags: ['account', 'banking', 'deposits'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'customer_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'customers', column: 'id' } },
      { name: 'branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'account_number', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, sensitive: true },
      { name: 'account_type', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'SAVINGS, CURRENT, FD, RD' },
      { name: 'balance', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Current balance in INR', sensitive: true },
      { name: 'status', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'ACTIVE, DORMANT, CLOSED, FROZEN' },
      { name: 'opened_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'closed_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
  });

  schema.registerTable({
    name: 'transactions',
    type: 'table',
    description: 'Financial transactions on accounts',
    businessName: 'Transaction',
    tags: ['transaction', 'banking', 'payment'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'account_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'accounts', column: 'id' } },
      { name: 'transaction_type', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'CREDIT, DEBIT' },
      { name: 'amount', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'description', dataType: 'text', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'channel', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'BRANCH, ATM, NETBANKING, UPI, NEFT, RTGS, IMPS' },
      { name: 'transaction_date', dataType: 'timestamp', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'reference_number', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
  });

  schema.registerTable({
    name: 'loans',
    type: 'table',
    description: 'Loan accounts',
    businessName: 'Loan',
    tags: ['loan', 'lending', 'credit'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'customer_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'customers', column: 'id' } },
      { name: 'branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'loan_type', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'HOME, VEHICLE, PERSONAL, EDUCATION, AGRICULTURE, MSME, GOLD' },
      { name: 'principal_amount', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'interest_rate', dataType: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'tenure_months', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'disbursement_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'maturity_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'outstanding_amount', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'status', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'ACTIVE, CLOSED, NPA, WRITTEN_OFF' },
      { name: 'npa_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Date when loan became NPA' },
    ],
  });

  schema.registerTable({
    name: 'performance_metrics',
    type: 'table',
    description: 'Quarterly performance metrics for branches',
    businessName: 'Branch Performance',
    tags: ['performance', 'metrics', 'branch', 'kpi'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'branch_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'branches', column: 'id' } },
      { name: 'quarter', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Quarter: Q1, Q2, Q3, Q4 of fiscal year' },
      { name: 'fiscal_year', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Fiscal year (e.g. 2023 means FY 2023-24)' },
      { name: 'total_deposits', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'total_advances', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'npa_ratio', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'NPA as percentage of total advances' },
      { name: 'profit_loss', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'customer_count', dataType: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'employee_count', dataType: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'attrition_count', dataType: 'integer', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'Number of employees who left this quarter' },
    ],
  });

  schema.registerTable({
    name: 'training_records',
    type: 'table',
    description: 'Employee training and certification records',
    businessName: 'Training Record',
    tags: ['training', 'hr', 'development'],
    columns: [
      { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'employee_id', dataType: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true, foreignKeyRef: { table: 'employees', column: 'id' } },
      { name: 'training_name', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'training_type', dataType: 'varchar', nullable: true, isPrimaryKey: false, isForeignKey: false, description: 'MANDATORY, ELECTIVE, CERTIFICATION' },
      { name: 'start_date', dataType: 'date', nullable: false, isPrimaryKey: false, isForeignKey: false },
      { name: 'end_date', dataType: 'date', nullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'status', dataType: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'COMPLETED, IN_PROGRESS, CANCELLED' },
      { name: 'score', dataType: 'numeric', nullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
  });
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

function registerRelationships(schema: SchemaIntelligence): void {
  const rels: Relationship[] = [
    { fromTable: 'districts', fromColumn: 'state_id', toTable: 'states', toColumn: 'id', type: 'many-to-one', description: 'District belongs to a state' },
    { fromTable: 'branches', fromColumn: 'district_id', toTable: 'districts', toColumn: 'id', type: 'many-to-one', description: 'Branch is located in a district' },
    { fromTable: 'employees', fromColumn: 'branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one', description: 'Employee is posted at a branch' },
    { fromTable: 'employees', fromColumn: 'department_id', toTable: 'departments', toColumn: 'id', type: 'many-to-one', description: 'Employee belongs to a department' },
    { fromTable: 'employees', fromColumn: 'designation_id', toTable: 'designations', toColumn: 'id', type: 'many-to-one', description: 'Employee has a designation/grade' },
    { fromTable: 'employees', fromColumn: 'reporting_to', toTable: 'employees', toColumn: 'id', type: 'many-to-one', description: 'Employee reports to another employee (self-referential)' },
    { fromTable: 'salary_history', fromColumn: 'employee_id', toTable: 'employees', toColumn: 'id', type: 'many-to-one', description: 'Salary record belongs to an employee' },
    { fromTable: 'transfers', fromColumn: 'employee_id', toTable: 'employees', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'transfers', fromColumn: 'from_branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'transfers', fromColumn: 'to_branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'employee_leave', fromColumn: 'employee_id', toTable: 'employees', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'customers', fromColumn: 'branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one', description: 'Customer home branch' },
    { fromTable: 'accounts', fromColumn: 'customer_id', toTable: 'customers', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'accounts', fromColumn: 'branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'transactions', fromColumn: 'account_id', toTable: 'accounts', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'loans', fromColumn: 'customer_id', toTable: 'customers', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'loans', fromColumn: 'branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'performance_metrics', fromColumn: 'branch_id', toTable: 'branches', toColumn: 'id', type: 'many-to-one' },
    { fromTable: 'training_records', fromColumn: 'employee_id', toTable: 'employees', toColumn: 'id', type: 'many-to-one' },
  ];

  for (const rel of rels) {
    schema.registerRelationship(rel);
  }
}

// ---------------------------------------------------------------------------
// Common Join Patterns
// ---------------------------------------------------------------------------

function registerJoinPatterns(schema: SchemaIntelligence): void {
  schema.registerJoinPattern({
    name: 'Employee with Branch and Location',
    description: 'Get employee details with their branch, district, and state',
    tables: ['employees', 'branches', 'districts', 'states'],
    joinClause: 'employees e JOIN branches b ON e.branch_id = b.id JOIN districts d ON b.district_id = d.id JOIN states s ON d.state_id = s.id',
    useCases: ['employee listing with location', 'state-wise employee analysis', 'branch-wise employee count'],
  });

  schema.registerJoinPattern({
    name: 'Employee with Department and Designation',
    description: 'Get employee details with department and designation/grade info',
    tables: ['employees', 'departments', 'designations'],
    joinClause: 'employees e JOIN departments dept ON e.department_id = dept.id JOIN designations des ON e.designation_id = des.id',
    useCases: ['department-wise analysis', 'designation distribution', 'grade-wise salary analysis'],
  });

  schema.registerJoinPattern({
    name: 'Employee Full Profile',
    description: 'Complete employee profile with branch, department, designation, and location',
    tables: ['employees', 'branches', 'departments', 'designations', 'districts', 'states'],
    joinClause: 'employees e JOIN branches b ON e.branch_id = b.id JOIN departments dept ON e.department_id = dept.id JOIN designations des ON e.designation_id = des.id JOIN districts d ON b.district_id = d.id JOIN states s ON d.state_id = s.id',
    useCases: ['comprehensive employee reports'],
  });

  schema.registerJoinPattern({
    name: 'Branch Performance with Location',
    description: 'Branch performance metrics with geographic context',
    tables: ['performance_metrics', 'branches', 'districts', 'states'],
    joinClause: 'performance_metrics pm JOIN branches b ON pm.branch_id = b.id JOIN districts d ON b.district_id = d.id JOIN states s ON d.state_id = s.id',
    useCases: ['branch performance by state', 'regional performance comparison'],
  });

  schema.registerJoinPattern({
    name: 'Customer with Accounts',
    description: 'Customer details with their account information',
    tables: ['customers', 'accounts'],
    joinClause: 'customers c JOIN accounts a ON c.id = a.customer_id',
    useCases: ['customer account summary', 'balance analysis'],
  });

  schema.registerJoinPattern({
    name: 'Loan Portfolio Analysis',
    description: 'Loan details with customer and branch information',
    tables: ['loans', 'customers', 'branches'],
    joinClause: 'loans l JOIN customers c ON l.customer_id = c.id JOIN branches b ON l.branch_id = b.id',
    useCases: ['loan portfolio', 'NPA analysis', 'disbursement analysis'],
  });
}

// ---------------------------------------------------------------------------
// Business Terms
// ---------------------------------------------------------------------------

function registerBusinessTerms(semantic: SemanticLayer): void {
  const terms: BusinessTerm[] = [
    // Employee terms
    {
      term: 'employee',
      aliases: ['employees', 'staff', 'personnel', 'workforce', 'manpower'],
      description: 'A person employed by the bank. Stored in the employees table.',
      mapping: { type: 'table', table: 'employees' },
    },
    {
      term: 'active employee',
      aliases: ['active employees', 'current employees', 'working employees'],
      description: 'An employee whose current status is ACTIVE.',
      mapping: { type: 'filter', table: 'employees', condition: "status = 'ACTIVE'" },
    },
    {
      term: 'contractual employee',
      aliases: ['contractual employees', 'contract employee', 'contract staff', 'outsourced'],
      description: 'An employee with employment_type = CONTRACT.',
      mapping: { type: 'filter', table: 'employees', condition: "employment_type = 'CONTRACT'" },
    },
    {
      term: 'permanent employee',
      aliases: ['permanent employees', 'regular employee', 'regular employees'],
      description: 'An employee with employment_type = PERMANENT.',
      mapping: { type: 'filter', table: 'employees', condition: "employment_type = 'PERMANENT'" },
    },
    {
      term: 'deputation',
      aliases: ['on deputation', 'deputed employees'],
      description: 'An employee with employment_type = DEPUTATION.',
      mapping: { type: 'filter', table: 'employees', condition: "employment_type = 'DEPUTATION'" },
    },
    {
      term: 'employee strength',
      aliases: ['headcount', 'staff count', 'employee count', 'total employees', 'manpower strength'],
      description: 'Count of employees, typically active employees.',
      mapping: { type: 'calculated', expression: "COUNT(DISTINCT e.id) WHERE e.status = 'ACTIVE'", description: 'Count of active employees' },
    },
    {
      term: 'average salary',
      aliases: ['avg salary', 'mean salary'],
      description: 'Average gross salary of employees.',
      mapping: { type: 'calculated', expression: 'AVG(e.gross_salary)', description: 'Average gross monthly salary' },
    },
    // Attrition
    {
      term: 'attrition',
      aliases: ['employee attrition', 'turnover', 'employee turnover', 'resignation'],
      description: 'Employees who left the bank (status changed to TERMINATED or RETIRED).',
      mapping: {
        type: 'concept',
        definition: 'Attrition refers to employees whose status is TERMINATED or RETIRED. Attrition count for a period = employees whose status changed to TERMINATED or RETIRED during that period. Can also be measured via performance_metrics.attrition_count for quarterly data.',
        relatedTables: ['employees', 'performance_metrics'],
        relatedColumns: ['employees.status', 'performance_metrics.attrition_count'],
        rules: [
          "Attrition includes status = 'TERMINATED' or 'RETIRED'",
          'For quarterly attrition trends, prefer performance_metrics.attrition_count',
        ],
      },
    },
    // Financial Year
    {
      term: 'financial year',
      aliases: ['fiscal year', 'fy', 'financial yr'],
      description: 'Indian financial year runs from April 1 to March 31. FY 2023-24 means April 1, 2023 to March 31, 2024.',
      mapping: {
        type: 'concept',
        definition: 'Indian financial year (FY) starts April 1 and ends March 31. FY 2023-24 is April 1 2023 to March 31 2024. To calculate the FY from a date: if month >= 4, FY = year; else FY = year - 1.',
        relatedTables: [],
        relatedColumns: [],
        rules: [
          'FY 2023-24: April 1 2023 to March 31 2024',
          'To get FY from a date: CASE WHEN EXTRACT(MONTH FROM date_col) >= 4 THEN EXTRACT(YEAR FROM date_col) ELSE EXTRACT(YEAR FROM date_col) - 1 END',
          "performance_metrics.fiscal_year stores the FY start year (e.g., 2023 for FY 2023-24)",
        ],
      },
    },
    {
      term: 'previous financial year',
      aliases: ['last financial year', 'previous fy', 'last fy', 'prior year'],
      description: 'The financial year immediately before the current one.',
      mapping: {
        type: 'concept',
        definition: 'The financial year immediately preceding the current one. If current FY is 2024-25 (starting April 2024), previous FY is 2023-24 (April 2023 to March 2024).',
        relatedTables: [],
        relatedColumns: [],
        rules: ['Previous FY = Current FY start year - 1'],
      },
    },
    // Branch terms
    {
      term: 'branch',
      aliases: ['branches', 'bank branch', 'office'],
      description: 'A physical bank branch office.',
      mapping: { type: 'table', table: 'branches' },
    },
    // NPA
    {
      term: 'npa',
      aliases: ['non-performing asset', 'non performing asset', 'bad loan', 'bad loans'],
      description: 'Non-Performing Asset — a loan where repayment is overdue.',
      mapping: { type: 'filter', table: 'loans', condition: "status = 'NPA'" },
    },
    {
      term: 'npa ratio',
      aliases: ['npa percentage', 'gross npa'],
      description: 'Ratio of NPAs to total advances, expressed as a percentage.',
      mapping: { type: 'column', table: 'performance_metrics', column: 'npa_ratio' },
    },
    // Customer
    {
      term: 'customer',
      aliases: ['customers', 'client', 'clients', 'account holder', 'account holders'],
      description: 'A customer of the bank.',
      mapping: { type: 'table', table: 'customers' },
    },
    // Salary
    {
      term: 'salary',
      aliases: ['pay', 'compensation', 'remuneration', 'emoluments'],
      description: 'Employee salary. Current salary is in employees.gross_salary. Historical salary records are in salary_history.',
      mapping: {
        type: 'concept',
        definition: 'Salary refers to employee compensation. employees.basic_salary is the basic pay; employees.gross_salary includes allowances. salary_history has monthly breakdown with basic_pay, da, hra, special_allowance, gross_pay, deductions, net_pay.',
        relatedTables: ['employees', 'salary_history'],
        relatedColumns: ['employees.basic_salary', 'employees.gross_salary', 'salary_history.gross_pay', 'salary_history.net_pay'],
        rules: [
          'For current salary analysis, use employees.gross_salary',
          'For historical salary trends, use salary_history',
          'Average salary typically means AVG(gross_salary)',
        ],
      },
    },
    // Loan types
    {
      term: 'home loan',
      aliases: ['housing loan', 'mortgage'],
      description: 'Loan for purchase/construction of house.',
      mapping: { type: 'filter', table: 'loans', condition: "loan_type = 'HOME'" },
    },
    {
      term: 'loan disbursement',
      aliases: ['disbursement', 'loan disbursal'],
      description: 'The act of releasing loan funds to the borrower.',
      mapping: { type: 'column', table: 'loans', column: 'disbursement_date' },
    },
    // Deposits
    {
      term: 'deposits',
      aliases: ['total deposits', 'deposit base'],
      description: 'Total deposits held at a branch or the bank. Available in performance_metrics.total_deposits.',
      mapping: { type: 'column', table: 'performance_metrics', column: 'total_deposits' },
    },
    // Advances
    {
      term: 'advances',
      aliases: ['total advances', 'credit portfolio', 'lending portfolio'],
      description: 'Total advances (loans) from a branch. Available in performance_metrics.total_advances.',
      mapping: { type: 'column', table: 'performance_metrics', column: 'total_advances' },
    },
    // Designation terms
    {
      term: 'officer',
      aliases: ['officers'],
      description: 'Employees with designation OFFICER.',
      mapping: { type: 'filter', table: 'designations', condition: "designation_name = 'OFFICER'" },
    },
    {
      term: 'manager',
      aliases: ['managers'],
      description: 'Employees with designation MANAGER.',
      mapping: { type: 'filter', table: 'designations', condition: "designation_name = 'MANAGER'" },
    },
    // Region
    {
      term: 'region',
      aliases: ['zone', 'geographic region'],
      description: 'Geographic region: North, South, East, West, Central, Northeast.',
      mapping: { type: 'column', table: 'states', column: 'region' },
    },
  ];

  for (const term of terms) {
    semantic.registerTerm(term);
  }
}

// ---------------------------------------------------------------------------
// Ambiguous Terms
// ---------------------------------------------------------------------------

function registerAmbiguousTerms(semantic: SemanticLayer): void {
  semantic.registerAmbiguousTerm({
    term: 'performance',
    possibleMeanings: [
      {
        label: 'Branch Business Performance',
        description: 'Deposits, advances, profit/loss, NPA ratio from performance_metrics table.',
        mapping: { type: 'table', table: 'performance_metrics' },
      },
      {
        label: 'Employee Productivity',
        description: 'Employee count, attrition, workload per branch.',
        mapping: {
          type: 'concept',
          definition: 'Employee productivity measured by business volume per employee',
          relatedTables: ['employees', 'performance_metrics'],
          relatedColumns: [],
          rules: [],
        },
      },
      {
        label: 'Loan Performance',
        description: 'Loan repayment status, NPA classification.',
        mapping: { type: 'table', table: 'loans' },
      },
    ],
  });

  semantic.registerAmbiguousTerm({
    term: 'branch performance',
    possibleMeanings: [
      {
        label: 'Financial Performance (Deposits & Advances)',
        description: 'Deposits, advances, profit/loss from performance_metrics table.',
        mapping: { type: 'table', table: 'performance_metrics' },
      },
      {
        label: 'Employee Metrics',
        description: 'Employee count, attrition, and salary cost at the branch.',
        mapping: {
          type: 'concept',
          definition: 'Employee-related performance at a branch',
          relatedTables: ['employees', 'branches'],
          relatedColumns: [],
          rules: [],
        },
      },
      {
        label: 'Loan Portfolio Quality',
        description: 'NPA ratio, loan disbursement, recovery at the branch.',
        mapping: { type: 'table', table: 'loans' },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Global Rules
// ---------------------------------------------------------------------------

function registerGlobalRules(semantic: SemanticLayer): void {
  semantic.registerGlobalRule('Indian financial year runs April 1 to March 31. FY 2023-24 = April 1 2023 to March 31 2024.');
  semantic.registerGlobalRule('When filtering by state (e.g. "Jharkhand"), join through branches → districts → states.');
  semantic.registerGlobalRule('Employee "salary" without qualifier means gross_salary from the employees table.');
  semantic.registerGlobalRule('When counting employees, default to status = ACTIVE unless explicitly stated otherwise.');
  semantic.registerGlobalRule('Amounts are in Indian Rupees (INR). Large values should be shown as lakhs or crores where appropriate.');
  semantic.registerGlobalRule('"Joined after April 2020" means join_date > \'2020-04-01\'.');
  semantic.registerGlobalRule('"Excluding contractual employees" means employment_type != \'CONTRACT\'.');
}
