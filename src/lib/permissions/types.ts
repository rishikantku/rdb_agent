// ============================================================================
// Permission contracts
// ============================================================================
// These types describe the authorization boundary. Today the only implementation
// is MockPermissionService, which simulates decisions in the browser for
// demonstration. Nothing here is a security control.
//
// The interface is deliberately async and request/response shaped so a
// BackendPermissionService can replace the mock without touching any component:
//
//   UI  ->  PermissionService  ->  [ mock today | backend authorization later ]
// ============================================================================

export type RoleId = 'DGM' | 'AGM' | 'SENIOR_MANAGER' | 'BRANCH_MANAGER' | 'ANALYST'
  | 'REGULATORY_OFFICER' | 'COMPLIANCE' | 'AUDITOR';

/** Business areas a question can touch. */
export type DataDomain =
  | 'customer_data'
  | 'account_data'
  | 'loan_data'
  | 'transaction_data'
  | 'employee_data'
  | 'branch_data'
  | 'financial_performance'
  | 'sensitive_financial'
  | 'regulatory_data'
  | 'data_quality'
  | 'regulatory_reports';

/** What a role may do with the data it can see. */
export type Capability =
  | 'view_aggregate'
  | 'view_detailed_records'
  | 'view_customer_level'
  | 'view_account_level'
  | 'view_transaction_level'
  | 'cross_branch_analysis'
  | 'cross_region_analysis'
  | 'enterprise_analysis'
  | 'view_dq_scores'
  | 'view_dq_exceptions'
  | 'resolve_exceptions'
  | 'generate_regulatory_report'
  | 'approve_regulatory_report'
  | 'configure_dq_rules'
  | 'view_audit_trail'
  | 'run_validation';

/** Breadth of data a role or a question covers. Ordered by rank(). */
export type ScopeLevel = 'enterprise' | 'state' | 'region' | 'zone' | 'branch';

export interface DataScope {
  level: ScopeLevel;
  /** Shown in the UI, e.g. "Ranchi Zone — 7 branches" */
  label: string;
  states?: string[];
  regions?: string[];
  zones?: string[];
  branches?: string[];
}

export interface PermissionProfile {
  id: RoleId;
  title: string;
  /** One line describing the role's remit, shown under the selector */
  remit: string;
  scope: DataScope;
  domains: DataDomain[];
  capabilities: Capability[];
  /** Plain-language items for the Access Control panel's restricted list */
  restrictions: string[];
}

export interface AuthorizationRequest {
  question: string;
  roleId: RoleId;
}

/** What the question appears to ask for, in permission terms. */
export interface RequestedAccess {
  scopeLevel: ScopeLevel;
  /** e.g. "All branches across Jharkhand" */
  scopeLabel: string;
  /** Named areas the question referred to, if any */
  namedAreas: string[];
  domains: DataDomain[];
  capabilities: Capability[];
}

export interface AuthorizationDecision {
  allowed: boolean;
  role: PermissionProfile;
  requested: RequestedAccess;
  /** Capability that decided a denial, when there was one */
  blockingCapability?: Capability;
  /** Plain-language reasons, shown in the "Why was this blocked?" panel */
  reasons: string[];
  /** Always true in this build — the UI must never present this as enforced */
  simulated: true;
}

export interface PermissionService {
  listRoles(): PermissionProfile[];
  getRole(id: RoleId): PermissionProfile;
  /** Async so a network-backed implementation drops in unchanged */
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}

/** Broader scopes rank higher. A role may act within its own rank and below. */
export function rank(level: ScopeLevel): number {
  switch (level) {
    case 'enterprise': return 5;
    case 'state': return 4;
    case 'region': return 3;
    case 'zone': return 2;
    case 'branch': return 1;
  }
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  view_aggregate: 'Aggregate reporting',
  view_detailed_records: 'Detailed record access',
  view_customer_level: 'Customer-level data',
  view_account_level: 'Account-level data',
  view_transaction_level: 'Transaction-level data',
  cross_branch_analysis: 'Cross-branch analysis',
  cross_region_analysis: 'Cross-region analysis',
  enterprise_analysis: 'Enterprise-wide analysis',
  view_dq_scores: 'View data quality scores',
  view_dq_exceptions: 'View DQ exceptions',
  resolve_exceptions: 'Resolve exceptions',
  generate_regulatory_report: 'Generate regulatory reports',
  approve_regulatory_report: 'Approve regulatory reports',
  configure_dq_rules: 'Configure DQ rules',
  view_audit_trail: 'View audit trail',
  run_validation: 'Run validation',
};

export const DOMAIN_LABELS: Record<DataDomain, string> = {
  customer_data: 'Customer data',
  account_data: 'Account data',
  loan_data: 'Loan data',
  transaction_data: 'Transaction data',
  employee_data: 'Employee data',
  branch_data: 'Branch data',
  financial_performance: 'Financial performance',
  sensitive_financial: 'Sensitive financial information',
  regulatory_data: 'Regulatory data',
  data_quality: 'Data quality',
  regulatory_reports: 'Regulatory reports',
};
