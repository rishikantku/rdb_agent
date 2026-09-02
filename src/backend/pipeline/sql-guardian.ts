// ============================================================================
// SQL Guardian — Validation Layer
// ============================================================================
// The LLM is NOT trusted. Every generated SQL statement must pass through
// the Guardian before execution. This is a critical security component.
//
// Checks: read-only enforcement, object existence, dangerous constructs,
// complexity scoring, result limit enforcement, injection detection.
// ============================================================================

import { SchemaIntelligence } from '../schema/schema-intelligence.js';
import { SQLDialect } from '../db/database-adapter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  complexity: ComplexityScore;
  modifiedSql?: string; // SQL with safety limits applied
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
}

export interface ComplexityScore {
  joinCount: number;
  subqueryDepth: number;
  cteCount: number;
  aggregationCount: number;
  windowFunctionCount: number;
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very_high';
}

export interface GuardianConfig {
  maxResultRows: number;
  maxJoins: number;
  maxSubqueryDepth: number;
  allowedSchemas?: string[];
  restrictedTables?: string[];
  dialect: SQLDialect;
}

// ---------------------------------------------------------------------------
// SQL Guardian
// ---------------------------------------------------------------------------

export class SQLGuardian {
  private schema: SchemaIntelligence;
  private config: GuardianConfig;

  constructor(schema: SchemaIntelligence, config: Partial<GuardianConfig> = {}) {
    this.schema = schema;
    this.config = {
      maxResultRows: config.maxResultRows ?? 1000,
      maxJoins: config.maxJoins ?? 10,
      maxSubqueryDepth: config.maxSubqueryDepth ?? 5,
      dialect: config.dialect ?? 'postgresql',
      allowedSchemas: config.allowedSchemas,
      restrictedTables: config.restrictedTables ?? [],
    };
  }

  /**
   * Validate a SQL statement. Returns validation result with errors,
   * warnings, and complexity score.
   */
  validate(sql: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Normalize SQL for analysis
    const sqlUpper = sql.toUpperCase().trim();
    const sqlNormalized = this.removeComments(sql).trim();

    // -----------------------------------------------------------------------
    // Critical checks
    // -----------------------------------------------------------------------

    // 1. Read-only enforcement — block all DML/DDL
    const destructiveCheck = this.checkDestructiveStatements(sqlUpper);
    if (destructiveCheck) {
      errors.push(destructiveCheck);
    }

    // 2. Check for dangerous constructs
    const dangerousChecks = this.checkDangerousConstructs(sqlUpper);
    errors.push(...dangerousChecks);

    // 3. Must start with SELECT or WITH (CTE)
    if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
      errors.push({
        code: 'NOT_SELECT',
        message: 'Only SELECT queries are permitted. The query must start with SELECT or WITH.',
        severity: 'critical',
      });
    }

    // -----------------------------------------------------------------------
    // Object existence checks
    // -----------------------------------------------------------------------

    const referencedTables = this.extractTableReferences(sqlNormalized);
    for (const tableName of referencedTables) {
      if (!this.schema.tableExists(tableName)) {
        errors.push({
          code: 'TABLE_NOT_FOUND',
          message: `Table "${tableName}" does not exist in the known schema.`,
          severity: 'error',
        });
      }

      // Check restricted tables
      if (this.config.restrictedTables?.includes(tableName.toUpperCase())) {
        errors.push({
          code: 'RESTRICTED_TABLE',
          message: `Access to table "${tableName}" is restricted.`,
          severity: 'critical',
        });
      }

      if (this.schema.isTableRestricted(tableName)) {
        errors.push({
          code: 'RESTRICTED_TABLE',
          message: `Table "${tableName}" requires additional authorization.`,
          severity: 'critical',
        });
      }
    }

    // -----------------------------------------------------------------------
    // Complexity analysis
    // -----------------------------------------------------------------------

    const complexity = this.analyzeComplexity(sqlUpper);

    if (complexity.joinCount > this.config.maxJoins) {
      warnings.push({
        code: 'HIGH_JOIN_COUNT',
        message: `Query has ${complexity.joinCount} joins (max recommended: ${this.config.maxJoins}).`,
      });
    }

    if (complexity.subqueryDepth > this.config.maxSubqueryDepth) {
      warnings.push({
        code: 'DEEP_SUBQUERY',
        message: `Query has subquery nesting depth of ${complexity.subqueryDepth} (max: ${this.config.maxSubqueryDepth}).`,
      });
    }

    // -----------------------------------------------------------------------
    // Cartesian join detection
    // -----------------------------------------------------------------------

    if (this.detectCartesianJoin(sqlUpper, referencedTables.length)) {
      warnings.push({
        code: 'POSSIBLE_CARTESIAN',
        message: 'Query may produce a Cartesian product. Verify that all tables have proper join conditions.',
      });
    }

    // -----------------------------------------------------------------------
    // Apply result limit if not present
    // -----------------------------------------------------------------------

    let modifiedSql = sql;
    if (!this.hasResultLimit(sqlUpper)) {
      modifiedSql = this.applyResultLimit(sql);
      warnings.push({
        code: 'LIMIT_APPLIED',
        message: `Result limit of ${this.config.maxResultRows} rows applied for safety.`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      complexity,
      modifiedSql: errors.length === 0 ? modifiedSql : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Internal validation methods
  // -------------------------------------------------------------------------

  private checkDestructiveStatements(sqlUpper: string): ValidationError | null {
    const destructivePatterns: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /\bINSERT\s+INTO\b/, name: 'INSERT' },
      { pattern: /\bUPDATE\s+\w/, name: 'UPDATE' },
      { pattern: /\bDELETE\s+FROM\b/, name: 'DELETE' },
      { pattern: /\bDROP\s+(TABLE|VIEW|INDEX|SCHEMA|DATABASE|SEQUENCE|FUNCTION|PROCEDURE|TRIGGER)\b/, name: 'DROP' },
      { pattern: /\bALTER\s+(TABLE|VIEW|INDEX|SCHEMA|DATABASE|SEQUENCE)\b/, name: 'ALTER' },
      { pattern: /\bTRUNCATE\s/, name: 'TRUNCATE' },
      { pattern: /\bCREATE\s+(TABLE|VIEW|INDEX|SCHEMA|DATABASE|SEQUENCE|FUNCTION|PROCEDURE|TRIGGER)\b/, name: 'CREATE' },
      { pattern: /\bGRANT\s/, name: 'GRANT' },
      { pattern: /\bREVOKE\s/, name: 'REVOKE' },
      { pattern: /\bMERGE\s+INTO\b/, name: 'MERGE' },
      { pattern: /\bEXEC(UTE)?\s/, name: 'EXECUTE' },
      { pattern: /\bCALL\s/, name: 'CALL' },
    ];

    for (const { pattern, name } of destructivePatterns) {
      if (pattern.test(sqlUpper)) {
        return {
          code: 'DESTRUCTIVE_OPERATION',
          message: `${name} operations are not permitted. Only SELECT queries are allowed.`,
          severity: 'critical',
        };
      }
    }

    return null;
  }

  private checkDangerousConstructs(sqlUpper: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // SQL injection patterns
    const injectionPatterns: Array<{ pattern: RegExp; description: string }> = [
      { pattern: /;\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)/, description: 'Multiple statements with destructive operations' },
      { pattern: /--\s*$/, description: 'SQL comment at end of query (potential injection)' },
      { pattern: /\/\*[\s\S]*\*\/\s*(INSERT|UPDATE|DELETE|DROP)/, description: 'Block comment followed by destructive operation' },
      { pattern: /\bXP_CMDSHELL\b/, description: 'System command execution attempt' },
      { pattern: /\bDBMS_/, description: 'Oracle DBMS package call' },
      { pattern: /\bUTL_/, description: 'Oracle UTL package call' },
      { pattern: /\bPG_SLEEP\b/, description: 'PostgreSQL sleep function (timing attack)' },
      { pattern: /\bBENCHMARK\s*\(/, description: 'MySQL benchmark function (timing attack)' },
      { pattern: /\bLOAD_FILE\b/, description: 'File access attempt' },
      { pattern: /\bINTO\s+OUTFILE\b/, description: 'File write attempt' },
      { pattern: /\bINTO\s+DUMPFILE\b/, description: 'File dump attempt' },
    ];

    for (const { pattern, description } of injectionPatterns) {
      if (pattern.test(sqlUpper)) {
        errors.push({
          code: 'DANGEROUS_CONSTRUCT',
          message: `Dangerous SQL construct detected: ${description}`,
          severity: 'critical',
        });
      }
    }

    // Multiple statements (semicolons not at the end)
    const trimmed = sqlUpper.replace(/;\s*$/, '');
    if (trimmed.includes(';')) {
      errors.push({
        code: 'MULTIPLE_STATEMENTS',
        message: 'Multiple SQL statements are not permitted.',
        severity: 'critical',
      });
    }

    return errors;
  }

  private analyzeComplexity(sqlUpper: string): ComplexityScore {
    // Count JOINs
    const joinMatches = sqlUpper.match(/\bJOIN\b/g);
    const joinCount = joinMatches ? joinMatches.length : 0;

    // Count CTEs
    const cteMatches = sqlUpper.match(/\bWITH\b/g);
    const cteCount = cteMatches ? cteMatches.length : 0;

    // Count subqueries (nested SELECT)
    const subqueryDepth = this.measureSubqueryDepth(sqlUpper);

    // Count aggregations
    const aggFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT', 'STRING_AGG', 'ARRAY_AGG'];
    let aggregationCount = 0;
    for (const fn of aggFunctions) {
      const regex = new RegExp(`\\b${fn}\\s*\\(`, 'g');
      const matches = sqlUpper.match(regex);
      aggregationCount += matches ? matches.length : 0;
    }

    // Count window functions
    const windowMatches = sqlUpper.match(/\bOVER\s*\(/g);
    const windowFunctionCount = windowMatches ? windowMatches.length : 0;

    // Estimate overall complexity
    let estimatedComplexity: ComplexityScore['estimatedComplexity'];
    const score = joinCount * 2 + subqueryDepth * 3 + cteCount * 2 + aggregationCount + windowFunctionCount * 2;

    if (score <= 3) estimatedComplexity = 'low';
    else if (score <= 8) estimatedComplexity = 'medium';
    else if (score <= 15) estimatedComplexity = 'high';
    else estimatedComplexity = 'very_high';

    return {
      joinCount,
      subqueryDepth,
      cteCount,
      aggregationCount,
      windowFunctionCount,
      estimatedComplexity,
    };
  }

  private measureSubqueryDepth(sql: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      // Track string literals to avoid counting parens inside strings
      if ((char === "'" || char === '"') && !inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && inString) {
        inString = false;
      }

      if (!inString) {
        if (char === '(') {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === ')') {
          currentDepth = Math.max(0, currentDepth - 1);
        }
      }
    }

    return maxDepth;
  }

  /**
   * Functions where FROM is part of the call syntax rather than a table
   * reference, e.g. EXTRACT(YEAR FROM col) or TRIM(BOTH ' ' FROM col).
   */
  private static readonly FROM_ARG_FUNCTIONS = [
    'EXTRACT', 'SUBSTRING', 'TRIM', 'POSITION', 'OVERLAY',
  ];

  /**
   * Blank out the interior of FROM_ARG_FUNCTIONS calls so their internal
   * FROM keyword is not mistaken for a table reference. Paren-balanced, so
   * nested calls are handled correctly.
   */
  private maskFromArgFunctions(sql: string): string {
    let out = sql;

    for (const fn of SQLGuardian.FROM_ARG_FUNCTIONS) {
      const re = new RegExp(`\\b${fn}\\s*\\(`, 'gi');
      let match;
      while ((match = re.exec(out)) !== null) {
        const open = match.index + match[0].length - 1;
        let depth = 0;
        let i = open;
        for (; i < out.length; i++) {
          if (out[i] === '(') depth++;
          else if (out[i] === ')') {
            depth--;
            if (depth === 0) break;
          }
        }
        const close = Math.min(i, out.length);
        out = out.slice(0, open + 1) + ' '.repeat(close - open - 1) + out.slice(close);
        re.lastIndex = close;
      }
    }

    return out;
  }

  /**
   * Collect names defined by WITH ... AS (...) so CTE references are not
   * validated against the physical schema.
   */
  private extractCteNames(sql: string): Set<string> {
    const names = new Set<string>();
    const re = /(?:\bWITH\b|,)\s*(?:RECURSIVE\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*(?:(?:NOT\s+)?MATERIALIZED\s*)?\(/gi;

    let match;
    while ((match = re.exec(sql)) !== null) {
      names.add(match[1].toLowerCase());
    }

    return names;
  }

  private extractTableReferences(sql: string): string[] {
    const tables = new Set<string>();

    // EXTRACT(... FROM x) and friends would otherwise yield phantom tables
    const masked = this.maskFromArgFunctions(sql);

    // CTE names are query-local, not physical tables
    const cteNames = this.extractCteNames(masked);

    // Match FROM and JOIN clauses, allowing an optional schema qualifier
    const patterns = [
      /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi,
      /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(masked)) !== null) {
        // With a schema qualifier the table is the second group
        const tableName = match[2] || match[1];

        // Filter out SQL keywords that might be matched
        const keywords = new Set([
          'SELECT', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
          'UNION', 'INTERSECT', 'EXCEPT', 'LATERAL', 'UNNEST', 'DUAL',
        ]);
        if (keywords.has(tableName.toUpperCase())) continue;
        if (cteNames.has(tableName.toLowerCase())) continue;

        tables.add(tableName);
      }
    }

    return Array.from(tables);
  }

  private detectCartesianJoin(sqlUpper: string, tableCount: number): boolean {
    // If there are multiple tables but no JOIN keyword and no WHERE clause
    // with join conditions, it might be a Cartesian join
    if (tableCount > 1) {
      const hasJoin = /\bJOIN\b/.test(sqlUpper);
      const hasWhere = /\bWHERE\b/.test(sqlUpper);
      const hasCommaJoin = /\bFROM\s+\w+\s*,\s*\w+/.test(sqlUpper);

      if (hasCommaJoin && !hasWhere) {
        return true;
      }
    }
    return false;
  }

  private hasResultLimit(sqlUpper: string): boolean {
    return (
      /\bLIMIT\s+\d+/i.test(sqlUpper) ||
      /\bFETCH\s+(FIRST|NEXT)\s+\d+\s+ROW/i.test(sqlUpper) ||
      /\bROWNUM\s*<=/i.test(sqlUpper) ||
      /\bTOP\s+\d+/i.test(sqlUpper)
    );
  }

  private applyResultLimit(sql: string): string {
    const trimmed = sql.replace(/;\s*$/, '').trim();

    if (this.config.dialect === 'postgresql' || this.config.dialect === 'sqlite') {
      return `${trimmed}\nLIMIT ${this.config.maxResultRows}`;
    } else if (this.config.dialect === 'oracle') {
      return `${trimmed}\nFETCH FIRST ${this.config.maxResultRows} ROWS ONLY`;
    }

    return `${trimmed}\nLIMIT ${this.config.maxResultRows}`;
  }

  private removeComments(sql: string): string {
    // Remove single-line comments
    let result = sql.replace(/--.*$/gm, '');
    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
  }
}
