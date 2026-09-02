// ============================================================================
// Database Adapter Abstraction
// ============================================================================
// Provides a uniform interface for database operations regardless of the
// underlying database engine. PostgreSQL is implemented first for the POC;
// Oracle can be added later by implementing the same interface.
//
// Architecture:
//   DatabaseAdapter (interface)
//     ├── PostgresAdapter   ← POC (implemented)
//     ├── OracleAdapter     ← Future
//     └── SQLiteAdapter     ← Dev/testing fallback
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SQLDialect = 'postgresql' | 'oracle' | 'sqlite';

export interface DatabaseConfig {
  dialect: SQLDialect;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  // SQLite-specific
  filepath?: string;
  // Connection pool
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  // Query safety
  statementTimeoutMs?: number;
  readOnly?: boolean;
  // SSL/TLS
  ssl?: boolean | { rejectUnauthorized?: boolean };
}

export interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  fields: FieldInfo[];
  executionTimeMs: number;
}

export interface FieldInfo {
  name: string;
  dataType: string;
}

export interface SchemaIntrospection {
  tables: IntrospectedTable[];
  views: IntrospectedTable[];
}

export interface IntrospectedTable {
  name: string;
  schema?: string;
  columns: IntrospectedColumn[];
}

export interface IntrospectedColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
  /** For FK columns: referenced table and column */
  foreignKey?: { table: string; column: string };
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Abstract Database Adapter
// ---------------------------------------------------------------------------

export abstract class DatabaseAdapter {
  protected config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /** Get the SQL dialect for this adapter */
  get dialect(): SQLDialect {
    return this.config.dialect;
  }

  /** Connect to the database */
  abstract connect(): Promise<void>;

  /** Disconnect from the database */
  abstract disconnect(): Promise<void>;

  /** Test the connection (with latency measurement) */
  abstract testConnection(): Promise<ConnectionTestResult>;

  /** Execute a read-only query */
  abstract executeQuery(sql: string, params?: any[], timeoutMs?: number): Promise<QueryResult>;

  /** Introspect the database schema (tables, views, columns, FKs) */
  abstract introspectSchema(): Promise<SchemaIntrospection>;

  /** Check if a table exists */
  abstract tableExists(tableName: string): Promise<boolean>;

  /** Get estimated row count for a table */
  abstract estimateRowCount(tableName: string): Promise<number>;

  /** Get the current connection status */
  abstract isConnected(): boolean;

  /** Get dialect-specific SQL helpers */
  abstract getDialectHelpers(): DialectHelpers;
}

// ---------------------------------------------------------------------------
// Dialect Helpers — SQL syntax differences between databases
// ---------------------------------------------------------------------------

export interface DialectHelpers {
  /** LIMIT clause: PostgreSQL uses LIMIT, Oracle uses FETCH FIRST / ROWNUM */
  limitClause(n: number): string;

  /** Current date/time function */
  currentTimestamp(): string;

  /** Date truncation to month/year */
  dateTrunc(part: 'year' | 'month' | 'quarter', column: string): string;

  /** Date difference in days */
  dateDiffDays(from: string, to: string): string;

  /** COALESCE / NVL */
  coalesce(column: string, defaultValue: string): string;

  /** String concatenation */
  concat(...parts: string[]): string;

  /** Boolean true/false literals */
  booleanTrue(): string;
  booleanFalse(): string;

  /** Fiscal year calculation (Indian fiscal year: April 1 - March 31) */
  fiscalYear(dateColumn: string): string;

  /** Fiscal year date range filter */
  fiscalYearFilter(dateColumn: string, fyYear: number): string;

  /** Parameter placeholder ($1 for Postgres, :1 for Oracle) */
  paramPlaceholder(index: number): string;
}

// ---------------------------------------------------------------------------
// PostgreSQL Dialect Helpers
// ---------------------------------------------------------------------------

export class PostgresDialectHelpers implements DialectHelpers {
  limitClause(n: number): string {
    return `LIMIT ${n}`;
  }

  currentTimestamp(): string {
    return 'CURRENT_TIMESTAMP';
  }

  dateTrunc(part: 'year' | 'month' | 'quarter', column: string): string {
    return `DATE_TRUNC('${part}', ${column})`;
  }

  dateDiffDays(from: string, to: string): string {
    return `(${to}::date - ${from}::date)`;
  }

  coalesce(column: string, defaultValue: string): string {
    return `COALESCE(${column}, ${defaultValue})`;
  }

  concat(...parts: string[]): string {
    return parts.join(' || ');
  }

  booleanTrue(): string {
    return 'TRUE';
  }

  booleanFalse(): string {
    return 'FALSE';
  }

  fiscalYear(dateColumn: string): string {
    // Indian FY: if month >= April, FY = year; else FY = year - 1
    return `CASE WHEN EXTRACT(MONTH FROM ${dateColumn}) >= 4 THEN EXTRACT(YEAR FROM ${dateColumn}) ELSE EXTRACT(YEAR FROM ${dateColumn}) - 1 END`;
  }

  fiscalYearFilter(dateColumn: string, fyYear: number): string {
    // FY 2023 = April 1, 2023 to March 31, 2024
    return `${dateColumn} >= '${fyYear}-04-01' AND ${dateColumn} < '${fyYear + 1}-04-01'`;
  }

  paramPlaceholder(index: number): string {
    return `$${index}`;
  }
}

// ---------------------------------------------------------------------------
// Oracle Dialect Helpers (for future use)
// ---------------------------------------------------------------------------

export class OracleDialectHelpers implements DialectHelpers {
  limitClause(n: number): string {
    return `FETCH FIRST ${n} ROWS ONLY`;
  }

  currentTimestamp(): string {
    return 'SYSTIMESTAMP';
  }

  dateTrunc(part: 'year' | 'month' | 'quarter', column: string): string {
    const oraclePart = part === 'quarter' ? 'Q' : part.toUpperCase().substring(0, 2);
    return `TRUNC(${column}, '${oraclePart}')`;
  }

  dateDiffDays(from: string, to: string): string {
    return `(${to} - ${from})`;
  }

  coalesce(column: string, defaultValue: string): string {
    return `NVL(${column}, ${defaultValue})`;
  }

  concat(...parts: string[]): string {
    return parts.join(' || ');
  }

  booleanTrue(): string {
    return "'Y'";
  }

  booleanFalse(): string {
    return "'N'";
  }

  fiscalYear(dateColumn: string): string {
    return `CASE WHEN EXTRACT(MONTH FROM ${dateColumn}) >= 4 THEN EXTRACT(YEAR FROM ${dateColumn}) ELSE EXTRACT(YEAR FROM ${dateColumn}) - 1 END`;
  }

  fiscalYearFilter(dateColumn: string, fyYear: number): string {
    return `${dateColumn} >= TO_DATE('${fyYear}-04-01', 'YYYY-MM-DD') AND ${dateColumn} < TO_DATE('${fyYear + 1}-04-01', 'YYYY-MM-DD')`;
  }

  paramPlaceholder(index: number): string {
    return `:${index}`;
  }
}
