// ============================================================================
// Schema Intelligence Layer
// ============================================================================
// Maintains rich metadata about the database schema — tables, columns, types,
// relationships, descriptions, and access controls. This is the foundation
// for intelligent schema retrieval: only relevant schema context is sent to
// the LLM, not the entire database structure.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnMetadata {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyRef?: { table: string; column: string };
  description?: string;
  businessName?: string;
  sensitive?: boolean;   // PII, salary, etc. — flagged for audit
  sampleValues?: string[];
}

export interface TableMetadata {
  name: string;
  type: 'table' | 'view';
  schema?: string;
  description?: string;
  businessName?: string;
  columns: ColumnMetadata[];
  primaryKey?: string[];
  indexes?: string[];
  rowCountEstimate?: number;
  restricted?: boolean;  // If true, requires explicit authorization
  tags?: string[];       // e.g., ['employee', 'hr', 'payroll']
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  description?: string;
}

export interface JoinPattern {
  name: string;
  description: string;
  tables: string[];
  joinClause: string;
  useCases: string[];
}

export interface SchemaContext {
  tables: TableMetadata[];
  relationships: Relationship[];
  joinPatterns: JoinPattern[];
}

// ---------------------------------------------------------------------------
// Schema Intelligence Store
// ---------------------------------------------------------------------------

export class SchemaIntelligence {
  private tables: Map<string, TableMetadata> = new Map();
  private relationships: Relationship[] = [];
  private joinPatterns: JoinPattern[] = [];
  private relationshipGraph: Map<string, Set<string>> = new Map();

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  registerTable(table: TableMetadata): void {
    this.tables.set(table.name.toUpperCase(), table);
    // Ensure the table is in the relationship graph
    if (!this.relationshipGraph.has(table.name.toUpperCase())) {
      this.relationshipGraph.set(table.name.toUpperCase(), new Set());
    }
  }

  registerRelationship(rel: Relationship): void {
    this.relationships.push(rel);
    const fromKey = rel.fromTable.toUpperCase();
    const toKey = rel.toTable.toUpperCase();

    if (!this.relationshipGraph.has(fromKey)) {
      this.relationshipGraph.set(fromKey, new Set());
    }
    if (!this.relationshipGraph.has(toKey)) {
      this.relationshipGraph.set(toKey, new Set());
    }
    this.relationshipGraph.get(fromKey)!.add(toKey);
    this.relationshipGraph.get(toKey)!.add(fromKey);
  }

  registerJoinPattern(pattern: JoinPattern): void {
    this.joinPatterns.push(pattern);
  }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  getTable(name: string): TableMetadata | undefined {
    return this.tables.get(name.toUpperCase());
  }

  getAllTables(): TableMetadata[] {
    return Array.from(this.tables.values());
  }

  getColumn(tableName: string, columnName: string): ColumnMetadata | undefined {
    const table = this.getTable(tableName);
    if (!table) return undefined;
    return table.columns.find(
      (c) => c.name.toUpperCase() === columnName.toUpperCase()
    );
  }

  getRelationshipsForTable(tableName: string): Relationship[] {
    const key = tableName.toUpperCase();
    return this.relationships.filter(
      (r) =>
        r.fromTable.toUpperCase() === key || r.toTable.toUpperCase() === key
    );
  }

  getRelatedTables(tableName: string): string[] {
    const key = tableName.toUpperCase();
    return Array.from(this.relationshipGraph.get(key) ?? []);
  }

  getAllRelationships(): Relationship[] {
    return [...this.relationships];
  }

  getJoinPatterns(): JoinPattern[] {
    return [...this.joinPatterns];
  }

  // -------------------------------------------------------------------------
  // Relevance Scoring & Retrieval
  // -------------------------------------------------------------------------

  /**
   * Given a set of keywords extracted from a user query, score and return
   * the most relevant tables. Uses keyword matching against table names,
   * column names, descriptions, business names, and tags.
   */
  findRelevantTables(keywords: string[], maxTables = 10): TableMetadata[] {
    const scores = new Map<string, number>();

    for (const [tableKey, table] of this.tables) {
      let score = 0;
      const tableNameLower = table.name.toLowerCase();
      const tableBusinessLower = (table.businessName ?? '').toLowerCase();
      const tableDescLower = (table.description ?? '').toLowerCase();
      const tableTags = (table.tags ?? []).map((t) => t.toLowerCase());

      for (const keyword of keywords) {
        const kw = keyword.toLowerCase();

        // Table name match
        if (tableNameLower.includes(kw)) score += 10;
        if (tableNameLower === kw) score += 20;

        // Business name match
        if (tableBusinessLower.includes(kw)) score += 15;

        // Description match
        if (tableDescLower.includes(kw)) score += 5;

        // Tag match
        if (tableTags.some((tag) => tag.includes(kw))) score += 12;

        // Column-level match
        for (const col of table.columns) {
          const colNameLower = col.name.toLowerCase();
          const colBusinessLower = (col.businessName ?? '').toLowerCase();
          const colDescLower = (col.description ?? '').toLowerCase();

          if (colNameLower.includes(kw)) score += 5;
          if (colNameLower === kw) score += 10;
          if (colBusinessLower.includes(kw)) score += 8;
          if (colDescLower.includes(kw)) score += 3;
        }
      }

      if (score > 0) {
        scores.set(tableKey, score);
      }
    }

    // Sort by score descending and return top N
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTables);

    return sorted.map(([key]) => this.tables.get(key)!);
  }

  /**
   * Given a set of directly relevant tables, traverse the relationship graph
   * to include related tables that may be needed for joins.
   * Uses BFS with configurable depth.
   */
  expandWithRelatedTables(
    tableNames: string[],
    maxDepth = 1
  ): TableMetadata[] {
    const visited = new Set<string>();
    const queue: Array<{ table: string; depth: number }> = [];

    for (const name of tableNames) {
      const key = name.toUpperCase();
      visited.add(key);
      queue.push({ table: key, depth: 0 });
    }

    while (queue.length > 0) {
      const { table, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const neighbors = this.relationshipGraph.get(table) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ table: neighbor, depth: depth + 1 });
        }
      }
    }

    return Array.from(visited)
      .map((key) => this.tables.get(key))
      .filter((t): t is TableMetadata => t !== undefined);
  }

  /**
   * Get the relationships that connect a specific set of tables.
   */
  getRelationshipsBetween(tableNames: string[]): Relationship[] {
    const keys = new Set(tableNames.map((n) => n.toUpperCase()));
    return this.relationships.filter(
      (r) =>
        keys.has(r.fromTable.toUpperCase()) &&
        keys.has(r.toTable.toUpperCase())
    );
  }

  /**
   * Get join patterns relevant to a set of tables.
   */
  getRelevantJoinPatterns(tableNames: string[]): JoinPattern[] {
    const keys = new Set(tableNames.map((n) => n.toUpperCase()));
    return this.joinPatterns.filter((p) =>
      p.tables.some((t) => keys.has(t.toUpperCase()))
    );
  }

  // -------------------------------------------------------------------------
  // Schema Context Builder (for LLM prompts)
  // -------------------------------------------------------------------------

  /**
   * Build a focused schema context for the LLM, containing only the
   * relevant tables, their relationships, and applicable join patterns.
   */
  buildSchemaContext(tableNames: string[]): SchemaContext {
    const tables = tableNames
      .map((n) => this.getTable(n))
      .filter((t): t is TableMetadata => t !== undefined);

    const relationships = this.getRelationshipsBetween(tableNames);
    const joinPatterns = this.getRelevantJoinPatterns(tableNames);

    return { tables, relationships, joinPatterns };
  }

  /**
   * Serialize schema context to a concise text format suitable for LLM prompts.
   * This is much more efficient than dumping raw JSON.
   */
  serializeForPrompt(context: SchemaContext): string {
    const parts: string[] = [];

    parts.push('=== DATABASE SCHEMA ===\n');

    for (const table of context.tables) {
      const tableType = table.type === 'view' ? 'VIEW' : 'TABLE';
      parts.push(`${tableType}: ${table.name}`);
      if (table.description) parts.push(`  Description: ${table.description}`);
      if (table.businessName) parts.push(`  Business Name: ${table.businessName}`);

      parts.push('  Columns:');
      for (const col of table.columns) {
        let colLine = `    - ${col.name} (${col.dataType})`;
        if (col.isPrimaryKey) colLine += ' [PK]';
        if (col.isForeignKey && col.foreignKeyRef) {
          colLine += ` [FK → ${col.foreignKeyRef.table}.${col.foreignKeyRef.column}]`;
        }
        if (col.nullable === false) colLine += ' NOT NULL';
        if (col.description) colLine += ` -- ${col.description}`;
        if (col.businessName) colLine += ` (Business: ${col.businessName})`;
        parts.push(colLine);
      }
      parts.push('');
    }

    if (context.relationships.length > 0) {
      parts.push('=== RELATIONSHIPS ===');
      for (const rel of context.relationships) {
        parts.push(
          `  ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn} (${rel.type})`
        );
        if (rel.description) parts.push(`    ${rel.description}`);
      }
      parts.push('');
    }

    if (context.joinPatterns.length > 0) {
      parts.push('=== COMMON JOIN PATTERNS ===');
      for (const pattern of context.joinPatterns) {
        parts.push(`  ${pattern.name}: ${pattern.description}`);
        parts.push(`    SQL: ${pattern.joinClause}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  // -------------------------------------------------------------------------
  // Validation helpers (used by SQL Guardian)
  // -------------------------------------------------------------------------

  tableExists(name: string): boolean {
    return this.tables.has(name.toUpperCase());
  }

  columnExists(tableName: string, columnName: string): boolean {
    return this.getColumn(tableName, columnName) !== undefined;
  }

  isTableRestricted(name: string): boolean {
    return this.getTable(name)?.restricted === true;
  }

  isSensitiveColumn(tableName: string, columnName: string): boolean {
    return this.getColumn(tableName, columnName)?.sensitive === true;
  }
}
