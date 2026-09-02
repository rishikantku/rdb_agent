// ============================================================================
// Execute SQL file against the Neon database
// Usage: npx tsx database/seed/run-sql.ts <path-to-sql-file>
// ============================================================================
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: npx tsx database/seed/run-sql.ts <path-to-sql-file>');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`[SQL] Connected. Executing: ${sqlFile}`);

  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf-8');
  const start = performance.now();

  try {
    await client.query(sql);
    const elapsed = Math.round(performance.now() - start);
    console.log(`[SQL] ✅ Success in ${elapsed}ms`);
  } catch (err: any) {
    console.error(`[SQL] ❌ Error:`, err.message);
    if (err.position) {
      const pos = parseInt(err.position, 10);
      const context = sql.substring(Math.max(0, pos - 100), pos + 100);
      console.error(`[SQL] Near position ${pos}:\n${context}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
