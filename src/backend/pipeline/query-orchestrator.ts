// ============================================================================
// Query Orchestrator — Master Pipeline
// ============================================================================
// This is the central controller for the text-to-SQL pipeline. It orchestrates
// every stage from intent analysis through result presentation, with
// conversation context for follow-up queries.
//
// Pipeline:
//   User Query → Intent Analysis → Semantic Resolution → Schema Retrieval →
//   SQL Planning → SQL Generation → SQL Validation → SQL Execution →
//   [Error Recovery Loop] → Result Presentation
// ============================================================================

import {
  LLMProvider,
} from '../llm/llm-provider.js';
import type {
  LLMResponse,
} from '../llm/llm-provider.js';
import {
  SchemaRetriever,
} from '../schema/schema-retriever.js';
import type {
  RetrievalResult,
} from '../schema/schema-retriever.js';
import {
  SQLGuardian,
} from './sql-guardian.js';
import type {
  ValidationResult,
} from './sql-guardian.js';
import {
  DatabaseAdapter,
} from '../db/database-adapter.js';
import type {
  SQLDialect,
} from '../db/database-adapter.js';
import {
  AuditLogger,
} from '../audit/audit-logger.js';
import type {
  AuditEntry,
} from '../audit/audit-logger.js';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryRequest {
  question: string;
  userId?: string;
  sessionId?: string;
  /** If true, this is a follow-up to the previous query in the session */
  isFollowUp?: boolean;
}

export interface QueryResponse {
  requestId: string;
  success: boolean;
  // Result data
  data?: Record<string, any>[];
  rowCount?: number;
  fields?: Array<{ name: string; dataType: string }>;
  /** True when the row cap was hit — the result is a partial view of the answer */
  truncated?: boolean;
  /** When zero rows came back: which individual conditions do/don't match data */
  emptyResultDiagnosis?: EmptyResultProbe[];
  // Executive presentation
  summary?: string;
  filtersApplied?: string[];
  executionTimeMs?: number;
  // Generated SQL
  sql?: string;
  sqlPlan?: SQLPlan;
  // Validation info
  validationResult?: ValidationResult;
  // Error handling
  error?: string;
  errorType?: 'ambiguity' | 'validation' | 'execution' | 'llm' | 'system';
  clarificationOptions?: ClarificationOption[];
  // Debug metadata
  debug?: DebugMetadata;
}

export interface SQLPlan {
  intent: string;
  entities: string[];
  filters: string[];
  metrics: string[];
  groupBy: string[];
  orderBy: string[];
  ranking?: {
    metric: string;
    direction: 'ASC' | 'DESC';
    limit?: number;
  };
  timeComparison?: {
    type: string;
    periods: string[];
  };
  reasoning: string;
}

/** One condition from the question, measured in isolation against the data. */
export interface EmptyResultProbe {
  condition: string;
  matchCount: number | null;
  error?: string;
}

export interface ClarificationOption {
  label: string;
  description: string;
  value: string;
}

export interface DebugMetadata {
  requestId: string;
  model: string;
  interpretedIntent: string;
  tablesSelected: string[];
  businessDefinitionsUsed: string[];
  sqlGenerated: string;
  validationStatus: string;
  executionTimeMs: number;
  llmLatencyMs: number;
  rowsReturned: number;
  repairAttempts: number;
  pipelineStages: PipelineStage[];
}

export interface PipelineStage {
  name: string;
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  details?: string;
}

export interface OrchestratorConfig {
  /**
   * Skip the separate LLM planning call for questions that don't need it.
   * Planning costs a full extra round trip (~270 output tokens) on
   * decode-bound hardware, but it measurably buys correctness on
   * multi-condition and trend questions — so it is skipped only when the
   * question looks single-shot. See shouldPlan().
   */
  fastMode: boolean;
  maxRepairAttempts: number;
  maxResultRows: number;
  sqlTimeoutMs: number;
  llmTimeoutMs: number;
  dialect: SQLDialect;
}

// ---------------------------------------------------------------------------
// Conversation Context (for follow-up queries)
// ---------------------------------------------------------------------------

interface ConversationContext {
  sessionId: string;
  history: Array<{
    question: string;
    sql: string;
    plan: SQLPlan | null;
    tables: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Query Orchestrator
// ---------------------------------------------------------------------------

export class QueryOrchestrator {
  private llm: LLMProvider;
  private schemaRetriever: SchemaRetriever;
  private guardian: SQLGuardian;
  private db: DatabaseAdapter;
  private auditLogger: AuditLogger;
  private config: OrchestratorConfig;
  private conversations: Map<string, ConversationContext> = new Map();
  /** Lazily loaded once per process: actual date span of every date column */
  private dataCoverage: string | null = null;

  constructor(
    llm: LLMProvider,
    schemaRetriever: SchemaRetriever,
    guardian: SQLGuardian,
    db: DatabaseAdapter,
    auditLogger: AuditLogger,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.llm = llm;
    this.schemaRetriever = schemaRetriever;
    this.guardian = guardian;
    this.db = db;
    this.auditLogger = auditLogger;
    this.config = {
      fastMode: config.fastMode ?? true,
      maxRepairAttempts: config.maxRepairAttempts ?? 3,
      maxResultRows: config.maxResultRows ?? 1000,
      sqlTimeoutMs: config.sqlTimeoutMs ?? 30000,
      llmTimeoutMs: config.llmTimeoutMs ?? 60000,
      dialect: config.dialect ?? 'postgresql',
    };
  }

  /**
   * Process a natural language query through the full pipeline.
   */
  async processQuery(request: QueryRequest): Promise<QueryResponse> {
    const requestId = `req_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const pipelineStart = performance.now();
    const stages: PipelineStage[] = [];
    let totalLlmLatency = 0;
    let repairAttempts = 0;

    try {
      // -------------------------------------------------------------------
      // Stage 1: Schema & Semantic Retrieval
      // -------------------------------------------------------------------
      const retrievalStart = performance.now();
      const retrieval = this.schemaRetriever.retrieve(request.question);
      stages.push({
        name: 'Schema & Semantic Retrieval',
        status: 'success',
        durationMs: Math.round(performance.now() - retrievalStart),
        details: `Retrieved ${retrieval.retrievedTableNames.length} tables`,
      });

      // Check for ambiguity — return clarification request
      if (retrieval.hasAmbiguity) {
        const ambiguousTerm = retrieval.semanticResolution.ambiguousTerms[0];
        const options: ClarificationOption[] = ambiguousTerm.possibleMeanings.map((m) => ({
          label: m.label,
          description: m.description,
          value: m.label,
        }));

        return {
          requestId,
          success: false,
          errorType: 'ambiguity',
          error: `The term "${ambiguousTerm.term}" has multiple business meanings. Please clarify which one you mean.`,
          clarificationOptions: options,
          debug: this.buildDebugMetadata(requestId, '', [], [], '', 'ambiguity', 0, 0, 0, 0, stages),
        };
      }

      // -------------------------------------------------------------------
      // Stage 2: SQL Planning
      // -------------------------------------------------------------------
      const planStart = performance.now();
      const conversationContext = this.getConversationContext(request);

      let plan: SQLPlan;
      if (this.config.fastMode && !this.shouldPlan(request.question)) {
        // No LLM call — the question itself carries the intent, and generation
        // reads the schema and semantics directly.
        plan = this.buildInlinePlan(request.question, retrieval, conversationContext);
      } else {
        plan = await this.generateSQLPlan(request.question, retrieval, conversationContext);
        const planLatency = Math.round(performance.now() - planStart);
        totalLlmLatency += planLatency;
        stages.push({
          name: 'SQL Planning',
          status: 'success',
          durationMs: planLatency,
          details: `Intent: ${plan.intent}`,
        });
      }

      // -------------------------------------------------------------------
      // Stage 3: SQL Generation
      // -------------------------------------------------------------------
      const genStart = performance.now();
      let sql = await this.generateSQL(plan, retrieval);
      const genLatency = Math.round(performance.now() - genStart);
      totalLlmLatency += genLatency;
      stages.push({
        name: 'SQL Generation',
        status: 'success',
        durationMs: genLatency,
        details: `Generated ${sql.length} chars`,
      });

      // -------------------------------------------------------------------
      // Stage 4: SQL Validation
      // -------------------------------------------------------------------
      const valStart = performance.now();
      let validation = this.guardian.validate(sql);
      stages.push({
        name: 'SQL Validation',
        status: validation.valid ? 'success' : 'error',
        durationMs: Math.round(performance.now() - valStart),
        details: validation.valid
          ? `Passed (${validation.warnings.length} warnings)`
          : `Failed: ${validation.errors.map((e) => e.message).join('; ')}`,
      });

      if (!validation.valid) {
        // Attempt repair
        const repairResult = await this.repairSQL(sql, validation, retrieval, plan);
        repairAttempts = repairResult.attempts;
        totalLlmLatency += repairResult.llmLatencyMs;

        if (repairResult.success) {
          sql = repairResult.sql;
          validation = repairResult.validation;
          stages.push({
            name: 'SQL Repair',
            status: 'success',
            durationMs: repairResult.totalMs,
            details: `Fixed after ${repairResult.attempts} attempt(s)`,
          });
        } else {
          return {
            requestId,
            success: false,
            sql,
            sqlPlan: plan,
            validationResult: validation,
            error: `Generated SQL failed validation: ${validation.errors.map((e) => e.message).join('. ')}`,
            errorType: 'validation',
            debug: this.buildDebugMetadata(requestId, '', retrieval.retrievedTableNames, this.getBusinessDefs(retrieval), sql, 'validation_failed', 0, totalLlmLatency, 0, repairAttempts, stages),
          };
        }
      }

      // Use modified SQL (with limits applied) if available
      const executableSql = validation.modifiedSql || sql;

      // -------------------------------------------------------------------
      // Stage 5: SQL Execution
      // -------------------------------------------------------------------
      const execStart = performance.now();
      try {
        const result = await this.db.executeQuery(executableSql, [], this.config.sqlTimeoutMs);
        const execMs = Math.round(performance.now() - execStart);
        stages.push({
          name: 'SQL Execution',
          status: 'success',
          durationMs: execMs,
          details: `${result.rowCount} rows in ${result.executionTimeMs}ms`,
        });

        // -------------------------------------------------------------------
        // Stage 6: Result Summary
        // -------------------------------------------------------------------
        const summaryStart = performance.now();
        const truncated = result.rowCount >= this.config.maxResultRows;

        // Zero rows is the one case where the user needs an explanation, not a summary
        let emptyDiagnosis: EmptyResultProbe[] | undefined;
        let summary: { summary: string; filters: string[] };
        if (result.rowCount === 0) {
          const diagnosis = await this.diagnoseEmptyResult(request.question, executableSql, retrieval);
          emptyDiagnosis = diagnosis.probes.length > 0 ? diagnosis.probes : undefined;
          summary = { summary: diagnosis.summary, filters: plan.filters };
        } else {
          summary = await this.generateSummary(request.question, plan, result.rows, result.rowCount, truncated);
        }
        const summaryLatency = Math.round(performance.now() - summaryStart);
        totalLlmLatency += summaryLatency;
        stages.push({
          name: 'Result Summary',
          status: 'success',
          durationMs: summaryLatency,
        });

        // Update conversation context
        this.updateConversationContext(request, sql, plan, retrieval.retrievedTableNames);

        // Audit
        const totalMs = Math.round(performance.now() - pipelineStart);
        this.auditLogger.log({
          requestId,
          userId: request.userId || 'anonymous',
          timestamp: new Date().toISOString(),
          userQuestion: request.question,
          model: this.llm.getConfig().model,
          retrievedTables: retrieval.retrievedTableNames,
          retrievedBusinessRules: this.getBusinessDefs(retrieval),
          generatedSql: sql,
          validationResult: validation.valid ? 'passed' : 'failed',
          executionStatus: 'success',
          executionTimeMs: totalMs,
          rowCount: result.rowCount,
          repairAttempts,
        });

        return {
          requestId,
          success: true,
          data: result.rows,
          rowCount: result.rowCount,
          fields: result.fields,
          truncated,
          emptyResultDiagnosis: emptyDiagnosis,
          summary: summary.summary,
          filtersApplied: summary.filters,
          executionTimeMs: totalMs,
          sql,
          sqlPlan: plan,
          validationResult: validation,
          debug: this.buildDebugMetadata(
            requestId, plan.intent, retrieval.retrievedTableNames,
            this.getBusinessDefs(retrieval), sql, 'success',
            totalMs, totalLlmLatency, result.rowCount, repairAttempts, stages
          ),
        };
      } catch (execError: any) {
        // SQL execution failed — attempt repair
        stages.push({
          name: 'SQL Execution',
          status: 'error',
          durationMs: Math.round(performance.now() - execStart),
          details: execError.message,
        });

        const repairResult = await this.repairSQLFromError(
          sql, execError.message, retrieval, plan
        );
        repairAttempts += repairResult.attempts;
        totalLlmLatency += repairResult.llmLatencyMs;

        if (repairResult.success) {
          // Re-execute repaired SQL
          const reExecStart = performance.now();
          const reResult = await this.db.executeQuery(
            repairResult.validation.modifiedSql || repairResult.sql,
            [],
            this.config.sqlTimeoutMs
          );
          stages.push({
            name: 'SQL Repair + Re-execution',
            status: 'success',
            durationMs: Math.round(performance.now() - reExecStart),
            details: `Fixed and got ${reResult.rowCount} rows`,
          });

          const reTruncated = reResult.rowCount >= this.config.maxResultRows;
          const summary = await this.generateSummary(request.question, plan, reResult.rows, reResult.rowCount, reTruncated);
          totalLlmLatency += 500; // Approximate
          const totalMs = Math.round(performance.now() - pipelineStart);

          this.updateConversationContext(request, repairResult.sql, plan, retrieval.retrievedTableNames);

          this.auditLogger.log({
            requestId, userId: request.userId || 'anonymous',
            timestamp: new Date().toISOString(), userQuestion: request.question,
            model: this.llm.getConfig().model,
            retrievedTables: retrieval.retrievedTableNames,
            retrievedBusinessRules: this.getBusinessDefs(retrieval),
            generatedSql: repairResult.sql, validationResult: 'passed_after_repair',
            executionStatus: 'success', executionTimeMs: totalMs,
            rowCount: reResult.rowCount, repairAttempts,
          });

          return {
            requestId, success: true,
            data: reResult.rows, rowCount: reResult.rowCount, fields: reResult.fields,
            truncated: reTruncated,
            summary: summary.summary, filtersApplied: summary.filters,
            executionTimeMs: totalMs, sql: repairResult.sql, sqlPlan: plan,
            validationResult: repairResult.validation,
            debug: this.buildDebugMetadata(
              requestId, plan.intent, retrieval.retrievedTableNames,
              this.getBusinessDefs(retrieval), repairResult.sql, 'success_after_repair',
              totalMs, totalLlmLatency, reResult.rowCount, repairAttempts, stages
            ),
          };
        }

        // All repair attempts failed
        const totalMs = Math.round(performance.now() - pipelineStart);
        return {
          requestId, success: false, sql,
          error: `I was unable to generate a correct query for this request. The database returned: ${execError.message}`,
          errorType: 'execution', sqlPlan: plan, validationResult: validation,
          executionTimeMs: totalMs,
          debug: this.buildDebugMetadata(
            requestId, plan.intent, retrieval.retrievedTableNames,
            this.getBusinessDefs(retrieval), sql, 'execution_failed',
            totalMs, totalLlmLatency, 0, repairAttempts, stages
          ),
        };
      }
    } catch (error: any) {
      const totalMs = Math.round(performance.now() - pipelineStart);
      const errorType = error.message?.includes('LLM') ? 'llm' : 'system';
      return {
        requestId, success: false,
        error: `An internal error occurred: ${error.message}`,
        errorType,
        executionTimeMs: totalMs,
        debug: this.buildDebugMetadata(requestId, '', [], [], '', `error_${errorType}`, totalMs, totalLlmLatency, 0, repairAttempts, stages),
      };
    }
  }

  // -------------------------------------------------------------------------
  // LLM Interactions
  // -------------------------------------------------------------------------

  /**
   * The dataset does not necessarily end today, and the model cannot guess its
   * span. Without this, relative time windows get hardcoded to plausible-looking
   * calendar years that miss the data entirely and silently return zero rows.
   * Computed once per process and cached.
   */
  private async getDataCoverage(): Promise<string> {
    if (this.dataCoverage !== null) return this.dataCoverage;

    try {
      const cols = await this.db.executeQuery(
        `SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')
          ORDER BY table_name, column_name`,
        [],
        this.config.sqlTimeoutMs
      );

      if (cols.rowCount === 0) {
        this.dataCoverage = '';
        return this.dataCoverage;
      }

      const parts = cols.rows.map(
        (c: any) =>
          `SELECT '${c.table_name}.${c.column_name}' AS col, ` +
          `MIN(${c.column_name})::text AS lo, MAX(${c.column_name})::text AS hi ` +
          `FROM ${c.table_name}`
      );

      const spans = await this.db.executeQuery(parts.join(' UNION ALL '), [], this.config.sqlTimeoutMs);
      const lines = spans.rows
        .filter((r: any) => r.lo && r.hi)
        .map((r: any) => `  ${r.col}: ${String(r.lo).slice(0, 10)} to ${String(r.hi).slice(0, 10)}`);

      this.dataCoverage = lines.length
        ? `\n=== ACTUAL DATA COVERAGE (today is ${new Date().toISOString().slice(0, 10)}) ===\n` +
          `These are the real date ranges present. Any time window must fall inside them.\n` +
          lines.join('\n') + '\n'
        : '';
    } catch (err: any) {
      console.warn(`[Orchestrator] Could not determine data coverage: ${err.message}`);
      this.dataCoverage = '';
    }

    return this.dataCoverage;
  }

  /**
   * Questions whose SQL needs a plan first. Dropping planning on these produced
   * wrong or invalid SQL in testing (multi-condition and trend questions
   * especially), so they keep the extra round trip. Everything else skips it.
   */
  private shouldPlan(question: string): boolean {
    const q = question.toLowerCase();

    const complexSignals = [
      'consecutive', 'year over year', 'year-over-year', 'yoy',
      'quarter over quarter', 'quarter-over-quarter',
      'compare', 'comparison', 'versus', ' vs ',
      'while', 'despite', 'whereas',
      'trend', 'growth', 'declin', 'increas', 'decreas',
      'percentile', 'median', 'top 5%', 'top 10%', 'bottom',
      'above their', 'below their', 'above the average', 'below the average',
      'in each', 'for every', 'within each', 'per region', 'per department',
      'before and after', 'unresolved', 'attrition',
    ];

    if (complexSignals.some((sig) => q.includes(sig))) return true;

    // Long questions tend to carry several conditions even without a keyword
    return question.trim().split(/\s+/).length > 18;
  }

  /**
   * A plan built without an LLM round trip. Carries the question and retrieved
   * context so generation, repair and audit keep the same shape as full mode.
   */
  private buildInlinePlan(
    question: string,
    retrieval: RetrievalResult,
    conversationContext?: string
  ): SQLPlan {
    return {
      intent: question,
      entities: retrieval.retrievedTableNames,
      filters: [],
      metrics: [],
      groupBy: [],
      orderBy: [],
      reasoning: conversationContext
        ? `${conversationContext}\n\nAnswer this question: ${question}`
        : question,
    };
  }

  private async generateSQLPlan(
    question: string,
    retrieval: RetrievalResult,
    conversationContext?: string
  ): Promise<SQLPlan> {
    const coverage = await this.getDataCoverage();

    const systemPrompt = `You are an expert SQL query planner for a banking database (${this.config.dialect} dialect).
Your task is to analyze a natural language question and produce a structured query plan.

${retrieval.schemaPrompt}
${retrieval.semanticPrompt}
${coverage}
Any period you choose MUST lie within the data coverage above. Never plan a window
outside it — that returns zero rows. For "recent"/"last N periods", use the latest
periods that actually exist in the data.

${conversationContext ? `\n=== CONVERSATION CONTEXT ===\n${conversationContext}\n` : ''}

You MUST respond with a valid JSON object containing:
{
  "intent": "brief description of the query intent",
  "entities": ["list of database entities/tables needed"],
  "filters": ["list of filter conditions in natural language"],
  "metrics": ["list of metrics/aggregations needed"],
  "groupBy": ["columns to group by"],
  "orderBy": ["columns to order by with direction"],
  "ranking": { "metric": "...", "direction": "ASC|DESC", "limit": N } or null,
  "timeComparison": { "type": "year-over-year|quarter-over-quarter|...", "periods": ["..."] } or null,
  "reasoning": "step-by-step explanation of how to construct the query"
}

Be precise. Use actual table and column names from the schema provided.
If the question is ambiguous, still produce the best possible plan and note the ambiguity in reasoning.`;

    const response = await this.llm.generateStructured<SQLPlan>({
      systemPrompt,
      userPrompt: question,
      temperature: 0,
      maxTokens: 2000,
      jsonMode: true,
    });

    return response.parsed;
  }

  private async generateSQL(plan: SQLPlan, retrieval: RetrievalResult): Promise<string> {
    const dialectInstructions = this.getDialectInstructions();

    const coverage = await this.getDataCoverage();

    const systemPrompt = `You are an expert SQL developer. Generate a ${this.config.dialect.toUpperCase()} SQL query based on the structured plan and schema below.

${retrieval.schemaPrompt}
${retrieval.semanticPrompt}
${coverage}

=== SQL DIALECT RULES ===
${dialectInstructions}

=== WHAT TO ANSWER ===
${this.config.fastMode ? plan.reasoning : JSON.stringify(plan, null, 2)}

RULES:
1. Generate ONLY a single SELECT query (or WITH...SELECT for CTEs).
2. Use proper ${this.config.dialect.toUpperCase()} syntax.
3. Handle NULL values appropriately with COALESCE.
4. Use meaningful column aliases.
5. Include proper JOIN conditions — never produce Cartesian products.
6. Follow the business definitions strictly. Do not invent business logic.
7. For fiscal year calculations, Indian fiscal year runs April 1 to March 31.
8. Apply EVERY condition in the question. Conditions joined by "while", "but",
   "despite" or "and" must ALL constrain the final result — never drop one.
9. "Top N%" means the single best N% slice. Use
   PERCENT_RANK() OVER (PARTITION BY ... ORDER BY metric DESC) <= N/100.
   With NTILE(k) you must set k = 100/N and select ONLY tile = 1; NTILE(20) with
   "tile <= 5" is the top 25%, not the top 5%.
10. "Declined/increased for N consecutive periods" needs N strict comparisons
   between adjacent periods via LAG, not a first-vs-last comparison.
11. Rank within a group by PARTITION BY that group — never rank globally.
12. Every column you reference must exist on the table or CTE you qualify it with.
   Do not assume a column exists on one table because it exists on another.
   Reference a CTE's derived value by the exact alias that CTE defines.
13. Derive a period arithmetically from its date column, e.g.
   EXTRACT(YEAR FROM d) + CASE WHEN EXTRACT(MONTH FROM d) >= 4 THEN 1 ELSE 0 END.
   Never bucket periods with a CASE of overlapping cutoffs (WHEN d <= '2023-03-31'
   ... WHEN d <= '2022-03-31' ...) — CASE stops at the first true branch, so all
   rows collapse into one period and the comparison returns nothing.
14. With SELECT DISTINCT, every ORDER BY expression must also appear in the select
   list. If you need to order by something else, drop DISTINCT and use GROUP BY.
15. Prefer explicit column lists over SELECT *.
16. Relative time windows ("last six months", "recent quarters", "year over year")
    must be anchored to the DATA, never to hardcoded calendar years. The dataset
    does not necessarily end today. Anchor to the table's own latest date, e.g.
      WHERE t.transaction_date >= (SELECT MAX(transaction_date) FROM transactions)
                                  - INTERVAL '6 months'
    Hardcoding a window such as '2022-04-01' to '2024-03-31' will silently match
    zero rows if the data lies outside it. Today's date is ${new Date().toISOString().slice(0, 10)}.

Respond with ONLY the SQL query. No explanations, no markdown, no code blocks,
no commentary before or after. Do not restate the question. Start with SELECT or WITH.`;

    const response = await this.llm.generate({
      systemPrompt,
      userPrompt: `Generate the SQL query for: ${plan.reasoning}`,
      temperature: 0,
      maxTokens: 3000,
    });

    // Clean the response — remove markdown code blocks if present
    let sql = response.content.trim();
    sql = sql.replace(/^```(?:sql)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return sql;
  }

  /**
   * A bare "no records matched" is indistinguishable from a broken query. When a
   * result is empty, measure each condition of the question on its own so we can
   * report WHICH one eliminated everything — an answer, rather than a blank grid.
   */
  private async diagnoseEmptyResult(
    question: string,
    sql: string,
    retrieval: RetrievalResult
  ): Promise<{ summary: string; probes: EmptyResultProbe[] }> {
    const fallback = 'No records matched the specified criteria.';

    try {
      const coverage = await this.getDataCoverage();

      const response = await this.llm.generateStructured<{
        probes: Array<{ condition: string; sql: string }>;
      }>({
        systemPrompt: `A ${this.config.dialect.toUpperCase()} query returned zero rows. Determine why.

${retrieval.schemaPrompt}
${coverage}

The user asked: "${question}"

The query that returned nothing:
${sql}

Break the question into its individual conditions. For EACH condition, write a
standalone COUNT query measuring how many rows satisfy THAT CONDITION ALONE,
ignoring the others. This isolates which condition eliminated every row.

Respond with JSON:
{"probes": [{"condition": "plain English description", "sql": "SELECT COUNT(*) AS n FROM ..."}]}

Rules: at most 4 probes. Each sql must be a single SELECT returning one column named n.
No CTEs unless necessary. Never reference a column that does not exist.`,
        userPrompt: 'Produce the diagnostic probes.',
        temperature: 0,
        maxTokens: 1500,
        jsonMode: true,
      });

      // Probes are independent — run them concurrently so a diagnosis costs one
      // round trip, not four. This path only runs on an empty result, which is
      // already the moment the user is waiting on an explanation.
      const probes: EmptyResultProbe[] = await Promise.all(
        (response.parsed.probes ?? [])
          .filter((probe) => probe?.sql && probe?.condition)
          .slice(0, 4)
          .map(async (probe): Promise<EmptyResultProbe> => {
            const validation = this.guardian.validate(probe.sql);
            if (!validation.valid) {
              return { condition: probe.condition, matchCount: null, error: 'probe failed validation' };
            }

            try {
              const res = await this.db.executeQuery(validation.modifiedSql || probe.sql, [], 8000);
              // COUNT comes back as a string from pg (bigint), so coerce
              const n = Number(res.rows?.[0]?.n ?? res.rows?.[0]?.count);
              return { condition: probe.condition, matchCount: Number.isFinite(n) ? n : null };
            } catch (err: any) {
              return { condition: probe.condition, matchCount: null, error: err.message };
            }
          })
      );

      const measured = probes.filter((p) => p.matchCount !== null);
      if (measured.length === 0) return { summary: fallback, probes };

      const empty = measured.filter((p) => p.matchCount === 0);

      if (empty.length > 0) {
        const list = empty.map((p) => `"${p.condition}"`).join(' and ');
        return {
          summary:
            `No records matched. The reason is ${empty.length > 1 ? 'these conditions match' : 'this condition matches'} ` +
            `no rows at all in the current data: ${list}. ` +
            `Other conditions do have matching data, so the result is empty because of ${empty.length > 1 ? 'those' : 'that'}.`,
          probes,
        };
      }

      const detail = measured.map((p) => `${p.condition}: ${p.matchCount!.toLocaleString('en-IN')} rows`).join('; ');
      return {
        summary:
          `No records matched. Each condition has matching data on its own (${detail}), ` +
          `but no record satisfies all of them at the same time.`,
        probes,
      };
    } catch (err: any) {
      console.warn(`[Orchestrator] Empty-result diagnosis failed: ${err.message}`);
      return { summary: fallback, probes: [] };
    }
  }

  private async generateSummary(
    question: string,
    plan: SQLPlan,
    rows: Record<string, any>[],
    rowCount: number,
    truncated = false
  ): Promise<{ summary: string; filters: string[] }> {
    // For very simple results, generate summary locally
    if (rowCount === 0) {
      return {
        summary: 'No records matched the specified criteria.',
        filters: plan.filters,
      };
    }

    const sampleRows = rows.slice(0, 5);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    const systemPrompt = `You are a banking data analyst writing an executive summary.
Given a user question and query results, write a brief, clear summary. Two sentences maximum.

Question: "${question}"
Total rows returned: ${rowCount}${truncated ? ` (TRUNCATED — the row cap was reached, so the full result set is LARGER than ${rowCount}. Say the list is truncated and never present ${rowCount} as a complete total.)` : ''}
Columns: ${columns.join(', ')}
Sample data (first ${sampleRows.length} rows): ${JSON.stringify(sampleRows)}

Respond with a JSON object:
{
  "summary": "Executive summary of the results",
  "filters": ["list of filters that were applied"]
}

Write the summary as if speaking to a senior bank manager. Be factual and concise.
Use Indian number formatting where appropriate (lakhs, crores).

CRITICAL — this summary is read by bank executives as fact:
- Use ONLY figures shown above. Never calculate, estimate, extrapolate or infer a number.
- In particular, never derive population totals or percentages from the row count.
- Describe only what the sample rows and the row count actually show.
- If the question implies a check the data cannot confirm, say so plainly rather than implying it was verified.`;

    try {
      const response = await this.llm.generateStructured<{ summary: string; filters: string[] }>({
        systemPrompt,
        userPrompt: 'Generate the executive summary.',
        temperature: 0.1,
        maxTokens: 220,
        jsonMode: true,
      });
      return response.parsed;
    } catch {
      // Fallback to basic summary
      return {
        summary: `Retrieved ${rowCount} record(s) for your query about ${plan.intent}.`,
        filters: plan.filters,
      };
    }
  }

  // -------------------------------------------------------------------------
  // SQL Repair Loop
  // -------------------------------------------------------------------------

  private async repairSQL(
    originalSql: string,
    validation: ValidationResult,
    retrieval: RetrievalResult,
    plan: SQLPlan
  ): Promise<{
    success: boolean;
    sql: string;
    validation: ValidationResult;
    attempts: number;
    totalMs: number;
    llmLatencyMs: number;
  }> {
    let sql = originalSql;
    let currentValidation = validation;
    let attempts = 0;
    let totalLlmMs = 0;
    const start = performance.now();

    while (attempts < this.config.maxRepairAttempts && !currentValidation.valid) {
      attempts++;

      const errorMessages = currentValidation.errors.map((e) => e.message).join('\n');

      const repairPrompt = `The following ${this.config.dialect.toUpperCase()} SQL query has validation errors:

SQL:
${sql}

Errors:
${errorMessages}

Schema context:
${retrieval.schemaPrompt}

Fix the SQL to resolve these errors. Respond with ONLY the corrected SQL query.
Do not include explanations, markdown, or code blocks.`;

      const repairStart = performance.now();
      const response = await this.llm.generate({
        systemPrompt: `You are a SQL debugging expert. Fix the SQL query to resolve the reported errors. Use ${this.config.dialect.toUpperCase()} syntax.`,
        userPrompt: repairPrompt,
        temperature: 0,
        maxTokens: 3000,
      });
      totalLlmMs += Math.round(performance.now() - repairStart);

      sql = response.content.trim().replace(/^```(?:sql)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      currentValidation = this.guardian.validate(sql);
    }

    return {
      success: currentValidation.valid,
      sql,
      validation: currentValidation,
      attempts,
      totalMs: Math.round(performance.now() - start),
      llmLatencyMs: totalLlmMs,
    };
  }

  /**
   * Prescriptive fixes for database errors whose remedy is mechanical.
   */
  private getErrorHint(dbError: string): string {
    const hints: Array<[RegExp, string]> = [
      [/SELECT DISTINCT, ORDER BY expressions must appear in select list/i,
       'Fix: remove DISTINCT and de-duplicate with GROUP BY over the selected columns, ' +
       'or add every ORDER BY expression to the select list. Do not keep DISTINCT as-is.'],
      [/must appear in the GROUP BY clause or be used in an aggregate function/i,
       'Fix: add that column to GROUP BY, or wrap it in an aggregate such as MAX()/AVG().'],
      [/function pg_catalog\.extract\(unknown, integer\) does not exist/i,
       'Fix: EXTRACT was applied to an integer, not a date. That value is already a ' +
       'number — use it directly instead of calling EXTRACT on it.'],
      [/operator does not exist: /i,
       'Fix: the operand types do not match. Cast explicitly, e.g. value::numeric or value::date.'],
      [/division by zero/i,
       'Fix: guard the denominator with NULLIF(denominator, 0).'],
    ];

    for (const [pattern, hint] of hints) {
      if (pattern.test(dbError)) return `\n\nKnown fix for this error: ${hint}`;
    }
    return '';
  }

  private async repairSQLFromError(
    originalSql: string,
    dbError: string,
    retrieval: RetrievalResult,
    plan: SQLPlan
  ): Promise<{
    success: boolean;
    sql: string;
    validation: ValidationResult;
    attempts: number;
    llmLatencyMs: number;
  }> {
    let sql = originalSql;
    let attempts = 0;
    let totalLlmMs = 0;

    while (attempts < this.config.maxRepairAttempts) {
      attempts++;

      // Well-understood database errors get a prescriptive fix rather than
      // leaving the model to rediscover it — general prompt rules proved
      // unreliable for these, and each wasted attempt costs a repair cycle.
      const errorHint = this.getErrorHint(dbError);

      // A missing-column error is the most common repair failure: the model tends
      // to re-use the same invented name. Give it the real column index.
      const columnIndex = /column\s+"?[\w.]+"?\s+does not exist/i.test(dbError)
        ? '\n\nColumns that actually exist (table: columns):\n' +
          retrieval.schemaContext.tables
            .map((t) => `${t.name}: ${t.columns.map((c) => c.name).join(', ')}`)
            .join('\n')
        : '';

      const repairPrompt = `The following ${this.config.dialect.toUpperCase()} SQL query failed during execution:

SQL:
${sql}

Database error:
${dbError}${errorHint}${columnIndex}

Schema context:
${retrieval.schemaPrompt}

Original query plan:
${JSON.stringify(plan, null, 2)}

Fix the SQL to resolve this error.

Checklist before answering:
- If the error names a missing column, that column does not exist. Do NOT re-use it.
  Find the correct column in the schema above, or derive it — and if it came from a
  CTE, make the reference match the alias that CTE actually defines.
- Verify every column you reference exists on the table/CTE you qualify it with.
- Preserve the original query intent and ALL of its conditions.

Respond with ONLY the corrected SQL query.`;

      const repairStart = performance.now();
      const response = await this.llm.generate({
        systemPrompt: `You are a ${this.config.dialect.toUpperCase()} SQL debugging expert. Analyze the database error and fix the query.`,
        userPrompt: repairPrompt,
        temperature: 0.05,
        maxTokens: 3000,
      });
      totalLlmMs += Math.round(performance.now() - repairStart);

      sql = response.content.trim().replace(/^```(?:sql)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      // Validate the repaired SQL
      const validation = this.guardian.validate(sql);
      if (!validation.valid) continue;

      // Try executing
      try {
        await this.db.executeQuery(validation.modifiedSql || sql, [], this.config.sqlTimeoutMs);
        return { success: true, sql, validation, attempts, llmLatencyMs: totalLlmMs };
      } catch (err: any) {
        dbError = err.message; // Update error for next repair attempt
      }
    }

    return {
      success: false,
      sql,
      validation: this.guardian.validate(sql),
      attempts,
      llmLatencyMs: totalLlmMs,
    };
  }

  // -------------------------------------------------------------------------
  // Conversation Context
  // -------------------------------------------------------------------------

  private getConversationContext(request: QueryRequest): string | undefined {
    if (!request.sessionId || !request.isFollowUp) return undefined;

    const ctx = this.conversations.get(request.sessionId);
    if (!ctx || ctx.history.length === 0) return undefined;

    const recent = ctx.history.slice(-3); // Last 3 exchanges
    const lines = recent.map(
      (h, i) => `Turn ${i + 1}: "${h.question}" → Tables: [${h.tables.join(', ')}]\nSQL: ${h.sql}`
    );

    return `The user is asking a follow-up question. Previous conversation:\n${lines.join('\n\n')}\n\nThe new question should be interpreted in the context of this conversation. Carry forward relevant filters and context.`;
  }

  private updateConversationContext(
    request: QueryRequest,
    sql: string,
    plan: SQLPlan,
    tables: string[]
  ): void {
    const sessionId = request.sessionId || 'default';
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, { sessionId, history: [] });
    }

    const ctx = this.conversations.get(sessionId)!;
    ctx.history.push({
      question: request.question,
      sql,
      plan,
      tables,
    });

    // Keep only last 10 exchanges
    if (ctx.history.length > 10) {
      ctx.history = ctx.history.slice(-10);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getDialectInstructions(): string {
    switch (this.config.dialect) {
      case 'postgresql':
        return `
- Use PostgreSQL syntax.
- Use LIMIT for result limiting (not ROWNUM or TOP).
- Use DATE_TRUNC for date truncation.
- Use EXTRACT(MONTH FROM date) or EXTRACT(YEAR FROM date) for date parts.
- Use COALESCE for null handling.
- Use || for string concatenation.
- Use CURRENT_DATE and CURRENT_TIMESTAMP.
- Use GENERATE_SERIES for sequences if needed.
- Use FILTER (WHERE ...) clause with aggregates if appropriate.
- CTEs use WITH ... AS (...).
- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() OVER (...).
- Boolean values: TRUE/FALSE.
- Case-sensitive identifiers: use double quotes if needed for mixed-case names.
- For Indian fiscal year: FY starts April 1. FY 2023-24 means April 1 2023 to March 31 2024.`;

      case 'oracle':
        return `
- Use Oracle SQL syntax.
- Use FETCH FIRST N ROWS ONLY for result limiting (not LIMIT).
- Use TRUNC(date, 'MM') for date truncation.
- Use EXTRACT(MONTH FROM date) for date parts.
- Use NVL or COALESCE for null handling.
- Use || for string concatenation.
- Use SYSDATE and SYSTIMESTAMP.
- Use DUAL for SELECT without a table.
- CTEs use WITH ... AS (...).
- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() OVER (...).
- No boolean type; use 'Y'/'N' or 1/0.
- For Indian fiscal year: FY starts April 1. FY 2023-24 means April 1 2023 to March 31 2024.`;

      default:
        return `Use standard SQL syntax.`;
    }
  }

  private getBusinessDefs(retrieval: RetrievalResult): string[] {
    return retrieval.semanticResolution.resolvedTerms.map(
      (t) => `${t.originalTerm}: ${t.businessTerm.description}`
    );
  }

  private buildDebugMetadata(
    requestId: string,
    intent: string,
    tables: string[],
    businessDefs: string[],
    sql: string,
    status: string,
    totalMs: number,
    llmMs: number,
    rows: number,
    repairs: number,
    stages: PipelineStage[]
  ): DebugMetadata {
    return {
      requestId,
      model: this.llm.getConfig().model,
      interpretedIntent: intent,
      tablesSelected: tables,
      businessDefinitionsUsed: businessDefs,
      sqlGenerated: sql,
      validationStatus: status,
      executionTimeMs: totalMs,
      llmLatencyMs: llmMs,
      rowsReturned: rows,
      repairAttempts: repairs,
      pipelineStages: stages,
    };
  }
}
