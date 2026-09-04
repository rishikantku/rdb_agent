// ============================================================================
// Reconciliation Engine — Cross-System Data Comparison
// ============================================================================
// Deterministic cross-system reconciliation. Compares data across CBS, GL,
// MIS, and the regulatory dataset to identify mismatches with branch-level
// drill-down.
// ============================================================================

import type { ReconciliationResult } from './types.js';
import { MOCK_RECONCILIATIONS } from './mock-data.js';

export class ReconciliationEngine {
  private results: ReconciliationResult[];

  constructor() {
    this.results = [...MOCK_RECONCILIATIONS];
  }

  /** Get all reconciliation results */
  getAllResults(): ReconciliationResult[] {
    return this.results;
  }

  /** Get mismatched reconciliations only */
  getMismatches(): ReconciliationResult[] {
    return this.results.filter(r => r.status === 'mismatched');
  }

  /** Get reconciliation by data element */
  getByDataElement(dataElement: string): ReconciliationResult | undefined {
    return this.results.find(r => r.dataElement === dataElement);
  }

  /** Get total financial impact of all mismatches (in lakhs) */
  getTotalMismatchAmount(): number {
    return this.results
      .filter(r => r.status === 'mismatched')
      .reduce((sum, r) => sum + r.differenceAbs, 0);
  }

  /** Get reconciliation summary */
  getSummary(): { total: number; matched: number; mismatched: number; tolerance: number; totalDifference: number } {
    return {
      total: this.results.length,
      matched: this.results.filter(r => r.status === 'matched').length,
      mismatched: this.results.filter(r => r.status === 'mismatched').length,
      tolerance: this.results.filter(r => r.status === 'tolerance').length,
      totalDifference: this.getTotalMismatchAmount(),
    };
  }
}
