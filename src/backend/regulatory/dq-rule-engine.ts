// ============================================================================
// DQ Rule Engine — Deterministic Validation
// ============================================================================
// Metadata-driven rule engine. Executes configured rules against regulatory
// datasets and produces deterministic pass/fail results.
//
// CRITICAL: This is a deterministic engine. No LLM dependency. Every result
// is traceable and reproducible from the same input data + rule configuration.
// ============================================================================

import type { DQRule, DQRuleExecution, DQDimension, RuleExecutionStatus } from './types.js';
import { MOCK_DQ_RULES, MOCK_RULE_EXECUTIONS } from './mock-data.js';

export class DQRuleEngine {
  private rules: DQRule[];
  private executions: DQRuleExecution[];

  constructor() {
    // In production, rules come from a database. POC uses mock data.
    this.rules = [...MOCK_DQ_RULES];
    this.executions = [...MOCK_RULE_EXECUTIONS];
  }

  // -----------------------------------------------------------------------
  // Rule Management
  // -----------------------------------------------------------------------

  /** Get all configured rules */
  getAllRules(): DQRule[] {
    return this.rules.filter(r => r.isActive);
  }

  /** Get rules by dimension */
  getRulesByDimension(dimension: DQDimension): DQRule[] {
    return this.rules.filter(r => r.isActive && r.dimension === dimension);
  }

  /** Get a specific rule by ID */
  getRule(ruleId: string): DQRule | undefined {
    return this.rules.find(r => r.ruleId === ruleId);
  }

  /** Get rules applicable to a specific report */
  getRulesForReport(reportId: string): DQRule[] {
    return this.rules.filter(r =>
      r.isActive && (r.applicableReports.length === 0 || r.applicableReports.includes(reportId))
    );
  }

  // -----------------------------------------------------------------------
  // Rule Execution
  // -----------------------------------------------------------------------

  /** Get all executions for a reporting period */
  getExecutions(reportingPeriod: string): DQRuleExecution[] {
    return this.executions.filter(e => e.reportingPeriod === reportingPeriod);
  }

  /** Get failed executions for a reporting period */
  getFailedExecutions(reportingPeriod: string): DQRuleExecution[] {
    return this.executions.filter(e => e.reportingPeriod === reportingPeriod && e.status === 'failed');
  }

  /** Get executions by dimension */
  getExecutionsByDimension(reportingPeriod: string, dimension: DQDimension): DQRuleExecution[] {
    return this.executions.filter(e =>
      e.reportingPeriod === reportingPeriod && e.rule.dimension === dimension
    );
  }

  /**
   * Execute all active rules for a reporting period.
   * In production, this would run validation queries against the regulatory data layer.
   * For the POC, returns pre-computed mock results.
   */
  executeRules(reportingPeriod: string): DQRuleExecution[] {
    // POC: return existing mock executions
    return this.getExecutions(reportingPeriod);
  }

  /**
   * Re-execute rules after data corrections.
   * Simulates resolution: marks specified exceptions as passed.
   */
  revalidate(reportingPeriod: string, resolvedRuleIds: string[]): DQRuleExecution[] {
    this.executions = this.executions.map(exec => {
      if (exec.reportingPeriod === reportingPeriod && resolvedRuleIds.includes(exec.ruleId)) {
        return {
          ...exec,
          status: 'passed' as RuleExecutionStatus,
          difference: 0,
          deviationPct: 0,
          affectedRecords: 0,
          affectedBranches: [],
          details: `Resolved — re-validated at ${new Date().toISOString()}`,
          executedAt: new Date().toISOString(),
        };
      }
      return exec;
    });
    return this.getExecutions(reportingPeriod);
  }

  // -----------------------------------------------------------------------
  // Summary Statistics
  // -----------------------------------------------------------------------

  /** Get execution summary for a period */
  getExecutionSummary(reportingPeriod: string): {
    total: number; passed: number; failed: number; skipped: number; error: number;
    byDimension: Record<DQDimension, { total: number; passed: number; failed: number }>;
  } {
    const execs = this.getExecutions(reportingPeriod);
    const dims: DQDimension[] = ['accuracy', 'completeness', 'consistency', 'timeliness'];
    const byDimension = {} as Record<DQDimension, { total: number; passed: number; failed: number }>;

    for (const dim of dims) {
      const dimExecs = execs.filter(e => e.rule.dimension === dim);
      byDimension[dim] = {
        total: dimExecs.length,
        passed: dimExecs.filter(e => e.status === 'passed').length,
        failed: dimExecs.filter(e => e.status === 'failed').length,
      };
    }

    return {
      total: execs.length,
      passed: execs.filter(e => e.status === 'passed').length,
      failed: execs.filter(e => e.status === 'failed').length,
      skipped: execs.filter(e => e.status === 'skipped').length,
      error: execs.filter(e => e.status === 'error').length,
      byDimension,
    };
  }
}
