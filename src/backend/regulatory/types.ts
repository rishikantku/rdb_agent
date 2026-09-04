// ============================================================================
// Regulatory Data Quality — Domain Types
// ============================================================================
// Shared interfaces for the deterministic DQ engine. These types describe
// the regulatory data-quality domain and are used by all backend services
// and frontend views.
//
// IMPORTANT: No LLM dependency. Every type here supports deterministic
// validation, scoring, and reporting.
// ============================================================================

// ---------------------------------------------------------------------------
// Quality Dimensions
// ---------------------------------------------------------------------------

export type DQDimension = 'accuracy' | 'completeness' | 'consistency' | 'timeliness';

export const DQ_DIMENSION_LABELS: Record<DQDimension, string> = {
  accuracy: 'Accuracy',
  completeness: 'Completeness',
  consistency: 'Consistency',
  timeliness: 'Timeliness',
};

export const DQ_DIMENSION_DESCRIPTIONS: Record<DQDimension, string> = {
  accuracy: 'Reported values correctly represent the underlying source data',
  completeness: 'All required fields, records, and populations are present',
  consistency: 'Data agrees across CBS, GL, MIS, and regulatory datasets',
  timeliness: 'Data arrives within required timeframes and deadlines',
};

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// DQ Rules
// ---------------------------------------------------------------------------

export interface DQRule {
  ruleId: string;
  ruleName: string;
  description: string;
  dimension: DQDimension;
  severity: Severity;
  /** Source system the rule applies to */
  source: string;
  /** Target data element or table */
  targetData: string;
  /** Human-readable validation logic description */
  validationLogic: string;
  /** Threshold for pass/fail (e.g., 0 for zero tolerance, 0.01 for 1% tolerance) */
  threshold: number;
  /** Message shown when the rule fails */
  exceptionMessage: string;
  /** Responsible team/person */
  owner: string;
  /** Recommended resolution steps */
  resolution: string;
  /** Whether the rule is currently active */
  isActive: boolean;
  /** Applicable report types (empty = all) */
  applicableReports: string[];
}

// ---------------------------------------------------------------------------
// Rule Execution
// ---------------------------------------------------------------------------

export type RuleExecutionStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface DQRuleExecution {
  executionId: string;
  ruleId: string;
  rule: DQRule;
  status: RuleExecutionStatus;
  /** Timestamp of execution */
  executedAt: string;
  /** Reporting period this execution applies to */
  reportingPeriod: string;
  /** Actual value found */
  actualValue: number | string | null;
  /** Expected value */
  expectedValue: number | string | null;
  /** Difference (for numeric comparisons) */
  difference: number | null;
  /** Percentage deviation */
  deviationPct: number | null;
  /** Number of records affected */
  affectedRecords: number;
  /** Affected branches/regions */
  affectedBranches: string[];
  /** Execution duration in ms */
  durationMs: number;
  /** Additional details */
  details: string;
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export type ExceptionStatus = 'open' | 'acknowledged' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export interface DQException {
  exceptionId: string;
  ruleExecution: DQRuleExecution;
  status: ExceptionStatus;
  priority: Severity;
  /** Affected regulatory report */
  affectedReport: string;
  /** Affected data element */
  affectedDataElement: string;
  /** Source system */
  sourceSystem: string;
  /** Affected branch/region list */
  affectedBranches: string[];
  /** Affected record count */
  affectedRecordCount: number;
  /** Root cause analysis */
  rootCause: string;
  /** Recommended action */
  recommendedAction: string;
  /** Financial impact (₹ Cr) */
  financialImpact: number | null;
  /** Assigned to */
  assignedTo: string;
  /** Owner team */
  ownerTeam: string;
  /** When the exception was raised */
  raisedAt: string;
  /** When it was last updated */
  updatedAt: string;
  /** Resolution notes */
  resolutionNotes: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface DimensionWeight {
  dimension: DQDimension;
  weight: number; // 0.0 – 1.0
}

export interface ScoringConfig {
  configId: string;
  configName: string;
  description: string;
  dimensionWeights: DimensionWeight[];
  /** Effective date of this configuration */
  effectiveFrom: string;
  /** Version number */
  version: number;
  /** Whether this is the active configuration */
  isActive: boolean;
  /** Created by */
  createdBy: string;
}

export interface DimensionScore {
  dimension: DQDimension;
  score: number; // 0 – 100
  weight: number;
  weightedScore: number;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  skippedRules: number;
}

export interface ScoreResult {
  scoreId: string;
  reportingPeriod: string;
  /** Overall score 0 – 100 */
  overallScore: number;
  /** Per-dimension breakdown */
  dimensions: DimensionScore[];
  /** Config used for this calculation */
  scoringConfig: ScoringConfig;
  /** All rule executions that contributed */
  ruleExecutions: DQRuleExecution[];
  /** Timestamp of calculation */
  calculatedAt: string;
  /** Calculated by (user) */
  calculatedBy: string;
  /** Previous period score for comparison */
  previousScore: number | null;
  /** Change from previous period */
  changeFromPrevious: number | null;
}

// ---------------------------------------------------------------------------
// Submission Readiness
// ---------------------------------------------------------------------------

export type ReadinessStatus = 'ready' | 'at_risk' | 'not_ready';

export function getReadinessStatus(score: number, criticalExceptions: number): ReadinessStatus {
  if (criticalExceptions > 0) return 'not_ready';
  if (score >= 90) return 'ready';
  if (score >= 75) return 'at_risk';
  return 'not_ready';
}

export const READINESS_LABELS: Record<ReadinessStatus, string> = {
  ready: 'READY',
  at_risk: 'AT RISK',
  not_ready: 'NOT READY',
};

export const READINESS_TONES: Record<ReadinessStatus, 'ok' | 'warn' | 'danger'> = {
  ready: 'ok',
  at_risk: 'warn',
  not_ready: 'danger',
};

// ---------------------------------------------------------------------------
// Regulatory Reports
// ---------------------------------------------------------------------------

export type WorkflowState =
  | 'draft'
  | 'data_ingestion'
  | 'validation'
  | 'exception_resolution'
  | 're_validation'
  | 'ready_for_review'
  | 'maker_submitted'
  | 'checker_approved'
  | 'submission_ready';

export const WORKFLOW_STEPS: WorkflowState[] = [
  'draft',
  'data_ingestion',
  'validation',
  'exception_resolution',
  're_validation',
  'ready_for_review',
  'maker_submitted',
  'checker_approved',
  'submission_ready',
];

export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  draft: 'Draft',
  data_ingestion: 'Data Ingestion',
  validation: 'Validation',
  exception_resolution: 'Exception Resolution',
  re_validation: 'Re-validation',
  ready_for_review: 'Ready for Review',
  maker_submitted: 'Maker Submitted',
  checker_approved: 'Checker Approved',
  submission_ready: 'Submission Ready',
};

export interface ReportDefinition {
  reportId: string;
  reportName: string;
  reportCode: string;
  description: string;
  /** Regulatory authority (e.g., RBI) */
  authority: string;
  /** Frequency (Monthly, Quarterly, Annual) */
  frequency: 'monthly' | 'quarterly' | 'annual';
  /** Required data elements */
  dataElements: string[];
  /** Applicable DQ rules */
  applicableRules: string[];
}

export interface RegulatoryReport {
  instanceId: string;
  definition: ReportDefinition;
  reportingPeriod: string;
  entity: string;
  workflowState: WorkflowState;
  /** Report data rows */
  data: Record<string, any>[];
  /** DQ score for this specific report */
  dqScore: number | null;
  /** Exceptions found during validation */
  exceptionCount: number;
  /** Critical exception count */
  criticalExceptionCount: number;
  /** Version number */
  version: number;
  /** Created by */
  createdBy: string;
  createdAt: string;
  /** Last action by (maker/checker) */
  lastActionBy: string;
  lastActionAt: string;
  /** Maker */
  maker: string | null;
  /** Checker */
  checker: string | null;
  /** History of state transitions */
  history: WorkflowTransition[];
}

export interface WorkflowTransition {
  fromState: WorkflowState;
  toState: WorkflowState;
  actionBy: string;
  actionAt: string;
  comments: string;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export interface ReconciliationResult {
  reconcId: string;
  dataElement: string;
  sourceSystem: string;
  sourceValue: number;
  targetSystem: string;
  targetValue: number;
  difference: number;
  differenceAbs: number;
  deviationPct: number;
  status: 'matched' | 'mismatched' | 'tolerance';
  affectedBranches: ReconciliationBranchDetail[];
  executedAt: string;
}

export interface ReconciliationBranchDetail {
  branchCode: string;
  branchName: string;
  sourceValue: number;
  targetValue: number;
  difference: number;
}

// ---------------------------------------------------------------------------
// Audit Events
// ---------------------------------------------------------------------------

export type AuditEventType =
  | 'score_calculated'
  | 'rules_executed'
  | 'exception_raised'
  | 'exception_resolved'
  | 'report_generated'
  | 'report_state_changed'
  | 'config_updated'
  | 'validation_run';

export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  timestamp: string;
  userId: string;
  details: Record<string, any>;
  /** Reporting period context */
  reportingPeriod: string;
  /** Affected entity */
  entity: string;
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export interface TrendDataPoint {
  period: string;
  periodLabel: string;
  overallScore: number;
  accuracy: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  exceptionCount: number;
  criticalExceptionCount: number;
}
