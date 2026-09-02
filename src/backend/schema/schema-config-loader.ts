// ============================================================================
// Schema + Semantic Config Loader
// ============================================================================
// Reads the JSON metadata files from database/ and registers everything into
// SchemaIntelligence + SemanticLayer. This replaces the old hardcoded
// banking-schema-config.ts with a data-driven approach.
//
// At startup:
//   1. Load schema_catalog.json → register all tables/views
//   2. Load semantic/relationships.json → register FK relationships
//   3. Load semantic/business_glossary.json → register business terms
//   4. Load semantic/business_rules.json → register global rules
//   5. Load semantic/entities.json → register join patterns
//   6. Load semantic/metrics.json → register calculated metrics
// ============================================================================

import fs from 'fs';
import path from 'path';
import {
  SchemaIntelligence,
} from './schema-intelligence.js';
import type {
  TableMetadata,
  ColumnMetadata,
  Relationship,
  JoinPattern,
} from './schema-intelligence.js';
import {
  SemanticLayer,
} from './semantic-layer.js';
import type {
  BusinessTerm,
} from './semantic-layer.js';

// ---------------------------------------------------------------------------
// Types for JSON file structures
// ---------------------------------------------------------------------------

interface SchemaCatalogColumn {
  type: string;
  pk?: boolean;
  unique?: boolean;
  nullable?: boolean;
  fk?: string;          // e.g., "states.state_id"
  check?: string;
  default?: any;
  note?: string;
  range?: string;
}

interface SchemaCatalogTable {
  description?: string;
  columns: Record<string, SchemaCatalogColumn>;
  unique_constraints?: string[];
}

interface SchemaCatalog {
  database: string;
  dialect: string;
  schema: string;
  tables: Record<string, SchemaCatalogTable>;
  views?: string[];
  join_paths?: Record<string, string>;
}

interface RelationshipEntry {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  type: string;
  description?: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
  sql_condition?: string;
  sql_expression?: string;
  related_tables?: string[];
  examples?: Record<string, string>;
}

interface BusinessRule {
  id: string;
  name: string;
  description: string;
  sql_pattern?: string;
}

interface EntityEntry {
  primary_table: string;
  key_column: string;
  display_columns?: string[];
  related_tables?: string[];
  join_paths?: Record<string, string>;
}

interface MetricEntry {
  name: string;
  expression: string;
  filter?: string;
  entity: string;
  aggregation: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export class SchemaConfigLoader {
  private basePath: string;

  constructor(databaseDir: string) {
    this.basePath = databaseDir;
  }

  /**
   * Load all config and register into the provided instances.
   */
  load(
    schemaIntelligence: SchemaIntelligence,
    semanticLayer: SemanticLayer
  ): { tableCount: number; viewCount: number; termCount: number; ruleCount: number; relationshipCount: number } {
    let tableCount = 0;
    let viewCount = 0;
    let termCount = 0;
    let ruleCount = 0;
    let relationshipCount = 0;

    // 1. Schema Catalog
    const catalogPath = path.join(this.basePath, 'schema_catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalog: SchemaCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

      // Register tables
      for (const [tableName, tableDef] of Object.entries(catalog.tables)) {
        const columns: ColumnMetadata[] = [];
        for (const [colName, colDef] of Object.entries(tableDef.columns)) {
          const fkRef = colDef.fk ? this.parseForeignKey(colDef.fk) : undefined;
          columns.push({
            name: colName,
            dataType: colDef.type,
            nullable: colDef.nullable !== false,
            isPrimaryKey: colDef.pk === true,
            isForeignKey: !!colDef.fk,
            foreignKeyRef: fkRef,
            description: colDef.note || colDef.check,
            sensitive: this.isSensitiveColumn(colName),
          });
        }

        const table: TableMetadata = {
          name: tableName,
          type: 'table',
          schema: catalog.schema || 'public',
          description: tableDef.description,
          columns,
          primaryKey: columns.filter(c => c.isPrimaryKey).map(c => c.name),
          tags: this.generateTags(tableName, tableDef.description),
        };

        schemaIntelligence.registerTable(table);
        tableCount++;
      }

      // Register views
      if (catalog.views) {
        for (const viewName of catalog.views) {
          schemaIntelligence.registerTable({
            name: viewName,
            type: 'view',
            schema: catalog.schema || 'public',
            description: `Analytical view: ${viewName}`,
            columns: [], // Views are pre-defined; columns resolved at query time
            tags: this.generateTags(viewName, ''),
          });
          viewCount++;
        }
      }

      // Register join path patterns from catalog
      if (catalog.join_paths) {
        for (const [name, pathStr] of Object.entries(catalog.join_paths)) {
          const tables = pathStr.split(' → ').map(t => t.trim());
          schemaIntelligence.registerJoinPattern({
            name,
            description: `Join path: ${pathStr}`,
            tables,
            joinClause: this.buildJoinClause(name, tables),
            useCases: [name.replace(/_/g, ' ')],
          });
        }
      }

      console.log(`[ConfigLoader] Loaded ${tableCount} tables, ${viewCount} views from schema catalog`);
    }

    // 2. Relationships
    const relPath = path.join(this.basePath, 'semantic', 'relationships.json');
    if (fs.existsSync(relPath)) {
      const data = JSON.parse(fs.readFileSync(relPath, 'utf-8'));
      const relationships: RelationshipEntry[] = data.relationships || data;

      for (const rel of relationships) {
        schemaIntelligence.registerRelationship({
          fromTable: rel.from_table,
          fromColumn: rel.from_column,
          toTable: rel.to_table,
          toColumn: rel.to_column,
          type: (rel.type as Relationship['type']) || 'many-to-one',
          description: rel.description,
        });
        relationshipCount++;
      }
      console.log(`[ConfigLoader] Loaded ${relationshipCount} relationships`);
    }

    // 3. Business Glossary
    const glossaryPath = path.join(this.basePath, 'semantic', 'business_glossary.json');
    if (fs.existsSync(glossaryPath)) {
      const data = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
      const glossary: Record<string, GlossaryEntry> = data.glossary || data;

      for (const [key, entry] of Object.entries(glossary)) {
        const term: BusinessTerm = this.glossaryEntryToBusinessTerm(key, entry);
        semanticLayer.registerTerm(term);
        termCount++;
      }
      console.log(`[ConfigLoader] Loaded ${termCount} business terms`);
    }

    // 4. Business Rules
    const rulesPath = path.join(this.basePath, 'semantic', 'business_rules.json');
    if (fs.existsSync(rulesPath)) {
      const data = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
      const rules: BusinessRule[] = data.rules || data;

      for (const rule of rules) {
        semanticLayer.registerGlobalRule(`[${rule.id}] ${rule.name}: ${rule.description}`);
        ruleCount++;
      }
      console.log(`[ConfigLoader] Loaded ${ruleCount} business rules`);
    }

    // 5. Entities (register join patterns)
    const entitiesPath = path.join(this.basePath, 'semantic', 'entities.json');
    if (fs.existsSync(entitiesPath)) {
      const data = JSON.parse(fs.readFileSync(entitiesPath, 'utf-8'));
      const entities: Record<string, EntityEntry> = data.entities || data;

      for (const [entityName, entity] of Object.entries(entities)) {
        if (entity.join_paths) {
          for (const [jpName, jpClause] of Object.entries(entity.join_paths)) {
            schemaIntelligence.registerJoinPattern({
              name: `${entityName}_${jpName}`,
              description: `Join ${entityName} to ${jpName}`,
              tables: [entity.primary_table, ...(entity.related_tables || [])],
              joinClause: jpClause,
              useCases: [`${entityName} ${jpName}`],
            });
          }
        }
      }
      console.log(`[ConfigLoader] Loaded entity join patterns`);
    }

    // 6. Metrics (register as calculated terms)
    const metricsPath = path.join(this.basePath, 'semantic', 'metrics.json');
    if (fs.existsSync(metricsPath)) {
      const data = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
      const metrics: Record<string, MetricEntry> = data.metrics || data;

      for (const [metricKey, metric] of Object.entries(metrics)) {
        const aliases = this.generateMetricAliases(metricKey, metric.name);
        semanticLayer.registerTerm({
          term: metric.name.toLowerCase(),
          aliases,
          description: `${metric.name}: ${metric.expression}${metric.filter ? ` WHERE ${metric.filter}` : ''}`,
          mapping: {
            type: 'calculated',
            expression: metric.expression,
            description: `${metric.name} (${metric.aggregation})`,
          },
        });
        termCount++;
      }
      console.log(`[ConfigLoader] Loaded ${Object.keys(metrics).length} metric definitions`);
    }

    return { tableCount, viewCount, termCount, ruleCount, relationshipCount };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private parseForeignKey(fkStr: string): { table: string; column: string } | undefined {
    const parts = fkStr.split('.');
    if (parts.length === 2) {
      return { table: parts[0], column: parts[1] };
    }
    return undefined;
  }

  private isSensitiveColumn(name: string): boolean {
    const sensitivePatterns = ['salary', 'income', 'balance', 'amount', 'phone', 'email', 'date_of_birth', 'dob', 'password', 'ssn', 'pan', 'aadhaar'];
    return sensitivePatterns.some(p => name.toLowerCase().includes(p));
  }

  private generateTags(name: string, description?: string): string[] {
    const tags: string[] = [];
    const lower = name.toLowerCase();

    if (lower.includes('employee') || lower.includes('dept') || lower.includes('department') || lower.includes('attendance') || lower.includes('performance')) {
      tags.push('employee', 'hr');
    }
    if (lower.includes('customer') || lower.includes('segment')) {
      tags.push('customer');
    }
    if (lower.includes('account') || lower.includes('balance') || lower.includes('holder')) {
      tags.push('account', 'deposit');
    }
    if (lower.includes('transaction') || lower.includes('txn')) {
      tags.push('transaction');
    }
    if (lower.includes('loan') || lower.includes('payment')) {
      tags.push('loan', 'lending');
    }
    if (lower.includes('branch') || lower.includes('zone') || lower.includes('region') || lower.includes('state')) {
      tags.push('geography', 'organization');
    }
    if (lower.includes('product')) {
      tags.push('product');
    }
    if (lower.includes('complaint') || lower.includes('interaction')) {
      tags.push('service', 'complaint');
    }
    if (lower.includes('salary') || lower.includes('payroll')) {
      tags.push('payroll');
    }

    return [...new Set(tags)];
  }

  private buildJoinClause(name: string, tables: string[]): string {
    // Generate a readable join clause from the path
    return tables.map((t, i) => {
      if (i === 0) return t;
      return `JOIN ${t} ON ...`;
    }).join(' ');
  }

  private glossaryEntryToBusinessTerm(key: string, entry: GlossaryEntry): BusinessTerm {
    // Generate aliases from the key
    const aliases = this.generateTermAliases(key, entry.term);

    // Determine mapping type based on available fields
    if (entry.sql_condition && entry.related_tables?.length === 1) {
      return {
        term: entry.term.toLowerCase(),
        aliases,
        description: entry.definition,
        mapping: {
          type: 'filter',
          table: entry.related_tables[0],
          condition: entry.sql_condition.replace(/^[a-z_]+\./, ''), // Remove table prefix
        },
      };
    }

    if (entry.sql_expression && !entry.related_tables) {
      return {
        term: entry.term.toLowerCase(),
        aliases,
        description: entry.definition,
        mapping: {
          type: 'calculated',
          expression: entry.sql_expression,
          description: entry.definition,
        },
      };
    }

    // Default: concept mapping
    return {
      term: entry.term.toLowerCase(),
      aliases,
      description: entry.definition,
      mapping: {
        type: 'concept',
        definition: entry.definition,
        relatedTables: entry.related_tables || [],
        relatedColumns: [],
        rules: entry.sql_condition ? [`Use condition: ${entry.sql_condition}`] : [],
      },
    };
  }

  private generateTermAliases(key: string, term: string): string[] {
    const aliases = new Set<string>();

    // key variations (underscore to space)
    aliases.add(key.replace(/_/g, ' '));

    // Short forms
    if (term.toLowerCase() !== key.replace(/_/g, ' ')) {
      aliases.add(term.toLowerCase());
    }

    // Common banking aliases
    const aliasMap: Record<string, string[]> = {
      'active_employee': ['active staff', 'current employees'],
      'contractual_employee': ['contract staff', 'contract employee', 'contractual staff'],
      'permanent_employee': ['regular employee', 'permanent staff'],
      'employee_strength': ['headcount', 'staff count', 'employee count', 'manpower'],
      'high_value_customer': ['hni customer', 'premium customer', 'high net worth'],
      'loan_portfolio': ['loan book', 'outstanding loans', 'advances'],
      'loan_growth': ['advance growth', 'lending growth'],
      'npa': ['non performing asset', 'bad loan', 'non-performing'],
      'npa_ratio': ['npa percentage', 'gross npa'],
      'financial_year': ['fiscal year', 'fy'],
      'attrition': ['employee turnover', 'staff leaving', 'resignation'],
      'salary_cost': ['salary expense', 'payroll cost', 'staff cost'],
      'average_salary': ['mean salary', 'avg salary'],
      'transaction_frequency': ['txn frequency', 'transaction count'],
      'employee_productivity': ['productivity', 'staff productivity'],
      'employee_performance': ['performance', 'staff performance'],
    };

    for (const a of aliasMap[key] || []) {
      aliases.add(a);
    }

    return Array.from(aliases);
  }

  private generateMetricAliases(key: string, name: string): string[] {
    const aliases = new Set<string>();
    aliases.add(key.replace(/_/g, ' '));
    aliases.add(name.toLowerCase());
    return Array.from(aliases);
  }
}
