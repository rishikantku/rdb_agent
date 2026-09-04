// ============================================================================
// Regulatory Data Quality — Synthetic Mock Data
// ============================================================================
// Creates realistic banking data with DELIBERATE quality issues to demonstrate
// the platform's detection capabilities. Every issue here is intentionally
// planted so the DQ engine can identify and surface it.
//
// Data Landscape:
//   - 4 quarters of historical data (FY2025-26: Q1→Q4)
//   - Current period: Q4 FY2025-26
//   - Deliberate accuracy, completeness, consistency, and timeliness issues
//   - 12 regions, ~150 branches
// ============================================================================

import type {
  DQRule, DQRuleExecution, DQException, ScoringConfig, ScoreResult,
  DimensionScore, TrendDataPoint, ReportDefinition, RegulatoryReport,
  ReconciliationResult, ReconciliationBranchDetail, AuditEvent,
  DQDimension, Severity, WorkflowState,
} from './types.js';
import { getReadinessStatus } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 1000;
function nextId(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// DQ Rules (25 pre-configured with deliberate failures)
// ---------------------------------------------------------------------------

export const MOCK_DQ_RULES: DQRule[] = [
  // ===== ACCURACY (7 rules) =====
  {
    ruleId: 'DQ-001', ruleName: 'Advances Balance Reconciliation',
    description: 'Regulatory advances balance must match CBS advances balance within tolerance',
    dimension: 'accuracy', severity: 'critical', source: 'CBS',
    targetData: 'regulatory_advances', validationLogic: 'ABS(reg_advances - cbs_advances) / cbs_advances <= threshold',
    threshold: 0.001, exceptionMessage: 'Advances balance mismatch between CBS and regulatory dataset',
    owner: 'Finance', resolution: 'Reconcile advances between CBS and regulatory data warehouse, identify missing or duplicate entries',
    isActive: true, applicableReports: ['ADV-001', 'BSR-001'],
  },
  {
    ruleId: 'DQ-002', ruleName: 'Deposit Balance Reconciliation',
    description: 'Regulatory deposit totals must match CBS deposit totals',
    dimension: 'accuracy', severity: 'critical', source: 'CBS',
    targetData: 'regulatory_deposits', validationLogic: 'ABS(reg_deposits - cbs_deposits) / cbs_deposits <= threshold',
    threshold: 0.001, exceptionMessage: 'Deposit balance mismatch between CBS and regulatory dataset',
    owner: 'Finance', resolution: 'Reconcile deposit accounts between CBS and regulatory reporting layer',
    isActive: true, applicableReports: ['DEP-001', 'BSR-001'],
  },
  {
    ruleId: 'DQ-003', ruleName: 'NPA Classification Accuracy',
    description: 'NPA amounts must match the asset classification in CBS',
    dimension: 'accuracy', severity: 'high', source: 'CBS',
    targetData: 'npa_classification', validationLogic: 'reg_npa_amount == cbs_npa_amount per category',
    threshold: 0, exceptionMessage: 'NPA classification amounts do not match CBS asset classification',
    owner: 'Risk', resolution: 'Review NPA classification logic and reconcile with CBS asset quality module',
    isActive: true, applicableReports: ['NPA-001'],
  },
  {
    ruleId: 'DQ-004', ruleName: 'GL Balance Reconciliation',
    description: 'GL trial balance must match regulatory reporting totals',
    dimension: 'accuracy', severity: 'high', source: 'GL',
    targetData: 'gl_trial_balance', validationLogic: 'ABS(reg_total - gl_total) <= threshold',
    threshold: 0.0005, exceptionMessage: 'GL trial balance does not match regulatory totals',
    owner: 'Finance', resolution: 'Review GL posting entries and regulatory mapping tables',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-005', ruleName: 'Branch-Level Loan Totals',
    description: 'Sum of branch-level loan amounts must equal total advances',
    dimension: 'accuracy', severity: 'medium', source: 'CBS',
    targetData: 'branch_loan_totals', validationLogic: 'SUM(branch_loans) == total_advances',
    threshold: 0, exceptionMessage: 'Branch-level loan totals do not sum to total advances',
    owner: 'Finance', resolution: 'Check for unmapped branches or double-counted loans',
    isActive: true, applicableReports: ['ADV-001'],
  },
  {
    ruleId: 'DQ-006', ruleName: 'Interest Income Accuracy',
    description: 'Reported interest income must match GL interest income heads',
    dimension: 'accuracy', severity: 'medium', source: 'GL',
    targetData: 'interest_income', validationLogic: 'ABS(reg_interest - gl_interest) / gl_interest <= threshold',
    threshold: 0.005, exceptionMessage: 'Interest income mismatch between regulatory data and GL',
    owner: 'Finance', resolution: 'Review interest accrual calculations and GL mapping',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-007', ruleName: 'Customer Count Accuracy',
    description: 'Regulatory customer count must match CBS active customer count',
    dimension: 'accuracy', severity: 'low', source: 'CBS',
    targetData: 'customer_count', validationLogic: 'ABS(reg_customers - cbs_customers) <= threshold',
    threshold: 10, exceptionMessage: 'Customer count discrepancy between regulatory dataset and CBS',
    owner: 'Operations', resolution: 'Verify customer deduplication logic and active status filters',
    isActive: true, applicableReports: ['BSR-001'],
  },

  // ===== COMPLETENESS (7 rules) =====
  {
    ruleId: 'DQ-008', ruleName: 'Customer Classification Completeness',
    description: 'All customers must have a valid classification (segment) assigned',
    dimension: 'completeness', severity: 'high', source: 'CBS',
    targetData: 'customer_segments', validationLogic: 'COUNT(NULL segment) / COUNT(*) <= threshold',
    threshold: 0, exceptionMessage: 'Customer classification (segment) is missing for some records',
    owner: 'Operations', resolution: 'Update customer master data with appropriate segment classification',
    isActive: true, applicableReports: ['BSR-001', 'ADV-001'],
  },
  {
    ruleId: 'DQ-009', ruleName: 'Risk Category Completeness',
    description: 'All loan accounts must have a risk category assigned',
    dimension: 'completeness', severity: 'high', source: 'CBS',
    targetData: 'loan_risk_category', validationLogic: 'COUNT(NULL risk_category) == 0',
    threshold: 0, exceptionMessage: 'Risk category is missing for loan accounts',
    owner: 'Risk', resolution: 'Run risk classification engine for unclassified accounts',
    isActive: true, applicableReports: ['NPA-001', 'ADV-001'],
  },
  {
    ruleId: 'DQ-010', ruleName: 'Branch Data Completeness',
    description: 'All active branches must submit data for the reporting period',
    dimension: 'completeness', severity: 'critical', source: 'Branch Systems',
    targetData: 'branch_submissions', validationLogic: 'COUNT(branches_with_data) == COUNT(active_branches)',
    threshold: 0, exceptionMessage: 'Some active branches have not submitted data for the reporting period',
    owner: 'Regional Ops', resolution: 'Follow up with branches that have not submitted data feeds',
    isActive: true, applicableReports: ['BSR-001', 'ADV-001', 'DEP-001'],
  },
  {
    ruleId: 'DQ-011', ruleName: 'KYC Fields Completeness',
    description: 'Critical KYC fields (PAN, Aadhaar, occupation) must not be NULL for active customers',
    dimension: 'completeness', severity: 'medium', source: 'CBS',
    targetData: 'customer_kyc', validationLogic: 'COUNT(NULL critical_kyc_fields) == 0',
    threshold: 0, exceptionMessage: 'KYC fields are incomplete for active customers',
    owner: 'Compliance', resolution: 'Initiate KYC update campaign for affected customers',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-012', ruleName: 'Collateral Data Completeness',
    description: 'Secured loans must have collateral details populated',
    dimension: 'completeness', severity: 'medium', source: 'Loan Systems',
    targetData: 'loan_collateral', validationLogic: 'secured_loans_without_collateral == 0',
    threshold: 0, exceptionMessage: 'Collateral information is missing for secured loans',
    owner: 'Credit', resolution: 'Update collateral records from physical files and valuation reports',
    isActive: true, applicableReports: ['ADV-001'],
  },
  {
    ruleId: 'DQ-013', ruleName: 'Account Opening Date Completeness',
    description: 'All accounts must have a valid opening date',
    dimension: 'completeness', severity: 'low', source: 'CBS',
    targetData: 'account_opening_date', validationLogic: 'COUNT(NULL opening_date) == 0',
    threshold: 0, exceptionMessage: 'Account opening date is missing for some accounts',
    owner: 'Operations', resolution: 'Backfill opening dates from legacy records',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-014', ruleName: 'Reporting Population Coverage',
    description: 'All required reporting populations must be covered in the submission',
    dimension: 'completeness', severity: 'high', source: 'Regulatory Data Warehouse',
    targetData: 'reporting_populations', validationLogic: 'covered_populations == required_populations',
    threshold: 0, exceptionMessage: 'Some required reporting populations are not covered',
    owner: 'Regulatory Reporting', resolution: 'Identify missing population segments and include in data extract',
    isActive: true, applicableReports: ['BSR-001'],
  },

  // ===== CONSISTENCY (6 rules) =====
  {
    ruleId: 'DQ-015', ruleName: 'CBS vs MIS Advances Consistency',
    description: 'Total advances in MIS must match CBS within tolerance',
    dimension: 'consistency', severity: 'critical', source: 'CBS/MIS',
    targetData: 'cbs_mis_advances', validationLogic: 'ABS(cbs_advances - mis_advances) / cbs_advances <= threshold',
    threshold: 0.001, exceptionMessage: 'CBS and MIS advances totals are inconsistent',
    owner: 'IT', resolution: 'Investigate ETL pipeline between CBS and MIS, check for timing differences',
    isActive: true, applicableReports: ['ADV-001'],
  },
  {
    ruleId: 'DQ-016', ruleName: 'Regulatory vs CBS Deposit Consistency',
    description: 'Regulatory deposit data must be consistent with CBS deposits',
    dimension: 'consistency', severity: 'high', source: 'CBS/Regulatory',
    targetData: 'reg_cbs_deposits', validationLogic: 'ABS(reg_deposits - cbs_deposits) / cbs_deposits <= threshold',
    threshold: 0.001, exceptionMessage: 'Regulatory deposit data is inconsistent with CBS',
    owner: 'Finance', resolution: 'Check data extraction timing and reconcile differences',
    isActive: true, applicableReports: ['DEP-001'],
  },
  {
    ruleId: 'DQ-017', ruleName: 'Branch vs Regional Totals',
    description: 'Sum of branch-level data must equal regional aggregates',
    dimension: 'consistency', severity: 'high', source: 'Regulatory Data Warehouse',
    targetData: 'branch_regional_totals', validationLogic: 'SUM(branch_totals) == regional_total for each region',
    threshold: 0, exceptionMessage: 'Branch totals do not reconcile with regional aggregates',
    owner: 'IT', resolution: 'Verify aggregation logic and check for unmapped branches',
    isActive: true, applicableReports: ['BSR-001', 'ADV-001'],
  },
  {
    ruleId: 'DQ-018', ruleName: 'Loan System vs CBS Consistency',
    description: 'Loan system outstanding must be consistent with CBS loan ledger',
    dimension: 'consistency', severity: 'high', source: 'Loan System/CBS',
    targetData: 'loan_cbs_consistency', validationLogic: 'ABS(loan_sys - cbs_loans) / cbs_loans <= threshold',
    threshold: 0.002, exceptionMessage: 'Loan system data is inconsistent with CBS loan ledger',
    owner: 'IT', resolution: 'Review loan system integration and data sync frequency',
    isActive: true, applicableReports: ['ADV-001'],
  },
  {
    ruleId: 'DQ-019', ruleName: 'Customer System Cross-Check',
    description: 'Customer data in regulatory dataset must match customer master in CBS',
    dimension: 'consistency', severity: 'medium', source: 'CBS/CRM',
    targetData: 'customer_cross_check', validationLogic: 'customer_mismatches == 0',
    threshold: 0, exceptionMessage: 'Customer data inconsistencies between CBS and CRM',
    owner: 'Operations', resolution: 'Sync customer master data across systems',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-020', ruleName: 'Interest Rate Consistency',
    description: 'Loan interest rates in regulatory data must match product master rates',
    dimension: 'consistency', severity: 'medium', source: 'Product Master/CBS',
    targetData: 'interest_rate_consistency', validationLogic: 'loans_with_rate_mismatch == 0',
    threshold: 0, exceptionMessage: 'Loan interest rates do not match product master rates',
    owner: 'Treasury', resolution: 'Update interest rate mapping and verify product master',
    isActive: true, applicableReports: ['ADV-001'],
  },

  // ===== TIMELINESS (5 rules) =====
  {
    ruleId: 'DQ-021', ruleName: 'Branch Data Feed Timeliness',
    description: 'Branch data feeds must arrive within the defined cutoff time',
    dimension: 'timeliness', severity: 'high', source: 'Branch Systems',
    targetData: 'branch_feed_arrival', validationLogic: 'feed_arrival_time <= cutoff_time',
    threshold: 0, exceptionMessage: 'Branch data feeds arrived after the defined cutoff time',
    owner: 'Regional Ops', resolution: 'Investigate branch connectivity issues and automate feed submission',
    isActive: true, applicableReports: ['BSR-001', 'ADV-001', 'DEP-001'],
  },
  {
    ruleId: 'DQ-022', ruleName: 'CBS Data Extraction Timeliness',
    description: 'CBS data extraction must complete within the ETL window',
    dimension: 'timeliness', severity: 'medium', source: 'CBS',
    targetData: 'cbs_extraction_time', validationLogic: 'extraction_completion_time <= etl_window_end',
    threshold: 0, exceptionMessage: 'CBS data extraction exceeded the ETL processing window',
    owner: 'IT', resolution: 'Optimize ETL queries or extend processing window',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-023', ruleName: 'Data Correction Timeliness',
    description: 'Data corrections must be applied before the reporting deadline',
    dimension: 'timeliness', severity: 'high', source: 'Regulatory Data Warehouse',
    targetData: 'correction_timeliness', validationLogic: 'corrections_applied_before_deadline',
    threshold: 0, exceptionMessage: 'Data corrections were not applied before the reporting deadline',
    owner: 'Regulatory Reporting', resolution: 'Prioritize correction processing and track SLAs',
    isActive: true, applicableReports: ['BSR-001', 'ADV-001', 'DEP-001'],
  },
  {
    ruleId: 'DQ-024', ruleName: 'Source Data Freshness',
    description: 'Source data must not be stale (older than the defined maximum age)',
    dimension: 'timeliness', severity: 'medium', source: 'Multiple',
    targetData: 'data_freshness', validationLogic: 'data_age_hours <= max_allowed_age',
    threshold: 24, exceptionMessage: 'Source data is stale — exceeds the maximum allowed age',
    owner: 'IT', resolution: 'Trigger data refresh from source systems',
    isActive: true, applicableReports: ['BSR-001'],
  },
  {
    ruleId: 'DQ-025', ruleName: 'Submission Deadline Compliance',
    description: 'All required reports must be ready before the submission deadline',
    dimension: 'timeliness', severity: 'critical', source: 'Regulatory Reporting',
    targetData: 'submission_readiness', validationLogic: 'report_ready_time <= submission_deadline',
    threshold: 0, exceptionMessage: 'Reports are not ready before the submission deadline',
    owner: 'Regulatory Reporting', resolution: 'Escalate pending validations and approvals',
    isActive: true, applicableReports: ['BSR-001', 'ADV-001', 'DEP-001', 'NPA-001'],
  },
];

// ---------------------------------------------------------------------------
// Rule Executions — Current Period (Q4 FY2025-26)
// Deliberate failures planted for demo
// ---------------------------------------------------------------------------

export const MOCK_RULE_EXECUTIONS: DQRuleExecution[] = [
  // DQ-001: FAIL — ₹42.6 Cr advances mismatch (the flagship demo exception)
  {
    executionId: nextId('EX'), ruleId: 'DQ-001', rule: MOCK_DQ_RULES[0],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 846800, expectedValue: 842600, difference: 4260, deviationPct: 0.503,
    affectedRecords: 1847, affectedBranches: [
      'Ranchi Main', 'Bokaro Branch', 'Dhanbad Main', 'Jamshedpur Central', 'Patna Main',
      'Gaya Branch', 'Muzaffarpur Main', 'Kolkata Central', 'Howrah Branch', 'Siliguri Main',
      'Bhubaneswar Main', 'Lucknow Central', 'Varanasi Main', 'Delhi Central Main',
      'Mumbai Main', 'Pune Central', 'Bengaluru Main', 'Chennai Central',
      'Ahmedabad Main', 'Jaipur Main', 'Bhopal Central', 'Indore Main', 'Raipur Main',
    ],
    durationMs: 2340, details: 'CBS total advances: ₹8,468.00 Cr | Regulatory dataset: ₹8,426.00 Cr | Difference: ₹42.6 Cr across 23 branches',
  },
  // DQ-002: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-002', rule: MOCK_DQ_RULES[1],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 1245600, expectedValue: 1245600, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 1890, details: 'Deposit balances match within tolerance',
  },
  // DQ-003: FAIL — NPA classification mismatch
  {
    executionId: nextId('EX'), ruleId: 'DQ-003', rule: MOCK_DQ_RULES[2],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 312.4, expectedValue: 298.7, difference: 13.7, deviationPct: 4.39,
    affectedRecords: 234, affectedBranches: ['Ranchi Main', 'Patna Main', 'Kolkata Central', 'Mumbai Main', 'Bengaluru Main'],
    durationMs: 3120, details: 'NPA classification difference: ₹13.7 Cr — primarily in sub-standard category',
  },
  // DQ-004: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-004', rule: MOCK_DQ_RULES[3],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 9876543, expectedValue: 9876543, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 2450, details: 'GL trial balance matches regulatory totals',
  },
  // DQ-005: FAIL — Branch totals don't sum
  {
    executionId: nextId('EX'), ruleId: 'DQ-005', rule: MOCK_DQ_RULES[4],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 8422.3, expectedValue: 8426.0, difference: 3.7, deviationPct: 0.044,
    affectedRecords: 12, affectedBranches: ['Dhanbad Main', 'Hazaribagh Branch'],
    durationMs: 1560, details: 'Branch-level loan totals short by ₹3.7 Cr — 2 branches with unmapped accounts',
  },
  // DQ-006: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-006', rule: MOCK_DQ_RULES[5],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 456.2, expectedValue: 456.0, difference: 0.2, deviationPct: 0.044,
    affectedRecords: 0, affectedBranches: [], durationMs: 980, details: 'Interest income within acceptable tolerance',
  },
  // DQ-007: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-007', rule: MOCK_DQ_RULES[6],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 24853, expectedValue: 24856, difference: 3, deviationPct: 0.012,
    affectedRecords: 3, affectedBranches: [], durationMs: 670, details: 'Customer count within tolerance (3 difference)',
  },

  // DQ-008: FAIL — 5% customer classifications missing (key demo issue)
  {
    executionId: nextId('EX'), ruleId: 'DQ-008', rule: MOCK_DQ_RULES[7],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 1243, expectedValue: 0, difference: 1243, deviationPct: 5.0,
    affectedRecords: 1243, affectedBranches: [
      'Ranchi Main', 'Bokaro Branch', 'Jamshedpur Central', 'Patna Main',
      'Kolkata Central', 'Bhubaneswar Main', 'Lucknow Central', 'Delhi Central Main',
    ],
    durationMs: 1230, details: '1,243 customers (5.0%) have NULL segment classification',
  },
  // DQ-009: FAIL — Risk category missing
  {
    executionId: nextId('EX'), ruleId: 'DQ-009', rule: MOCK_DQ_RULES[8],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 87, expectedValue: 0, difference: 87, deviationPct: 1.2,
    affectedRecords: 87, affectedBranches: ['Ranchi Main', 'Patna Main', 'Gaya Branch'],
    durationMs: 890, details: '87 loan accounts missing risk category classification',
  },
  // DQ-010: FAIL — 3 branches missing data
  {
    executionId: nextId('EX'), ruleId: 'DQ-010', rule: MOCK_DQ_RULES[9],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 147, expectedValue: 150, difference: 3, deviationPct: 2.0,
    affectedRecords: 3, affectedBranches: ['Hazaribagh Extension Counter', 'Imphal Branch', 'Shillong Digital'],
    durationMs: 560, details: '3 active branches have not submitted data for Q4 FY2025-26',
  },
  // DQ-011: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-011', rule: MOCK_DQ_RULES[10],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 0, expectedValue: 0, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 1120, details: 'All active customers have complete KYC fields',
  },
  // DQ-012: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-012', rule: MOCK_DQ_RULES[11],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 0, expectedValue: 0, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 780, details: 'All secured loans have collateral details',
  },
  // DQ-013: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-013', rule: MOCK_DQ_RULES[12],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 0, expectedValue: 0, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 430, details: 'All accounts have valid opening dates',
  },
  // DQ-014: FAIL — Missing reporting populations
  {
    executionId: nextId('EX'), ruleId: 'DQ-014', rule: MOCK_DQ_RULES[13],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 18, expectedValue: 20, difference: 2, deviationPct: 10.0,
    affectedRecords: 2, affectedBranches: [],
    durationMs: 670, details: '2 reporting populations missing: Government accounts, Institutional deposits',
  },

  // DQ-015: FAIL — CBS/MIS mismatch (key demo issue)
  {
    executionId: nextId('EX'), ruleId: 'DQ-015', rule: MOCK_DQ_RULES[14],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 8452.3, expectedValue: 8468.0, difference: 15.7, deviationPct: 0.185,
    affectedRecords: 456, affectedBranches: [
      'Ranchi Main', 'Bokaro Branch', 'Dhanbad Main', 'Jamshedpur Central',
      'Patna Main', 'Kolkata Central', 'Mumbai Main', 'Delhi Central Main',
    ],
    durationMs: 3450, details: 'CBS advances: ₹8,468.0 Cr | MIS advances: ₹8,452.3 Cr | Difference: ₹15.7 Cr',
  },
  // DQ-016: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-016', rule: MOCK_DQ_RULES[15],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 12456, expectedValue: 12456, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 2100, details: 'Regulatory deposits consistent with CBS',
  },
  // DQ-017: FAIL — Branch vs regional totals
  {
    executionId: nextId('EX'), ruleId: 'DQ-017', rule: MOCK_DQ_RULES[16],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: null, expectedValue: null, difference: 8.4, deviationPct: 0.1,
    affectedRecords: 14, affectedBranches: ['Jharkhand Region', 'Bihar Region', 'Eastern Region'],
    durationMs: 2780, details: 'Branch totals differ from regional aggregates by ₹8.4 Cr across 3 regions',
  },
  // DQ-018: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-018', rule: MOCK_DQ_RULES[17],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 8466.2, expectedValue: 8468.0, difference: 1.8, deviationPct: 0.021,
    affectedRecords: 0, affectedBranches: [], durationMs: 1890, details: 'Loan system and CBS within tolerance',
  },
  // DQ-019: FAIL — Customer data inconsistencies
  {
    executionId: nextId('EX'), ruleId: 'DQ-019', rule: MOCK_DQ_RULES[18],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 156, expectedValue: 0, difference: 156, deviationPct: 0.63,
    affectedRecords: 156, affectedBranches: ['Ranchi Main', 'Patna Main', 'Delhi Central Main'],
    durationMs: 1340, details: '156 customer records with address/name mismatches between CBS and CRM',
  },
  // DQ-020: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-020', rule: MOCK_DQ_RULES[19],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 0, expectedValue: 0, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 1120, details: 'Interest rates match product master',
  },

  // DQ-021: FAIL — Branch feeds delayed
  {
    executionId: nextId('EX'), ruleId: 'DQ-021', rule: MOCK_DQ_RULES[20],
    status: 'failed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 7, expectedValue: 0, difference: 7, deviationPct: 4.67,
    affectedRecords: 7, affectedBranches: [
      'Hazaribagh Branch', 'Imphal Branch', 'Shillong Digital',
      'Gaya Branch', 'Darbhanga Branch', 'Berhampur Branch', 'Kota Branch',
    ],
    durationMs: 890, details: '7 branches submitted data feeds after the cutoff (delayed by 4–18 hours)',
  },
  // DQ-022: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-022', rule: MOCK_DQ_RULES[21],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: null, expectedValue: null, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 340, details: 'CBS extraction completed within ETL window',
  },
  // DQ-023: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-023', rule: MOCK_DQ_RULES[22],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: null, expectedValue: null, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 210, details: 'All corrections applied before deadline',
  },
  // DQ-024: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-024', rule: MOCK_DQ_RULES[23],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: 6, expectedValue: 24, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 180, details: 'Source data is 6 hours old — within 24-hour freshness limit',
  },
  // DQ-025: PASS
  {
    executionId: nextId('EX'), ruleId: 'DQ-025', rule: MOCK_DQ_RULES[24],
    status: 'passed', executedAt: isoDate(1), reportingPeriod: 'Q4 FY2025-26',
    actualValue: null, expectedValue: null, difference: 0, deviationPct: 0,
    affectedRecords: 0, affectedBranches: [], durationMs: 150, details: 'Report submission timeline on track',
  },
];

// ---------------------------------------------------------------------------
// Exceptions — generated from failed rule executions
// ---------------------------------------------------------------------------

const failedExecutions = MOCK_RULE_EXECUTIONS.filter(e => e.status === 'failed');

export const MOCK_EXCEPTIONS: DQException[] = [
  {
    exceptionId: 'EXC-001', ruleExecution: failedExecutions[0], // DQ-001 advances mismatch
    status: 'open', priority: 'critical',
    affectedReport: 'Advances Summary (ADV-001)', affectedDataElement: 'Total Advances Outstanding',
    sourceSystem: 'CBS', affectedBranches: failedExecutions[0].affectedBranches,
    affectedRecordCount: 1847, rootCause: 'Timing difference between CBS end-of-day processing and regulatory data warehouse extraction. CBS processes adjustments after the extraction window, causing 23 branches to show stale advance balances.',
    recommendedAction: 'Align CBS end-of-day processing cutoff with regulatory data extraction window. Implement a post-extraction reconciliation check.',
    financialImpact: 42.6, assignedTo: 'Rajesh Kumar', ownerTeam: 'Finance',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-002', ruleExecution: failedExecutions[1], // DQ-003 NPA mismatch
    status: 'acknowledged', priority: 'high',
    affectedReport: 'NPA Report (NPA-001)', affectedDataElement: 'NPA Classification Amount',
    sourceSystem: 'CBS', affectedBranches: failedExecutions[1].affectedBranches,
    affectedRecordCount: 234, rootCause: 'NPA classification engine ran with outdated provisioning rules. 234 accounts in the sub-standard category were not reclassified after the quarterly review.',
    recommendedAction: 'Re-run NPA classification engine with updated provisioning norms. Verify sub-standard to doubtful migration.',
    financialImpact: 13.7, assignedTo: 'Meena Sharma', ownerTeam: 'Risk',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: 'Acknowledged — risk team reviewing classification rules',
  },
  {
    exceptionId: 'EXC-003', ruleExecution: failedExecutions[2], // DQ-005 branch totals
    status: 'open', priority: 'medium',
    affectedReport: 'Advances Summary (ADV-001)', affectedDataElement: 'Branch-Level Loan Totals',
    sourceSystem: 'CBS', affectedBranches: ['Dhanbad Main', 'Hazaribagh Branch'],
    affectedRecordCount: 12, rootCause: '12 loan accounts at 2 branches are mapped to an inactive branch code, causing them to be excluded from the branch-level aggregation.',
    recommendedAction: 'Remap the 12 accounts to the correct active branch codes in the CBS branch master.',
    financialImpact: 3.7, assignedTo: 'Sunil Verma', ownerTeam: 'Finance',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-004', ruleExecution: failedExecutions[3], // DQ-008 customer classification
    status: 'open', priority: 'high',
    affectedReport: 'BSR Report (BSR-001)', affectedDataElement: 'Customer Segment Classification',
    sourceSystem: 'CBS', affectedBranches: failedExecutions[3].affectedBranches,
    affectedRecordCount: 1243, rootCause: 'Customer migration from legacy system left 1,243 customer records without segment classification. These are primarily customers from the 2019 bulk migration.',
    recommendedAction: 'Run batch segment classification for unclassified customers based on balance and income criteria.',
    financialImpact: null, assignedTo: 'Priya Patel', ownerTeam: 'Operations',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-005', ruleExecution: failedExecutions[4], // DQ-009 risk category
    status: 'in_progress', priority: 'high',
    affectedReport: 'NPA Report (NPA-001)', affectedDataElement: 'Loan Risk Category',
    sourceSystem: 'CBS', affectedBranches: ['Ranchi Main', 'Patna Main', 'Gaya Branch'],
    affectedRecordCount: 87, rootCause: '87 recently disbursed loans have not been through the initial risk scoring engine run.',
    recommendedAction: 'Schedule ad-hoc risk scoring run for newly disbursed loans.',
    financialImpact: null, assignedTo: 'Amit Singh', ownerTeam: 'Risk',
    raisedAt: isoDate(2), updatedAt: isoDate(0), resolutionNotes: 'Risk scoring job scheduled for tonight',
  },
  {
    exceptionId: 'EXC-006', ruleExecution: failedExecutions[5], // DQ-010 missing branch data
    status: 'open', priority: 'critical',
    affectedReport: 'BSR Report (BSR-001)', affectedDataElement: 'Branch Data Submission',
    sourceSystem: 'Branch Systems', affectedBranches: ['Hazaribagh Extension Counter', 'Imphal Branch', 'Shillong Digital'],
    affectedRecordCount: 3, rootCause: 'Network connectivity issues at 2 branches (Imphal, Shillong) and system outage at Hazaribagh Extension Counter prevented data submission.',
    recommendedAction: 'Restore connectivity and re-initiate data submission from the 3 affected branches. Consider backup data transfer mechanism.',
    financialImpact: null, assignedTo: 'Ravi Kumar', ownerTeam: 'Regional Ops',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-007', ruleExecution: failedExecutions[6], // DQ-014 reporting populations
    status: 'open', priority: 'high',
    affectedReport: 'BSR Report (BSR-001)', affectedDataElement: 'Reporting Population Coverage',
    sourceSystem: 'Regulatory Data Warehouse', affectedBranches: [],
    affectedRecordCount: 2, rootCause: 'Government account classification was updated in CBS but not propagated to the regulatory data warehouse ETL mapping table.',
    recommendedAction: 'Update the ETL mapping table to include the new Government account classification. Re-run the extraction.',
    financialImpact: null, assignedTo: 'Deepak Gupta', ownerTeam: 'Regulatory Reporting',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-008', ruleExecution: failedExecutions[7], // DQ-015 CBS/MIS mismatch
    status: 'open', priority: 'critical',
    affectedReport: 'Advances Summary (ADV-001)', affectedDataElement: 'CBS vs MIS Advances',
    sourceSystem: 'CBS/MIS', affectedBranches: failedExecutions[7].affectedBranches,
    affectedRecordCount: 456, rootCause: 'MIS data pipeline has a 6-hour lag behind CBS. The extraction ran during the lag window, capturing stale MIS data.',
    recommendedAction: 'Realign MIS extraction to run after CBS-to-MIS sync completes. Implement cross-system timestamp validation.',
    financialImpact: 15.7, assignedTo: 'Sanjay Tiwari', ownerTeam: 'IT',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-009', ruleExecution: failedExecutions[8], // DQ-017 branch vs regional
    status: 'open', priority: 'high',
    affectedReport: 'BSR Report (BSR-001)', affectedDataElement: 'Branch vs Regional Totals',
    sourceSystem: 'Regulatory Data Warehouse', affectedBranches: ['Jharkhand Region', 'Bihar Region', 'Eastern Region'],
    affectedRecordCount: 14, rootCause: '14 branch records have zone_id mapping errors causing incorrect regional aggregation.',
    recommendedAction: 'Fix branch-to-zone mapping in the regulatory data warehouse configuration. Re-aggregate regional totals.',
    financialImpact: 8.4, assignedTo: 'Sanjay Tiwari', ownerTeam: 'IT',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-010', ruleExecution: failedExecutions[9], // DQ-019 customer cross-check
    status: 'open', priority: 'medium',
    affectedReport: 'BSR Report (BSR-001)', affectedDataElement: 'Customer Master Data',
    sourceSystem: 'CBS/CRM', affectedBranches: ['Ranchi Main', 'Patna Main', 'Delhi Central Main'],
    affectedRecordCount: 156, rootCause: 'CRM customer address updates are not synced back to CBS. 156 customers show different addresses across systems.',
    recommendedAction: 'Implement real-time or daily CBS-CRM customer data sync. Reconcile current mismatches.',
    financialImpact: null, assignedTo: 'Priya Patel', ownerTeam: 'Operations',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
  {
    exceptionId: 'EXC-011', ruleExecution: failedExecutions[10], // DQ-021 delayed feeds
    status: 'open', priority: 'high',
    affectedReport: 'BSR Report (BSR-001)', affectedDataElement: 'Branch Data Feed Timeliness',
    sourceSystem: 'Branch Systems', affectedBranches: failedExecutions[10].affectedBranches,
    affectedRecordCount: 7, rootCause: '7 branches submitted data feeds after the cutoff time. Hazaribagh was 18 hours late due to hardware failure. Others were 4-8 hours late due to slow network.',
    recommendedAction: 'Upgrade network infrastructure at affected branches. Implement automated feed submission with retry logic.',
    financialImpact: null, assignedTo: 'Ravi Kumar', ownerTeam: 'Regional Ops',
    raisedAt: isoDate(1), updatedAt: isoDate(0), resolutionNotes: '',
  },
];

// ---------------------------------------------------------------------------
// Scoring Configuration
// ---------------------------------------------------------------------------

export const MOCK_SCORING_CONFIG: ScoringConfig = {
  configId: 'SC-001',
  configName: 'Default sDQI Readiness Configuration',
  description: 'Internal data quality scoring configuration with equal weighting across four dimensions. Weights and thresholds are configurable.',
  dimensionWeights: [
    { dimension: 'accuracy', weight: 0.30 },
    { dimension: 'completeness', weight: 0.25 },
    { dimension: 'consistency', weight: 0.25 },
    { dimension: 'timeliness', weight: 0.20 },
  ],
  effectiveFrom: '2025-04-01',
  version: 2,
  isActive: true,
  createdBy: 'System Admin',
};

// ---------------------------------------------------------------------------
// Trend Data — 4 quarters showing decline (key demo narrative)
// ---------------------------------------------------------------------------

export const MOCK_TREND_DATA: TrendDataPoint[] = [
  {
    period: 'Q1 FY2025-26', periodLabel: 'Q1', overallScore: 94.2,
    accuracy: 97.1, completeness: 93.5, consistency: 95.2, timeliness: 98.8,
    exceptionCount: 3, criticalExceptionCount: 0,
  },
  {
    period: 'Q2 FY2025-26', periodLabel: 'Q2', overallScore: 92.7,
    accuracy: 96.3, completeness: 91.8, consistency: 93.1, timeliness: 98.2,
    exceptionCount: 5, criticalExceptionCount: 1,
  },
  {
    period: 'Q3 FY2025-26', periodLabel: 'Q3', overallScore: 89.8,
    accuracy: 94.5, completeness: 90.1, consistency: 88.6, timeliness: 97.5,
    exceptionCount: 8, criticalExceptionCount: 1,
  },
  {
    period: 'Q4 FY2025-26', periodLabel: 'Q4', overallScore: 87.6,
    accuracy: 92.8, completeness: 84.2, consistency: 85.4, timeliness: 96.0,
    exceptionCount: 11, criticalExceptionCount: 3,
  },
];

// ---------------------------------------------------------------------------
// Report Definitions — Metadata-driven
// ---------------------------------------------------------------------------

export const MOCK_REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    reportId: 'BSR-001', reportName: 'Basic Statistical Return',
    reportCode: 'BSR-1', description: 'Comprehensive return covering deposits, advances, and branch-level statistics as required by RBI',
    authority: 'RBI', frequency: 'quarterly',
    dataElements: ['Deposits', 'Advances', 'Branch Statistics', 'Customer Segments', 'Interest Rates'],
    applicableRules: ['DQ-001', 'DQ-002', 'DQ-004', 'DQ-007', 'DQ-008', 'DQ-010', 'DQ-011', 'DQ-014', 'DQ-017', 'DQ-019', 'DQ-021', 'DQ-022', 'DQ-023', 'DQ-024', 'DQ-025'],
  },
  {
    reportId: 'ADV-001', reportName: 'Advances Summary',
    reportCode: 'ADV-SUM', description: 'Detailed summary of all advances by category, branch, region, and customer segment',
    authority: 'RBI', frequency: 'quarterly',
    dataElements: ['Loan Outstanding', 'NPA', 'Branch-Level Advances', 'Sector-wise Classification', 'Collateral'],
    applicableRules: ['DQ-001', 'DQ-003', 'DQ-005', 'DQ-008', 'DQ-009', 'DQ-012', 'DQ-015', 'DQ-017', 'DQ-018', 'DQ-020', 'DQ-021', 'DQ-023', 'DQ-025'],
  },
  {
    reportId: 'DEP-001', reportName: 'Deposit Summary',
    reportCode: 'DEP-SUM', description: 'Summary of all deposit accounts by type, branch, and customer segment',
    authority: 'RBI', frequency: 'quarterly',
    dataElements: ['Term Deposits', 'Savings Deposits', 'Current Accounts', 'Branch-Level Deposits', 'Interest Rates'],
    applicableRules: ['DQ-002', 'DQ-010', 'DQ-016', 'DQ-021', 'DQ-023', 'DQ-025'],
  },
  {
    reportId: 'NPA-001', reportName: 'NPA Report',
    reportCode: 'NPA', description: 'Non-Performing Assets classification and provisioning report',
    authority: 'RBI', frequency: 'quarterly',
    dataElements: ['Sub-Standard', 'Doubtful', 'Loss Assets', 'Provisioning', 'Upgradation', 'Write-offs'],
    applicableRules: ['DQ-003', 'DQ-009', 'DQ-025'],
  },
];

// ---------------------------------------------------------------------------
// Report Instances
// ---------------------------------------------------------------------------

export const MOCK_REPORT_INSTANCES: RegulatoryReport[] = [
  {
    instanceId: 'RI-001', definition: MOCK_REPORT_DEFINITIONS[0],
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
    workflowState: 'validation', data: [],
    dqScore: 87.6, exceptionCount: 8, criticalExceptionCount: 2,
    version: 1, createdBy: 'Regulatory Officer', createdAt: isoDate(3),
    lastActionBy: 'System', lastActionAt: isoDate(1),
    maker: null, checker: null,
    history: [
      { fromState: 'draft', toState: 'data_ingestion', actionBy: 'System', actionAt: isoDate(3), comments: 'Automated data ingestion initiated' },
      { fromState: 'data_ingestion', toState: 'validation', actionBy: 'System', actionAt: isoDate(2), comments: 'Data ingestion complete — validation running' },
    ],
  },
  {
    instanceId: 'RI-002', definition: MOCK_REPORT_DEFINITIONS[1],
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
    workflowState: 'exception_resolution', data: [],
    dqScore: 84.3, exceptionCount: 5, criticalExceptionCount: 1,
    version: 1, createdBy: 'Regulatory Officer', createdAt: isoDate(3),
    lastActionBy: 'System', lastActionAt: isoDate(1),
    maker: null, checker: null,
    history: [
      { fromState: 'draft', toState: 'data_ingestion', actionBy: 'System', actionAt: isoDate(3), comments: 'Automated data ingestion initiated' },
      { fromState: 'data_ingestion', toState: 'validation', actionBy: 'System', actionAt: isoDate(2), comments: 'Validation complete' },
      { fromState: 'validation', toState: 'exception_resolution', actionBy: 'System', actionAt: isoDate(1), comments: '5 exceptions found — resolution required' },
    ],
  },
  {
    instanceId: 'RI-003', definition: MOCK_REPORT_DEFINITIONS[2],
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
    workflowState: 'ready_for_review', data: [],
    dqScore: 96.8, exceptionCount: 1, criticalExceptionCount: 0,
    version: 1, createdBy: 'Regulatory Officer', createdAt: isoDate(5),
    lastActionBy: 'Regulatory Officer', lastActionAt: isoDate(1),
    maker: null, checker: null,
    history: [
      { fromState: 'draft', toState: 'data_ingestion', actionBy: 'System', actionAt: isoDate(5), comments: 'Automated data ingestion' },
      { fromState: 'data_ingestion', toState: 'validation', actionBy: 'System', actionAt: isoDate(4), comments: 'Validation complete' },
      { fromState: 'validation', toState: 'exception_resolution', actionBy: 'System', actionAt: isoDate(3), comments: '1 minor exception' },
      { fromState: 'exception_resolution', toState: 're_validation', actionBy: 'Regulatory Officer', actionAt: isoDate(2), comments: 'Exception resolved' },
      { fromState: 're_validation', toState: 'ready_for_review', actionBy: 'System', actionAt: isoDate(1), comments: 'Re-validation passed' },
    ],
  },
  {
    instanceId: 'RI-004', definition: MOCK_REPORT_DEFINITIONS[3],
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
    workflowState: 'checker_approved', data: [],
    dqScore: 91.2, exceptionCount: 2, criticalExceptionCount: 0,
    version: 2, createdBy: 'Regulatory Officer', createdAt: isoDate(7),
    lastActionBy: 'DGM', lastActionAt: isoDate(0),
    maker: 'Regulatory Officer', checker: 'DGM',
    history: [
      { fromState: 'draft', toState: 'data_ingestion', actionBy: 'System', actionAt: isoDate(7), comments: 'Ingestion' },
      { fromState: 'data_ingestion', toState: 'validation', actionBy: 'System', actionAt: isoDate(6), comments: 'Validated' },
      { fromState: 'validation', toState: 'exception_resolution', actionBy: 'System', actionAt: isoDate(5), comments: '2 exceptions' },
      { fromState: 'exception_resolution', toState: 're_validation', actionBy: 'Risk Officer', actionAt: isoDate(4), comments: 'Resolved' },
      { fromState: 're_validation', toState: 'ready_for_review', actionBy: 'System', actionAt: isoDate(3), comments: 'Passed' },
      { fromState: 'ready_for_review', toState: 'maker_submitted', actionBy: 'Regulatory Officer', actionAt: isoDate(1), comments: 'Submitted for approval' },
      { fromState: 'maker_submitted', toState: 'checker_approved', actionBy: 'DGM', actionAt: isoDate(0), comments: 'Approved — ready for submission' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Reconciliation Results
// ---------------------------------------------------------------------------

export const MOCK_RECONCILIATIONS: ReconciliationResult[] = [
  {
    reconcId: 'REC-001', dataElement: 'Total Advances',
    sourceSystem: 'CBS', sourceValue: 846800, targetSystem: 'Regulatory Dataset', targetValue: 842600,
    difference: 4200, differenceAbs: 4200, deviationPct: 0.496,
    status: 'mismatched',
    affectedBranches: [
      { branchCode: 'BR001', branchName: 'Ranchi Main', sourceValue: 42340, targetValue: 41800, difference: 540 },
      { branchCode: 'BR012', branchName: 'Patna Main', sourceValue: 38900, targetValue: 38420, difference: 480 },
      { branchCode: 'BR023', branchName: 'Kolkata Central', sourceValue: 56780, targetValue: 56100, difference: 680 },
      { branchCode: 'BR034', branchName: 'Mumbai Main', sourceValue: 78900, targetValue: 78200, difference: 700 },
      { branchCode: 'BR045', branchName: 'Delhi Central Main', sourceValue: 45600, targetValue: 45100, difference: 500 },
      { branchCode: 'BR056', branchName: 'Bengaluru Main', sourceValue: 34500, targetValue: 34200, difference: 300 },
      { branchCode: 'BR067', branchName: 'Chennai Central', sourceValue: 29800, targetValue: 29500, difference: 300 },
      { branchCode: 'BR078', branchName: 'Ahmedabad Main', sourceValue: 25400, targetValue: 25100, difference: 300 },
      { branchCode: 'BR089', branchName: 'Pune Central', sourceValue: 21300, targetValue: 21100, difference: 200 },
      { branchCode: 'BR004', branchName: 'Jamshedpur Central', sourceValue: 18700, targetValue: 18500, difference: 200 },
    ],
    executedAt: isoDate(1),
  },
  {
    reconcId: 'REC-002', dataElement: 'Total Deposits',
    sourceSystem: 'CBS', sourceValue: 1245600, targetSystem: 'Regulatory Dataset', targetValue: 1245600,
    difference: 0, differenceAbs: 0, deviationPct: 0,
    status: 'matched', affectedBranches: [], executedAt: isoDate(1),
  },
  {
    reconcId: 'REC-003', dataElement: 'CBS vs MIS Advances',
    sourceSystem: 'CBS', sourceValue: 846800, targetSystem: 'MIS', targetValue: 845230,
    difference: 1570, differenceAbs: 1570, deviationPct: 0.185,
    status: 'mismatched',
    affectedBranches: [
      { branchCode: 'BR001', branchName: 'Ranchi Main', sourceValue: 42340, targetValue: 42100, difference: 240 },
      { branchCode: 'BR012', branchName: 'Patna Main', sourceValue: 38900, targetValue: 38700, difference: 200 },
      { branchCode: 'BR023', branchName: 'Kolkata Central', sourceValue: 56780, targetValue: 56500, difference: 280 },
      { branchCode: 'BR034', branchName: 'Mumbai Main', sourceValue: 78900, targetValue: 78500, difference: 400 },
      { branchCode: 'BR045', branchName: 'Delhi Central Main', sourceValue: 45600, targetValue: 45350, difference: 250 },
      { branchCode: 'BR003', branchName: 'Dhanbad Main', sourceValue: 15600, targetValue: 15500, difference: 100 },
      { branchCode: 'BR004', branchName: 'Jamshedpur Central', sourceValue: 18700, targetValue: 18600, difference: 100 },
    ],
    executedAt: isoDate(1),
  },
];

// ---------------------------------------------------------------------------
// Audit Events
// ---------------------------------------------------------------------------

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    eventId: 'AE-001', eventType: 'score_calculated', timestamp: isoDate(1),
    userId: 'System', details: { overallScore: 87.6, accuracy: 92.8, completeness: 84.2, consistency: 85.4, timeliness: 96.0, configVersion: 2 },
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
  },
  {
    eventId: 'AE-002', eventType: 'rules_executed', timestamp: isoDate(1),
    userId: 'System', details: { totalRules: 25, passed: 14, failed: 11, skipped: 0, durationMs: 28230 },
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
  },
  {
    eventId: 'AE-003', eventType: 'exception_raised', timestamp: isoDate(1),
    userId: 'System', details: { exceptionCount: 11, criticalCount: 3, highCount: 5, mediumCount: 2, lowCount: 1 },
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
  },
  {
    eventId: 'AE-004', eventType: 'report_generated', timestamp: isoDate(3),
    userId: 'Regulatory Officer', details: { reportId: 'BSR-001', reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions' },
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
  },
  {
    eventId: 'AE-005', eventType: 'report_state_changed', timestamp: isoDate(0),
    userId: 'DGM', details: { reportId: 'NPA-001', fromState: 'maker_submitted', toState: 'checker_approved', comments: 'Approved — ready for submission' },
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
  },
  {
    eventId: 'AE-006', eventType: 'config_updated', timestamp: isoDate(30),
    userId: 'System Admin', details: { configId: 'SC-001', version: 2, changes: 'Updated accuracy weight from 0.25 to 0.30, timeliness from 0.25 to 0.20' },
    reportingPeriod: 'Q4 FY2025-26', entity: 'All Regions',
  },
];

// ---------------------------------------------------------------------------
// Regional Breakdown for DGM drill-down
// ---------------------------------------------------------------------------

export interface RegionalDQSummary {
  region: string;
  overallScore: number;
  accuracy: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  exceptionCount: number;
  criticalCount: number;
  status: 'ready' | 'at_risk' | 'not_ready';
}

export const MOCK_REGIONAL_BREAKDOWN: RegionalDQSummary[] = [
  { region: 'Jharkhand Region', overallScore: 82.4, accuracy: 88.2, completeness: 78.5, consistency: 80.1, timeliness: 91.3, exceptionCount: 4, criticalCount: 1, status: 'at_risk' },
  { region: 'Bihar Region', overallScore: 84.1, accuracy: 90.1, completeness: 80.3, consistency: 82.7, timeliness: 88.9, exceptionCount: 3, criticalCount: 1, status: 'at_risk' },
  { region: 'Eastern Region', overallScore: 86.7, accuracy: 91.5, completeness: 84.2, consistency: 84.8, timeliness: 94.2, exceptionCount: 3, criticalCount: 0, status: 'at_risk' },
  { region: 'Odisha Region', overallScore: 91.3, accuracy: 95.2, completeness: 89.1, consistency: 90.4, timeliness: 97.8, exceptionCount: 1, criticalCount: 0, status: 'ready' },
  { region: 'UP Region', overallScore: 89.8, accuracy: 93.6, completeness: 87.4, consistency: 88.2, timeliness: 96.1, exceptionCount: 2, criticalCount: 0, status: 'at_risk' },
  { region: 'Delhi Region', overallScore: 88.5, accuracy: 92.3, completeness: 86.1, consistency: 87.5, timeliness: 95.7, exceptionCount: 2, criticalCount: 1, status: 'at_risk' },
  { region: 'Central Region', overallScore: 93.2, accuracy: 96.7, completeness: 91.8, consistency: 92.1, timeliness: 98.4, exceptionCount: 1, criticalCount: 0, status: 'ready' },
  { region: 'Western Region', overallScore: 90.6, accuracy: 94.8, completeness: 88.7, consistency: 89.3, timeliness: 97.2, exceptionCount: 2, criticalCount: 0, status: 'ready' },
  { region: 'Southern Region', overallScore: 92.1, accuracy: 96.1, completeness: 90.5, consistency: 91.2, timeliness: 98.1, exceptionCount: 1, criticalCount: 0, status: 'ready' },
  { region: 'Rajasthan Region', overallScore: 90.4, accuracy: 94.2, completeness: 88.3, consistency: 89.1, timeliness: 96.8, exceptionCount: 1, criticalCount: 0, status: 'ready' },
  { region: 'Gujarat Region', overallScore: 91.8, accuracy: 95.5, completeness: 89.6, consistency: 90.8, timeliness: 97.5, exceptionCount: 1, criticalCount: 0, status: 'ready' },
  { region: 'Northeast Region', overallScore: 79.3, accuracy: 85.4, completeness: 74.8, consistency: 77.2, timeliness: 84.6, exceptionCount: 5, criticalCount: 2, status: 'not_ready' },
];

// ---------------------------------------------------------------------------
// Branch-level timeliness data for demo
// ---------------------------------------------------------------------------

export interface BranchFeedTimeliness {
  branchName: string;
  region: string;
  expectedArrival: string;
  actualArrival: string;
  delayHours: number;
  status: 'on_time' | 'delayed' | 'missing';
}

export const MOCK_DELAYED_FEEDS: BranchFeedTimeliness[] = [
  { branchName: 'Hazaribagh Branch', region: 'Jharkhand Region', expectedArrival: '06:00', actualArrival: '00:00 (next day)', delayHours: 18, status: 'delayed' },
  { branchName: 'Imphal Branch', region: 'Northeast Region', expectedArrival: '06:00', actualArrival: '14:00', delayHours: 8, status: 'delayed' },
  { branchName: 'Shillong Digital', region: 'Northeast Region', expectedArrival: '06:00', actualArrival: '—', delayHours: 0, status: 'missing' },
  { branchName: 'Gaya Branch', region: 'Bihar Region', expectedArrival: '06:00', actualArrival: '12:30', delayHours: 6.5, status: 'delayed' },
  { branchName: 'Darbhanga Branch', region: 'Bihar Region', expectedArrival: '06:00', actualArrival: '10:00', delayHours: 4, status: 'delayed' },
  { branchName: 'Berhampur Branch', region: 'Odisha Region', expectedArrival: '06:00', actualArrival: '11:45', delayHours: 5.75, status: 'delayed' },
  { branchName: 'Kota Branch', region: 'Rajasthan Region', expectedArrival: '06:00', actualArrival: '10:30', delayHours: 4.5, status: 'delayed' },
];
