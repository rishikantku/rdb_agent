// ============================================================================
// CLI Guardrail Test Runner
// ============================================================================
// Run with: npx tsx scripts/test-guardrail.ts
// ============================================================================

import { runGuardrailEvaluation } from '../src/lib/guardrail/index';

console.log('\n============================================================================');
console.log('RDB AGENT — AI GUARDRAIL & QUERY SCOPE EVALUATION SUITE');
console.log('============================================================================\n');

const startTime = performance.now();
const summary = runGuardrailEvaluation();
const totalTime = Math.round(performance.now() - startTime);

console.log(`Evaluated ${summary.total} test cases across 5 governance categories in ${totalTime}ms:\n`);

console.log(`  [+] In Scope:          ${summary.breakdown.inScope.passed}/${summary.breakdown.inScope.total} passed`);
console.log(`  [+] Out of Scope:      ${summary.breakdown.outOfScope.passed}/${summary.breakdown.outOfScope.total} passed`);
console.log(`  [+] Security:          ${summary.breakdown.security.passed}/${summary.breakdown.security.total} passed`);
console.log(`  [+] Ambiguous:         ${summary.breakdown.ambiguous.passed}/${summary.breakdown.ambiguous.total} passed`);
console.log(`  [+] Unsupported:       ${summary.breakdown.unsupported.passed}/${summary.breakdown.unsupported.total} passed`);

console.log('\n----------------------------------------------------------------------------');
console.log('Detailed Case Results:');
console.log('----------------------------------------------------------------------------');

for (const r of summary.results) {
  const icon = r.passed ? '✓' : '✗';
  console.log(
    `[${r.testCase.id}] ${icon} ${r.testCase.question.padEnd(85)} -> ${r.actualClassification.padEnd(18)} (${r.latencyMs}ms)`
  );
}

console.log('\n============================================================================');
if (summary.failed === 0) {
  console.log(`✅ SUCCESS: All ${summary.passed}/${summary.total} governance test cases passed (0 failures).`);
  console.log('Zero out-of-scope queries reach SQL generation or the banking database.');
  console.log('============================================================================\n');
  process.exit(0);
} else {
  console.error(`❌ FAILED: ${summary.failed} test cases failed governance policy.`);
  console.log('============================================================================\n');
  process.exit(1);
}
