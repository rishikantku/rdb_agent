// ============================================================================
// Audit Service — Immutable Audit Trail
// ============================================================================
// Logs every regulatory action for complete traceability. Every score
// calculation, rule execution, and state change is recorded.
// ============================================================================

import type { AuditEvent, AuditEventType } from './types.js';
import { MOCK_AUDIT_EVENTS } from './mock-data.js';

export class AuditService {
  private events: AuditEvent[];

  constructor() {
    this.events = [...MOCK_AUDIT_EVENTS];
  }

  /** Get all audit events (newest first) */
  getAllEvents(): AuditEvent[] {
    return [...this.events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** Get events by type */
  getByType(eventType: AuditEventType): AuditEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }

  /** Get events for a reporting period */
  getByPeriod(reportingPeriod: string): AuditEvent[] {
    return this.events
      .filter(e => e.reportingPeriod === reportingPeriod)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /** Log a new audit event (immutable append) */
  log(
    eventType: AuditEventType,
    userId: string,
    details: Record<string, any>,
    reportingPeriod: string,
    entity: string = 'All Regions',
  ): AuditEvent {
    const event: AuditEvent = {
      eventId: `AE-${Date.now()}`,
      eventType,
      timestamp: new Date().toISOString(),
      userId,
      details,
      reportingPeriod,
      entity,
    };
    this.events.push(event);
    return event;
  }

  /** Get event count by type */
  getSummary(): Record<AuditEventType, number> {
    const summary: Record<string, number> = {};
    for (const e of this.events) {
      summary[e.eventType] = (summary[e.eventType] || 0) + 1;
    }
    return summary as Record<AuditEventType, number>;
  }
}
