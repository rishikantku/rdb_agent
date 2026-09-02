// ============================================================================
// Database Validation & Row Count Report
// ============================================================================
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function validate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== DATABASE VALIDATION REPORT ===\n');

  // 1. Table row counts
  console.log('--- TABLE ROW COUNTS ---');
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  let totalRows = 0;
  for (const row of tables.rows) {
    const cnt = await client.query(`SELECT COUNT(*) AS c FROM "${row.table_name}"`);
    const count = Number(cnt.rows[0].c);
    totalRows += count;
    console.log(`  ${row.table_name.padEnd(30)} ${String(count).padStart(8)} rows`);
  }
  console.log(`  ${'TOTAL'.padEnd(30)} ${String(totalRows).padStart(8)} rows\n`);

  // 2. View count
  const views = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'VIEW'
    ORDER BY table_name
  `);
  console.log(`--- VIEWS: ${views.rowCount} ---`);
  for (const v of views.rows) console.log(`  ${v.table_name}`);
  console.log('');

  // 3. Index count
  const idxCount = await client.query(`
    SELECT COUNT(*) AS c FROM pg_indexes WHERE schemaname = 'public'
  `);
  console.log(`--- INDEXES: ${idxCount.rows[0].c} ---\n`);

  // 4. FK constraints
  const fkCount = await client.query(`
    SELECT COUNT(*) AS c FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
  `);
  console.log(`--- FOREIGN KEYS: ${fkCount.rows[0].c} ---\n`);

  // 5. Check constraints
  const checkCount = await client.query(`
    SELECT COUNT(*) AS c FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_type = 'CHECK'
  `);
  console.log(`--- CHECK CONSTRAINTS: ${checkCount.rows[0].c} ---\n`);

  // 6. Database size
  const sizeRes = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`);
  console.log(`--- DATABASE SIZE: ${sizeRes.rows[0].size} ---\n`);

  // 7. FK integrity check (sample)
  console.log('--- FK INTEGRITY CHECKS ---');
  const fkChecks: [string, string, string, string][] = [
    ['regions', 'state_id', 'states', 'state_id'],
    ['zones', 'region_id', 'regions', 'region_id'],
    ['branches', 'zone_id', 'zones', 'zone_id'],
    ['employees', 'branch_id', 'branches', 'branch_id'],
    ['employees', 'department_id', 'departments', 'department_id'],
    ['customers', 'branch_id', 'branches', 'branch_id'],
    ['customers', 'segment_id', 'customer_segments', 'segment_id'],
    ['accounts', 'customer_id', 'customers', 'customer_id'],
    ['accounts', 'account_type_id', 'account_types', 'account_type_id'],
    ['transactions', 'account_id', 'accounts', 'account_id'],
    ['loans', 'customer_id', 'customers', 'customer_id'],
    ['loans', 'branch_id', 'branches', 'branch_id'],
    ['loan_payments', 'loan_id', 'loans', 'loan_id'],
    ['employee_performance', 'employee_id', 'employees', 'employee_id'],
  ];

  let fkPass = 0;
  for (const [child, childCol, parent, parentCol] of fkChecks) {
    try {
      const res = await client.query(`
        SELECT COUNT(*) AS orphans
        FROM "${child}" c
        LEFT JOIN "${parent}" p ON c."${childCol}" = p."${parentCol}"
        WHERE c."${childCol}" IS NOT NULL AND p."${parentCol}" IS NULL
      `);
      const orphans = Number(res.rows[0].orphans);
      if (orphans > 0) {
        console.log(`  ❌ ${child}.${childCol} → ${parent}.${parentCol}: ${orphans} orphan rows`);
      } else {
        console.log(`  ✅ ${child}.${childCol} → ${parent}.${parentCol}: OK`);
        fkPass++;
      }
    } catch (err: any) {
      console.log(`  ⚠️  ${child}.${childCol} → ${parent}.${parentCol}: ${err.message}`);
    }
  }
  console.log(`\n  FK checks: ${fkPass}/${fkChecks.length} passed\n`);

  // 8. Data distribution checks
  console.log('--- DATA DISTRIBUTION CHECKS ---');

  // Employees per branch
  const empPerBranch = await client.query(`
    SELECT MIN(cnt) AS min_emps, MAX(cnt) AS max_emps, ROUND(AVG(cnt), 1) AS avg_emps
    FROM (SELECT branch_id, COUNT(*) AS cnt FROM employees GROUP BY branch_id) sub
  `);
  if (empPerBranch.rows[0].avg_emps) {
    console.log(`  Employees per branch: min=${empPerBranch.rows[0].min_emps}, max=${empPerBranch.rows[0].max_emps}, avg=${empPerBranch.rows[0].avg_emps}`);
  }

  // Designation distribution
  const desigDist = await client.query(`
    SELECT designation, COUNT(*) AS cnt, ROUND(COUNT(*)::numeric * 100 / SUM(COUNT(*)) OVER(), 1) AS pct
    FROM employees GROUP BY designation ORDER BY cnt DESC
  `);
  console.log('  Designation distribution:');
  for (const d of desigDist.rows) {
    console.log(`    ${d.designation.padEnd(20)} ${String(d.cnt).padStart(6)} (${d.pct}%)`);
  }

  // Employment type distribution
  const empTypeDist = await client.query(`
    SELECT employment_type, COUNT(*) AS cnt FROM employees GROUP BY employment_type ORDER BY cnt DESC
  `);
  console.log('  Employment type distribution:');
  for (const d of empTypeDist.rows) {
    console.log(`    ${d.employment_type.padEnd(15)} ${d.cnt}`);
  }

  // Employee status distribution
  const statusDist = await client.query(`
    SELECT status, COUNT(*) AS cnt FROM employees GROUP BY status ORDER BY cnt DESC
  `);
  console.log('  Employee status distribution:');
  for (const d of statusDist.rows) {
    console.log(`    ${d.status.padEnd(15)} ${d.cnt}`);
  }

  console.log('\n=== VALIDATION COMPLETE ===');
  await client.end();
}

validate().catch(err => { console.error('FATAL:', err); process.exit(1); });
