// ============================================================================
// Role matrix — the single place permissions are defined
// ============================================================================
// Every scope below uses real values from the demonstration database:
//   Jharkhand Region holds 5 zones — Ranchi, Bokaro, Dhanbad, Hazaribagh,
//   Jamshedpur — and Ranchi Zone holds 7 branches.
//
// Edit this file to change what any role can see during a demonstration.
// No permission logic lives in the components.
// ============================================================================

import type { PermissionProfile, RoleId } from './types';

export const ROLES: Record<RoleId, PermissionProfile> = {
  DGM: {
    id: 'DGM',
    title: 'DGM',
    remit: 'Deputy General Manager — enterprise oversight',
    scope: {
      level: 'enterprise',
      label: 'All regions, zones and branches',
    },
    domains: [
      'customer_data', 'account_data', 'loan_data', 'transaction_data',
      'employee_data', 'branch_data', 'financial_performance', 'sensitive_financial',
      'regulatory_data', 'data_quality', 'regulatory_reports',
    ],
    capabilities: [
      'view_aggregate', 'view_detailed_records', 'view_customer_level',
      'view_account_level', 'view_transaction_level',
      'cross_branch_analysis', 'cross_region_analysis', 'enterprise_analysis',
      'view_dq_scores', 'view_dq_exceptions', 'resolve_exceptions',
      'generate_regulatory_report', 'approve_regulatory_report',
      'configure_dq_rules', 'view_audit_trail', 'run_validation',
    ],
    restrictions: [],
  },

  SENIOR_MANAGER: {
    id: 'SENIOR_MANAGER',
    title: 'Senior Manager',
    remit: 'Regional oversight across Jharkhand',
    scope: {
      level: 'region',
      label: 'Jharkhand Region — 5 zones',
      regions: ['Jharkhand Region'],
      zones: ['Ranchi Zone', 'Bokaro Zone', 'Dhanbad Zone', 'Hazaribagh Zone', 'Jamshedpur Zone'],
    },
    domains: [
      'customer_data', 'account_data', 'loan_data', 'transaction_data',
      'branch_data', 'financial_performance',
    ],
    capabilities: [
      'view_aggregate', 'view_detailed_records', 'view_customer_level',
      'view_account_level', 'cross_branch_analysis', 'cross_region_analysis',
    ],
    restrictions: [
      'Other regions',
      'Enterprise-wide analysis',
      'Employee records',
      'Sensitive financial information',
    ],
  },

  AGM: {
    id: 'AGM',
    title: 'AGM',
    remit: 'Assistant General Manager — Ranchi Zone',
    scope: {
      level: 'zone',
      label: 'Ranchi Zone — 7 branches',
      regions: ['Jharkhand Region'],
      zones: ['Ranchi Zone'],
    },
    domains: [
      'customer_data', 'account_data', 'loan_data', 'transaction_data',
      'branch_data', 'financial_performance',
    ],
    capabilities: [
      'view_aggregate', 'view_detailed_records', 'view_customer_level',
      'view_account_level', 'cross_branch_analysis',
    ],
    restrictions: [
      'Other zones and regions',
      'Enterprise-wide customer data',
      'Enterprise-wide transactions',
      'Employee records',
      'Sensitive financial information',
    ],
  },

  BRANCH_MANAGER: {
    id: 'BRANCH_MANAGER',
    title: 'Branch Manager',
    remit: 'Branch BR0001, Ranchi Zone',
    scope: {
      level: 'branch',
      label: 'Branch BR0001 only',
      regions: ['Jharkhand Region'],
      zones: ['Ranchi Zone'],
      branches: ['Branch BR0001'],
    },
    domains: [
      'customer_data', 'account_data', 'loan_data', 'transaction_data',
      'branch_data', 'financial_performance',
    ],
    capabilities: [
      'view_aggregate', 'view_detailed_records', 'view_customer_level', 'view_account_level',
    ],
    restrictions: [
      'Any branch other than BR0001',
      'Cross-branch and cross-zone analysis',
      'Regional and enterprise reporting',
      'Employee records',
    ],
  },

  ANALYST: {
    id: 'ANALYST',
    title: 'Analyst',
    remit: 'Enterprise reporting, aggregates only',
    scope: {
      level: 'enterprise',
      label: 'All regions — aggregate figures only',
    },
    domains: ['loan_data', 'account_data', 'transaction_data', 'branch_data', 'financial_performance',
      'data_quality', 'regulatory_data'],
    capabilities: [
      'view_aggregate', 'cross_branch_analysis', 'cross_region_analysis', 'enterprise_analysis',
      'view_dq_scores',
    ],
    restrictions: [
      'Customer-level records',
      'Account-level records',
      'Transaction-level records',
      'Employee records',
      'Sensitive financial information',
      'Exception resolution',
      'Report approval',
    ],
  },

  REGULATORY_OFFICER: {
    id: 'REGULATORY_OFFICER',
    title: 'Regulatory Reporting Officer',
    remit: 'Regulatory report generation, validation, and exception management',
    scope: {
      level: 'enterprise',
      label: 'All regions — regulatory data',
    },
    domains: [
      'regulatory_data', 'data_quality', 'regulatory_reports',
      'loan_data', 'account_data', 'branch_data', 'financial_performance',
    ],
    capabilities: [
      'view_aggregate', 'view_detailed_records',
      'cross_branch_analysis', 'cross_region_analysis', 'enterprise_analysis',
      'view_dq_scores', 'view_dq_exceptions', 'resolve_exceptions',
      'generate_regulatory_report', 'run_validation', 'view_audit_trail',
    ],
    restrictions: [
      'Report approval (checker)',
      'DQ rule configuration',
      'Employee records',
      'Sensitive financial information',
    ],
  },

  COMPLIANCE: {
    id: 'COMPLIANCE',
    title: 'Compliance Officer',
    remit: 'Regulatory compliance oversight — read-only',
    scope: {
      level: 'enterprise',
      label: 'All regions — compliance view',
    },
    domains: [
      'regulatory_data', 'data_quality', 'regulatory_reports',
      'loan_data', 'account_data', 'branch_data',
    ],
    capabilities: [
      'view_aggregate', 'cross_branch_analysis', 'cross_region_analysis', 'enterprise_analysis',
      'view_dq_scores', 'view_dq_exceptions', 'view_audit_trail',
    ],
    restrictions: [
      'Report generation',
      'Exception resolution',
      'Report approval',
      'DQ rule configuration',
      'Employee records',
      'Transaction-level data',
    ],
  },

  AUDITOR: {
    id: 'AUDITOR',
    title: 'Auditor',
    remit: 'Audit trail inspection and historical review — read-only',
    scope: {
      level: 'enterprise',
      label: 'All regions — audit view',
    },
    domains: [
      'regulatory_data', 'data_quality', 'regulatory_reports',
    ],
    capabilities: [
      'view_aggregate', 'enterprise_analysis',
      'view_dq_scores', 'view_dq_exceptions', 'view_audit_trail',
    ],
    restrictions: [
      'Report generation',
      'Exception resolution',
      'Report approval',
      'DQ rule configuration',
      'Customer-level data',
      'Account-level data',
      'Employee records',
      'Financial data',
    ],
  },
};

export const ROLE_ORDER: RoleId[] = [
  'DGM', 'SENIOR_MANAGER', 'AGM', 'BRANCH_MANAGER', 'ANALYST',
  'REGULATORY_OFFICER', 'COMPLIANCE', 'AUDITOR',
];

/**
 * Names of areas in the demonstration data, with the everyday phrasings people
 * use for them. "Ranchi region" in conversation means Ranchi Zone in this data.
 */
export const AREA_ALIASES: { match: string[]; canonical: string; level: 'state' | 'region' | 'zone' | 'branch' }[] = [
  { match: ['jharkhand region', 'jharkhand'], canonical: 'Jharkhand Region', level: 'region' },
  { match: ['bihar region', 'bihar'], canonical: 'Bihar Region', level: 'region' },
  { match: ['ranchi zone', 'ranchi region', 'ranchi'], canonical: 'Ranchi Zone', level: 'zone' },
  { match: ['bokaro zone', 'bokaro'], canonical: 'Bokaro Zone', level: 'zone' },
  { match: ['dhanbad zone', 'dhanbad'], canonical: 'Dhanbad Zone', level: 'zone' },
  { match: ['hazaribagh zone', 'hazaribagh'], canonical: 'Hazaribagh Zone', level: 'zone' },
  { match: ['jamshedpur zone', 'jamshedpur'], canonical: 'Jamshedpur Zone', level: 'zone' },
  { match: ['br0001', 'branch br0001'], canonical: 'Branch BR0001', level: 'branch' },
];

/**
 * Real areas from the demonstration database, grouped for the role-permission
 * preview in Settings.
 */
export const DEMO_AREAS: Record<string, string[]> = {
  enterprise: ['All regions, zones and branches'],
  state: ['Jharkhand', 'Bihar'],
  region: ['Jharkhand Region', 'Bihar Region', 'Eastern Region', 'Central Region'],
  zone: ['Ranchi Zone', 'Bokaro Zone', 'Dhanbad Zone', 'Hazaribagh Zone', 'Jamshedpur Zone'],
  branch: ['Branch BR0001', 'Branch BR0008', 'Branch BR0015', 'Branch BR0022', 'Branch BR0027'],
};
