// ============================================================================
// Business Semantic Layer
// ============================================================================
// Maps banking business terminology to physical database concepts.
// This is one of the most critical components: it ensures the system
// uses defined business rules rather than letting the LLM guess.
//
// Example: "active employee" → EMPLOYEES.STATUS = 'ACTIVE'
//          "financial year 2023-24" → April 1 2023 to March 31 2024
//          "contractual employee" → EMPLOYEES.EMPLOYMENT_TYPE = 'CONTRACT'
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessTerm {
  term: string;
  aliases: string[];
  description: string;
  mapping: BusinessTermMapping;
}

export type BusinessTermMapping =
  | TableMapping
  | ColumnMapping
  | FilterMapping
  | CalculatedMapping
  | ConceptMapping;

export interface TableMapping {
  type: 'table';
  table: string;
}

export interface ColumnMapping {
  type: 'column';
  table: string;
  column: string;
}

export interface FilterMapping {
  type: 'filter';
  table: string;
  condition: string; // SQL condition fragment, e.g., "STATUS = 'ACTIVE'"
}

export interface CalculatedMapping {
  type: 'calculated';
  expression: string; // SQL expression
  description: string;
}

export interface ConceptMapping {
  type: 'concept';
  definition: string; // Natural language definition for the LLM
  relatedTables: string[];
  relatedColumns: string[];
  rules: string[]; // Business rules the LLM must follow
}

export interface AmbiguousTerm {
  term: string;
  possibleMeanings: Array<{
    label: string;
    description: string;
    mapping: BusinessTermMapping;
  }>;
}

export interface SemanticResolution {
  resolvedTerms: Array<{
    originalTerm: string;
    businessTerm: BusinessTerm;
  }>;
  ambiguousTerms: AmbiguousTerm[];
  additionalTables: string[];
  businessRules: string[];
}

// ---------------------------------------------------------------------------
// Semantic Layer
// ---------------------------------------------------------------------------

export class SemanticLayer {
  private terms: Map<string, BusinessTerm> = new Map();
  private ambiguousTerms: Map<string, AmbiguousTerm> = new Map();
  private globalRules: string[] = [];

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  registerTerm(term: BusinessTerm): void {
    const key = term.term.toLowerCase();
    this.terms.set(key, term);
    // Also register aliases
    for (const alias of term.aliases) {
      this.terms.set(alias.toLowerCase(), term);
    }
  }

  registerAmbiguousTerm(term: AmbiguousTerm): void {
    this.ambiguousTerms.set(term.term.toLowerCase(), term);
  }

  registerGlobalRule(rule: string): void {
    this.globalRules.push(rule);
  }

  // -------------------------------------------------------------------------
  // Resolution
  // -------------------------------------------------------------------------

  /**
   * Given a list of detected terms from the user query, resolve them
   * against the business glossary. Returns resolved terms, any ambiguities
   * that need user clarification, and derived business rules.
   */
  resolveTerms(detectedTerms: string[]): SemanticResolution {
    const resolved: SemanticResolution['resolvedTerms'] = [];
    const ambiguous: AmbiguousTerm[] = [];
    const additionalTables = new Set<string>();
    const businessRules = new Set<string>(this.globalRules);

    for (const term of detectedTerms) {
      const key = term.toLowerCase();

      // Check for ambiguous terms first
      const ambiguousTerm = this.ambiguousTerms.get(key);
      if (ambiguousTerm) {
        ambiguous.push(ambiguousTerm);
        continue;
      }

      // Check for exact or alias match
      const businessTerm = this.terms.get(key);
      if (businessTerm) {
        resolved.push({ originalTerm: term, businessTerm });

        // Collect additional tables from mappings
        switch (businessTerm.mapping.type) {
          case 'table':
            additionalTables.add(businessTerm.mapping.table);
            break;
          case 'column':
          case 'filter':
            additionalTables.add(businessTerm.mapping.table);
            break;
          case 'concept':
            for (const t of businessTerm.mapping.relatedTables) {
              additionalTables.add(t);
            }
            for (const rule of businessTerm.mapping.rules) {
              businessRules.add(rule);
            }
            break;
        }
      }
    }

    return {
      resolvedTerms: resolved,
      ambiguousTerms: ambiguous,
      additionalTables: Array.from(additionalTables),
      businessRules: Array.from(businessRules),
    };
  }

  /**
   * Extract potential business terms from a natural language query
   * using keyword matching against the glossary.
   */
  extractTerms(query: string): string[] {
    const queryLower = query.toLowerCase();
    const found: Array<{ term: string; index: number }> = [];

    // Check all registered terms (including aliases) and ambiguous terms
    const allTerms = new Set<string>();
    for (const [key] of this.terms) allTerms.add(key);
    for (const [key] of this.ambiguousTerms) allTerms.add(key);

    for (const term of allTerms) {
      const index = queryLower.indexOf(term);
      if (index !== -1) {
        // Ensure it's a word boundary match (not a substring of another word)
        const before = index > 0 ? queryLower[index - 1] : ' ';
        const after =
          index + term.length < queryLower.length
            ? queryLower[index + term.length]
            : ' ';
        if (/[\s,.]/.test(before) || index === 0) {
          if (/[\s,.]/.test(after) || index + term.length === queryLower.length) {
            found.push({ term, index });
          }
        }
      }
    }

    // Sort by position and deduplicate
    found.sort((a, b) => a.index - b.index);
    return [...new Set(found.map((f) => f.term))];
  }

  // -------------------------------------------------------------------------
  // Prompt Generation
  // -------------------------------------------------------------------------

  /**
   * Generate business context for the LLM prompt based on resolved terms.
   */
  serializeForPrompt(resolution: SemanticResolution): string {
    const parts: string[] = [];

    parts.push('=== BUSINESS DEFINITIONS ===\n');

    if (resolution.resolvedTerms.length > 0) {
      parts.push('Resolved Business Terms:');
      for (const { originalTerm, businessTerm } of resolution.resolvedTerms) {
        parts.push(`  "${originalTerm}":`);
        parts.push(`    Definition: ${businessTerm.description}`);

        switch (businessTerm.mapping.type) {
          case 'table':
            parts.push(`    Maps to table: ${businessTerm.mapping.table}`);
            break;
          case 'column':
            parts.push(
              `    Maps to: ${businessTerm.mapping.table}.${businessTerm.mapping.column}`
            );
            break;
          case 'filter':
            parts.push(
              `    Filter: ${businessTerm.mapping.table} WHERE ${businessTerm.mapping.condition}`
            );
            break;
          case 'calculated':
            parts.push(
              `    Expression: ${businessTerm.mapping.expression}`
            );
            break;
          case 'concept':
            parts.push(`    Concept: ${businessTerm.mapping.definition}`);
            if (businessTerm.mapping.rules.length > 0) {
              parts.push('    Rules:');
              for (const rule of businessTerm.mapping.rules) {
                parts.push(`      - ${rule}`);
              }
            }
            break;
        }
      }
      parts.push('');
    }

    if (resolution.businessRules.length > 0) {
      parts.push('Business Rules (MUST follow):');
      for (const rule of resolution.businessRules) {
        parts.push(`  - ${rule}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  getAllTerms(): BusinessTerm[] {
    // Deduplicate (aliases point to same term)
    const seen = new Set<string>();
    const result: BusinessTerm[] = [];
    for (const term of this.terms.values()) {
      if (!seen.has(term.term)) {
        seen.add(term.term);
        result.push(term);
      }
    }
    return result;
  }

  getTermCount(): number {
    return this.getAllTerms().length;
  }
}
