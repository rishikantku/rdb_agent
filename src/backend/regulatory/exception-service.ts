// ============================================================================
// Exception Service — Exception Management & Root-Cause Analysis
// ============================================================================
// Manages DQ exceptions with full lifecycle tracking: raise → acknowledge →
// assign → resolve → close. Provides root-cause drill-down chains.
// ============================================================================

import type { DQException, ExceptionStatus, Severity, DQDimension } from './types.js';
import { MOCK_EXCEPTIONS } from './mock-data.js';
import { SEVERITY_ORDER } from './types.js';

export class ExceptionService {
  private exceptions: DQException[];

  constructor() {
    this.exceptions = [...MOCK_EXCEPTIONS];
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  /** Get all exceptions */
  getAllExceptions(): DQException[] {
    return this.exceptions.sort((a, b) => SEVERITY_ORDER[a.priority] - SEVERITY_ORDER[b.priority]);
  }

  /** Get open (unresolved) exceptions */
  getOpenExceptions(): DQException[] {
    return this.exceptions
      .filter(e => e.status !== 'resolved' && e.status !== 'closed')
      .sort((a, b) => SEVERITY_ORDER[a.priority] - SEVERITY_ORDER[b.priority]);
  }

  /** Get exceptions by dimension */
  getByDimension(dimension: DQDimension): DQException[] {
    return this.exceptions.filter(e => e.ruleExecution.rule.dimension === dimension);
  }

  /** Get exceptions by severity */
  getBySeverity(severity: Severity): DQException[] {
    return this.exceptions.filter(e => e.priority === severity);
  }

  /** Get exceptions by status */
  getByStatus(status: ExceptionStatus): DQException[] {
    return this.exceptions.filter(e => e.status === status);
  }

  /** Get a specific exception */
  getException(exceptionId: string): DQException | undefined {
    return this.exceptions.find(e => e.exceptionId === exceptionId);
  }

  /** Get critical exceptions */
  getCriticalExceptions(): DQException[] {
    return this.exceptions.filter(e => e.priority === 'critical' && e.status !== 'resolved' && e.status !== 'closed');
  }

  /** Get high-severity (critical + high) open exceptions */
  getHighSeverityExceptions(): DQException[] {
    return this.exceptions.filter(e =>
      (e.priority === 'critical' || e.priority === 'high') &&
      e.status !== 'resolved' && e.status !== 'closed'
    );
  }

  // -----------------------------------------------------------------------
  // Lifecycle Actions
  // -----------------------------------------------------------------------

  /** Acknowledge an exception */
  acknowledge(exceptionId: string): DQException | undefined {
    return this.updateStatus(exceptionId, 'acknowledged');
  }

  /** Assign an exception */
  assign(exceptionId: string, assignedTo: string): DQException | undefined {
    const exc = this.exceptions.find(e => e.exceptionId === exceptionId);
    if (!exc) return undefined;
    exc.status = 'assigned';
    exc.assignedTo = assignedTo;
    exc.updatedAt = new Date().toISOString();
    return exc;
  }

  /** Mark as in progress */
  startWork(exceptionId: string): DQException | undefined {
    return this.updateStatus(exceptionId, 'in_progress');
  }

  /** Resolve an exception */
  resolve(exceptionId: string, notes: string): DQException | undefined {
    const exc = this.exceptions.find(e => e.exceptionId === exceptionId);
    if (!exc) return undefined;
    exc.status = 'resolved';
    exc.resolutionNotes = notes;
    exc.updatedAt = new Date().toISOString();
    return exc;
  }

  /** Close an exception */
  close(exceptionId: string): DQException | undefined {
    return this.updateStatus(exceptionId, 'closed');
  }

  private updateStatus(exceptionId: string, status: ExceptionStatus): DQException | undefined {
    const exc = this.exceptions.find(e => e.exceptionId === exceptionId);
    if (!exc) return undefined;
    exc.status = status;
    exc.updatedAt = new Date().toISOString();
    return exc;
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  /** Get exception summary counts */
  getSummary(): {
    total: number;
    open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
    totalFinancialImpact: number;
    byDimension: Record<DQDimension, number>;
    byOwner: { owner: string; count: number }[];
  } {
    const open = this.getOpenExceptions();
    const byOwner = new Map<string, number>();
    for (const e of open) {
      byOwner.set(e.ownerTeam, (byOwner.get(e.ownerTeam) || 0) + 1);
    }

    return {
      total: this.exceptions.length,
      open: open.length,
      critical: open.filter(e => e.priority === 'critical').length,
      high: open.filter(e => e.priority === 'high').length,
      medium: open.filter(e => e.priority === 'medium').length,
      low: open.filter(e => e.priority === 'low').length,
      resolved: this.exceptions.filter(e => e.status === 'resolved' || e.status === 'closed').length,
      totalFinancialImpact: this.exceptions
        .filter(e => e.status !== 'resolved' && e.status !== 'closed' && e.financialImpact !== null)
        .reduce((sum, e) => sum + (e.financialImpact || 0), 0),
      byDimension: {
        accuracy: this.getByDimension('accuracy').filter(e => e.status !== 'resolved' && e.status !== 'closed').length,
        completeness: this.getByDimension('completeness').filter(e => e.status !== 'resolved' && e.status !== 'closed').length,
        consistency: this.getByDimension('consistency').filter(e => e.status !== 'resolved' && e.status !== 'closed').length,
        timeliness: this.getByDimension('timeliness').filter(e => e.status !== 'resolved' && e.status !== 'closed').length,
      },
      byOwner: Array.from(byOwner.entries())
        .map(([owner, count]) => ({ owner, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
