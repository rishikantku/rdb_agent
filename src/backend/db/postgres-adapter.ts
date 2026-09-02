// ============================================================================
// PostgreSQL Database Adapter
// ============================================================================
// Primary adapter for the POC. Uses the 'pg' library (already a dependency).
// Implements the DatabaseAdapter interface with full schema introspection,
// query execution with timeouts, and connection pooling.
// ============================================================================

import { Client as PGClient, Pool as PGPool } from 'pg';
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  FieldInfo,
  SchemaIntrospection,
  IntrospectedTable,
  IntrospectedColumn,
  ConnectionTestResult,
  DialectHelpers,
  PostgresDialectHelpers,
} from './database-adapter.js';

export class PostgresAdapter extends DatabaseAdapter {
  private pool: PGPool | null = null;
  private connected = false;
  private dialectHelpers = new PostgresDialectHelpers();

  constructor(config: DatabaseConfig) {
    super({ ...config, dialect: 'postgresql' });
  }

  async connect(): Promise<void> {
    if (this.pool) {
      await this.disconnect();
    }

    const poolConfig: any = {
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: this.config.maxConnections || 5,
      idleTimeoutMillis: this.config.idleTimeoutMs || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMs || 10000,
    };

    // SSL support (required for Neon, AWS RDS, etc.)
    if (this.config.ssl) {
      poolConfig.ssl = typeof this.config.ssl === 'object'
        ? this.config.ssl
        : { rejectUnauthorized: false };
    }

    this.pool = new PGPool(poolConfig);

    // Test the connection
    const client = await this.pool.connect();
    client.release();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const clientConfig: any = {
        host: this.config.host || 'localhost',
        port: this.config.port || 5432,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectionTimeoutMillis: 5000,
      };

      if (this.config.ssl) {
        clientConfig.ssl = typeof this.config.ssl === 'object'
          ? this.config.ssl
          : { rejectUnauthorized: false };
      }

      const client = new PGClient(clientConfig);
      await client.connect();
      const versionRes = await client.query('SELECT version()');
      await client.end();
      const latencyMs = Math.round(performance.now() - start);

      return {
        success: true,
        latencyMs,
        serverVersion: versionRes.rows[0]?.version,
      };
    } catch (error: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: error.message,
      };
    }
  }

  async executeQuery(
    sql: string,
    params: any[] = [],
    timeoutMs?: number
  ): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const effectiveTimeout = timeoutMs || this.config.statementTimeoutMs || 30000;
    const start = performance.now();

    const client = await this.pool.connect();
    try {
      // Set statement timeout for this query
      await client.query(`SET statement_timeout = ${effectiveTimeout}`);

      // If read-only mode, enforce it
      if (this.config.readOnly) {
        await client.query('SET default_transaction_read_only = ON');
      }

      const result = await client.query(sql, params);
      const executionTimeMs = Math.round(performance.now() - start);

      const fields: FieldInfo[] = (result.fields || []).map((f: any) => ({
        name: f.name,
        dataType: this.pgTypeToString(f.dataTypeID),
      }));

      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        fields,
        executionTimeMs,
      };
    } finally {
      client.release();
    }
  }

  async introspectSchema(): Promise<SchemaIntrospection> {
    if (!this.pool) {
      throw new Error('Database not connected.');
    }

    // Get tables
    const tablesRes = await this.pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables: IntrospectedTable[] = [];
    const views: IntrospectedTable[] = [];

    for (const row of tablesRes.rows) {
      const columns = await this.introspectColumns(row.table_name);
      const entry: IntrospectedTable = {
        name: row.table_name,
        schema: 'public',
        columns,
      };

      if (row.table_type === 'VIEW') {
        views.push(entry);
      } else {
        tables.push(entry);
      }
    }

    return { tables, views };
  }

  async tableExists(tableName: string): Promise<boolean> {
    if (!this.pool) return false;
    const res = await this.pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [tableName.toLowerCase()]
    );
    return res.rowCount > 0;
  }

  async estimateRowCount(tableName: string): Promise<number> {
    if (!this.pool) return 0;
    // Use pg_class for fast estimation
    const res = await this.pool.query(
      `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1`,
      [tableName.toLowerCase()]
    );
    if (res.rows.length > 0 && res.rows[0].estimate >= 0) {
      return Number(res.rows[0].estimate);
    }
    // Fallback to actual count (for small tables)
    const countRes = await this.pool.query(
      `SELECT COUNT(*) AS count FROM "${tableName}"`
    );
    return Number(countRes.rows[0]?.count ?? 0);
  }

  isConnected(): boolean {
    return this.connected && this.pool !== null;
  }

  getDialectHelpers(): DialectHelpers {
    return this.dialectHelpers;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async introspectColumns(tableName: string): Promise<IntrospectedColumn[]> {
    // Get columns with types and nullability
    const colsRes = await this.pool!.query(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.udt_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = $1
      ORDER BY c.ordinal_position
    `, [tableName]);

    // Get primary key columns
    const pkRes = await this.pool!.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
    `, [tableName]);
    const pkColumns = new Set(pkRes.rows.map((r: any) => r.column_name));

    // Get foreign key columns
    const fkRes = await this.pool!.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [tableName]);
    const fkMap = new Map<string, { table: string; column: string }>();
    for (const fk of fkRes.rows) {
      fkMap.set(fk.column_name, {
        table: fk.foreign_table,
        column: fk.foreign_column,
      });
    }

    return colsRes.rows.map((row: any) => ({
      name: row.column_name,
      dataType: row.data_type,
      nullable: row.is_nullable === 'YES',
      isPrimaryKey: pkColumns.has(row.column_name),
      defaultValue: row.column_default || undefined,
      foreignKey: fkMap.get(row.column_name),
    }));
  }

  /**
   * Convert PostgreSQL OID type codes to human-readable type strings.
   * This is a simplified mapping for common types.
   */
  private pgTypeToString(oid: number): string {
    const typeMap: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double precision',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
      2950: 'uuid',
    };
    return typeMap[oid] || 'unknown';
  }
}
