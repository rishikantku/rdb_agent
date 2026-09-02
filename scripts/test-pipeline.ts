// ============================================================================
// End-to-End Pipeline Test
// ============================================================================
// Tests the full pipeline: init → schema load → LLM query → SQL → DB → result
//
// Usage:
//   npx tsx scripts/test-pipeline.ts
//   npx tsx scripts/test-pipeline.ts --health-only   # Just check health
//   npx tsx scripts/test-pipeline.ts --query "show top 10 branches"
// ============================================================================

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();

import { initializeBackend, healthCheck, BackendServices } from '../src/backend/init.js';

async function main() {
  const args = process.argv.slice(2);
  const healthOnly = args.includes('--health-only');
  const queryIdx = args.indexOf('--query');
  const customQuery = queryIdx !== -1 ? args[queryIdx + 1] : null;

  const databaseDir = path.join(process.cwd(), 'database');

  console.log('=== RDB Agent Pipeline Test ===\n');

  // 1. Initialize
  let services: BackendServices;
  try {
    services = await initializeBackend({ databaseDir });
  } catch (err: any) {
    console.error('❌ Initialization failed:', err.message);
    process.exit(1);
  }

  // 2. Health Check
  console.log('\n--- Health Check ---');
  const health = await healthCheck(services);
  console.log(`  Database: ${health.database.connected ? '✅' : '❌'} (${health.database.latencyMs}ms)`);
  console.log(`  LLM:      ${health.llm.healthy ? '✅' : '❌'} ${health.llm.model} (${health.llm.latencyMs}ms)${health.llm.error ? ' — ' + health.llm.error : ''}`);
  console.log(`  Schema:   ${health.schema.tables} tables, ${health.schema.terms} terms`);

  if (healthOnly) {
    await services.db.disconnect();
    return;
  }

  // 3. Schema Retrieval Test
  console.log('\n--- Schema Retrieval Test ---');
  const testQueries = [
    'Show top 10 branches in Jharkhand by employee strength',
    'Find employees whose salary is above their department average',
    'What is the NPA ratio by branch?',
  ];

  for (const q of testQueries) {
    const retrieval = services.schemaRetriever.retrieve(q);
    console.log(`\n  Q: "${q}"`);
    console.log(`  Tables: [${retrieval.retrievedTableNames.join(', ')}]`);
    console.log(`  Terms: [${retrieval.semanticResolution.resolvedTerms.map(t => t.originalTerm).join(', ')}]`);
    console.log(`  Rules: ${retrieval.semanticResolution.businessRules.length}`);
    console.log(`  Ambiguous: ${retrieval.hasAmbiguity ? 'YES' : 'no'}`);
  }

  // 4. Full Pipeline Test (if LLM is available)
  if (health.llm.healthy) {
    console.log('\n--- Full Pipeline Test ---');
    const question = customQuery || 'Show the top 5 branches by active employee count with their average salary';

    console.log(`\n  Question: "${question}"`);
    console.log('  Processing...\n');

    try {
      const result = await services.orchestrator.processQuery({ question });

      if (result.success) {
        console.log(`  ✅ Success!`);
        console.log(`  Summary: ${result.summary}`);
        console.log(`  Rows: ${result.rowCount}`);
        console.log(`  Time: ${result.executionTimeMs}ms`);
        console.log(`  SQL:\n${result.sql?.split('\n').map(l => '    ' + l).join('\n')}`);

        if (result.data && result.data.length > 0) {
          console.log(`\n  Sample data (first 3 rows):`);
          const cols = Object.keys(result.data[0]);
          console.log(`    ${cols.join(' | ')}`);
          for (const row of result.data.slice(0, 3)) {
            console.log(`    ${cols.map(c => String(row[c] ?? 'NULL').substring(0, 20)).join(' | ')}`);
          }
        }

        if (result.debug) {
          console.log(`\n  Debug:`);
          console.log(`    Model: ${result.debug.model}`);
          console.log(`    Intent: ${result.debug.interpretedIntent}`);
          console.log(`    Tables: [${result.debug.tablesSelected.join(', ')}]`);
          console.log(`    LLM latency: ${result.debug.llmLatencyMs}ms`);
          console.log(`    Repair attempts: ${result.debug.repairAttempts}`);
          console.log(`    Stages:`);
          for (const stage of result.debug.pipelineStages) {
            console.log(`      ${stage.status === 'success' ? '✅' : '❌'} ${stage.name}: ${stage.durationMs}ms${stage.details ? ' — ' + stage.details : ''}`);
          }
        }
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
        if (result.sql) console.log(`  Generated SQL: ${result.sql}`);
        if (result.debug?.pipelineStages) {
          for (const stage of result.debug.pipelineStages) {
            console.log(`    ${stage.status === 'success' ? '✅' : '❌'} ${stage.name}: ${stage.durationMs}ms${stage.details ? ' — ' + stage.details : ''}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`  ❌ Pipeline error: ${err.message}`);
    }
  } else {
    console.log('\n⚠️  LLM not available — skipping full pipeline test');
    console.log('  Deploy Qwen3-Coder-Next: npx tsx scripts/deploy-runpod.ts');
  }

  console.log('\n=== Test Complete ===');
  await services.db.disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
