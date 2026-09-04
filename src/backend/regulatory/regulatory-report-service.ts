// ============================================================================
// Regulatory Report Service — Report Generation & Maker-Checker Workflow
// ============================================================================
// Metadata-driven report generation with full maker-checker workflow.
// Report templates are configurable, not hard-coded.
//
// Workflow: Draft → Data Ingestion → Validation → Exception Resolution →
//           Re-validation → Ready for Review → Maker Submitted →
//           Checker Approved → Submission Ready
// ============================================================================

import type { ReportDefinition, RegulatoryReport, WorkflowState, WorkflowTransition } from './types.js';
import { MOCK_REPORT_DEFINITIONS, MOCK_REPORT_INSTANCES } from './mock-data.js';

export class RegulatoryReportService {
  private definitions: ReportDefinition[];
  private instances: RegulatoryReport[];

  constructor() {
    this.definitions = [...MOCK_REPORT_DEFINITIONS];
    this.instances = [...MOCK_REPORT_INSTANCES];
  }

  // -----------------------------------------------------------------------
  // Report Definitions (Templates)
  // -----------------------------------------------------------------------

  /** Get all report definitions */
  getAllDefinitions(): ReportDefinition[] {
    return this.definitions;
  }

  /** Get a report definition by ID */
  getDefinition(reportId: string): ReportDefinition | undefined {
    return this.definitions.find(d => d.reportId === reportId);
  }

  // -----------------------------------------------------------------------
  // Report Instances
  // -----------------------------------------------------------------------

  /** Get all report instances */
  getAllInstances(): RegulatoryReport[] {
    return this.instances;
  }

  /** Get instances for a specific reporting period */
  getByPeriod(reportingPeriod: string): RegulatoryReport[] {
    return this.instances.filter(i => i.reportingPeriod === reportingPeriod);
  }

  /** Get a specific report instance */
  getInstance(instanceId: string): RegulatoryReport | undefined {
    return this.instances.find(i => i.instanceId === instanceId);
  }

  /** Get reports not yet submission-ready */
  getPendingReports(): RegulatoryReport[] {
    return this.instances.filter(i => i.workflowState !== 'submission_ready');
  }

  /** Get reports in a specific workflow state */
  getByWorkflowState(state: WorkflowState): RegulatoryReport[] {
    return this.instances.filter(i => i.workflowState === state);
  }

  // -----------------------------------------------------------------------
  // Workflow Actions
  // -----------------------------------------------------------------------

  /** Transition a report to the next workflow state */
  transitionState(
    instanceId: string,
    toState: WorkflowState,
    actionBy: string,
    comments: string = '',
  ): RegulatoryReport | undefined {
    const report = this.instances.find(i => i.instanceId === instanceId);
    if (!report) return undefined;

    const transition: WorkflowTransition = {
      fromState: report.workflowState,
      toState,
      actionBy,
      actionAt: new Date().toISOString(),
      comments,
    };

    report.workflowState = toState;
    report.lastActionBy = actionBy;
    report.lastActionAt = transition.actionAt;
    report.history.push(transition);

    // Set maker/checker on appropriate transitions
    if (toState === 'maker_submitted') {
      report.maker = actionBy;
    }
    if (toState === 'checker_approved') {
      report.checker = actionBy;
    }

    return report;
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  /** Get workflow summary across all current period reports */
  getWorkflowSummary(reportingPeriod: string): {
    total: number;
    submissionReady: number;
    inProgress: number;
    blocked: number;
    reports: { name: string; state: WorkflowState; score: number | null; exceptions: number }[];
  } {
    const reports = this.getByPeriod(reportingPeriod);
    return {
      total: reports.length,
      submissionReady: reports.filter(r => r.workflowState === 'submission_ready' || r.workflowState === 'checker_approved').length,
      inProgress: reports.filter(r => !['submission_ready', 'checker_approved'].includes(r.workflowState)).length,
      blocked: reports.filter(r => r.criticalExceptionCount > 0).length,
      reports: reports.map(r => ({
        name: r.definition.reportName,
        state: r.workflowState,
        score: r.dqScore,
        exceptions: r.exceptionCount,
      })),
    };
  }
}
