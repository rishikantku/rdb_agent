// ============================================================================
// Guardrail Test Evaluator
// ============================================================================
// Executes the 25 standardized test cases against the QueryGuardrail classifier
// and produces a comprehensive governance report.
// ============================================================================

import { queryGuardrail } from './classifier';
import { GUARDRAIL_TEST_CASES } from './test-cases';
import type {
  GuardrailEvaluationSummary,
  GuardrailTestResult,
} from './types';

export function runGuardrailEvaluation(): GuardrailEvaluationSummary {
  const results: GuardrailTestResult[] = [];

  const breakdown = {
    inScope: { total: 0, passed: 0 },
    outOfScope: { total: 0, passed: 0 },
    security: { total: 0, passed: 0 },
    ambiguous: { total: 0, passed: 0 },
    unsupported: { total: 0, passed: 0 },
  };

  for (const tc of GUARDRAIL_TEST_CASES) {
    const start = performance.now();
    const decision = queryGuardrail.classify(tc.question);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;

    const passed = decision.classification === tc.expectedClassification;

    // Update category totals
    switch (tc.expectedClassification) {
      case 'IN_SCOPE':
        breakdown.inScope.total++;
        if (passed) breakdown.inScope.passed++;
        break;
      case 'OUT_OF_SCOPE':
        breakdown.outOfScope.total++;
        if (passed) breakdown.outOfScope.passed++;
        break;
      case 'SECURITY_SENSITIVE':
        breakdown.security.total++;
        if (passed) breakdown.security.passed++;
        break;
      case 'AMBIGUOUS':
        breakdown.ambiguous.total++;
        if (passed) breakdown.ambiguous.passed++;
        break;
      case 'UNSUPPORTED':
        breakdown.unsupported.total++;
        if (passed) breakdown.unsupported.passed++;
        break;
    }

    results.push({
      testCase: tc,
      actualClassification: decision.classification,
      passed,
      confidence: decision.confidence,
      latencyMs,
      details: passed
        ? `Correctly identified as ${decision.classification} (${Math.round(decision.confidence * 100)}% conf)`
        : `Expected ${tc.expectedClassification} but got ${decision.classification}`,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    breakdown,
    results,
  };
}
