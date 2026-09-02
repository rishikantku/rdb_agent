// ============================================================================
// Schema Retriever
// ============================================================================
// Orchestrates schema intelligence + semantic layer to produce the focused
// schema context sent to the LLM for each user query.
//
// Pipeline:
//   User Query → Extract business terms → Resolve semantics →
//   Find relevant tables (keyword) → Expand via relationships →
//   Build schema context → Serialize for prompt
// ============================================================================

import { SchemaIntelligence, SchemaContext } from './schema-intelligence.js';
import { SemanticLayer, SemanticResolution } from './semantic-layer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalResult {
  schemaContext: SchemaContext;
  semanticResolution: SemanticResolution;
  schemaPrompt: string;
  semanticPrompt: string;
  retrievedTableNames: string[];
  hasAmbiguity: boolean;
}

// ---------------------------------------------------------------------------
// Schema Retriever
// ---------------------------------------------------------------------------

export class SchemaRetriever {
  constructor(
    private schemaIntelligence: SchemaIntelligence,
    private semanticLayer: SemanticLayer
  ) {}

  /**
   * Given a user query, retrieve the relevant schema context and
   * business definitions for the LLM prompt.
   */
  retrieve(userQuery: string): RetrievalResult {
    // Step 1: Extract business terms from the query
    const detectedTerms = this.semanticLayer.extractTerms(userQuery);

    // Step 2: Resolve business terms against the glossary
    const semanticResolution = this.semanticLayer.resolveTerms(detectedTerms);

    // Step 3: Build keyword list for schema search
    // Combine: raw query words + detected business terms + additional tables from semantics
    const keywords = this.extractKeywords(userQuery);

    // Step 4: Find directly relevant tables via keyword matching
    const relevantTables = this.schemaIntelligence.findRelevantTables(keywords, 8);
    const relevantTableNames = new Set(relevantTables.map((t) => t.name));

    // Add tables from semantic resolution
    for (const tableName of semanticResolution.additionalTables) {
      relevantTableNames.add(tableName);
    }

    // Step 5: Expand with related tables (1-hop via FK relationships)
    const expandedTables = this.schemaIntelligence.expandWithRelatedTables(
      Array.from(relevantTableNames),
      1
    );
    const finalTableNames = expandedTables.map((t) => t.name);

    // Step 6: Build focused schema context
    const schemaContext = this.schemaIntelligence.buildSchemaContext(finalTableNames);

    // Step 7: Serialize for prompt
    const schemaPrompt = this.schemaIntelligence.serializeForPrompt(schemaContext);
    const semanticPrompt = this.semanticLayer.serializeForPrompt(semanticResolution);

    return {
      schemaContext,
      semanticResolution,
      schemaPrompt,
      semanticPrompt,
      retrievedTableNames: finalTableNames,
      hasAmbiguity: semanticResolution.ambiguousTerms.length > 0,
    };
  }

  /**
   * Extract meaningful keywords from a natural language query.
   * Removes stop words and short tokens.
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'show', 'me', 'the', 'a', 'an', 'in', 'of', 'for', 'and', 'or', 'by',
      'with', 'from', 'to', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'get', 'got', 'give', 'gave', 'find', 'list', 'display',
      'what', 'which', 'who', 'whom', 'how', 'where', 'when', 'why',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'any', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'also', 'but', 'if', 'then', 'else',
      'their', 'them', 'they', 'this', 'that', 'these', 'those',
      'i', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'its',
      'between', 'after', 'before', 'above', 'below', 'up', 'down',
      'out', 'off', 'over', 'under', 'again', 'further',
      'tell', 'please', 'want', 'like', 'know', 'think', 'see',
      'result', 'results', 'data', 'information', 'details',
      'compare', 'comparison', 'excluding', 'including',
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}
