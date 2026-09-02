// ============================================================================
// Backend Initialization / Bootstrap
// ============================================================================
// Single entry point that wires all backend components together:
//   PostgresAdapter → SchemaIntelligence → SemanticLayer → SchemaRetriever →
//   SelfHostedLLMProvider → SQLGuardian → AuditLogger → QueryOrchestrator
//
// Reads all configuration from environment variables and JSON files.
// Exports a ready-to-use QueryOrchestrator and supporting services.
// ============================================================================

import path from 'path';
import { PostgresAdapter } from './db/postgres-adapter.js';
import type {
  DatabaseConfig,
} from './db/database-adapter.js';
import { SchemaIntelligence } from './schema/schema-intelligence.js';
import { SemanticLayer } from './schema/semantic-layer.js';
import { SchemaRetriever } from './schema/schema-retriever.js';
import { SchemaConfigLoader } from './schema/schema-config-loader.js';
import { SelfHostedLLMProvider } from './llm/self-hosted-provider.js';
import {
  LLMProvider,
} from './llm/llm-provider.js';
import type {
  LLMConfig,
} from './llm/llm-provider.js';
import { SQLGuardian } from './pipeline/sql-guardian.js';
import { AuditLogger } from './audit/audit-logger.js';
import {
  QueryOrchestrator,
} from './pipeline/query-orchestrator.js';
import type {
  OrchestratorConfig,
} from './pipeline/query-orchestrator.js';

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------

export interface BackendConfig {
  /** Path to the database/ directory containing schema_catalog.json and semantic/ */
  databaseDir: string;
  /** Path to the audit log directory */
  auditDir?: string;
}

// ---------------------------------------------------------------------------
// Services container
// ---------------------------------------------------------------------------

export interface BackendServices {
  db: PostgresAdapter;
  llm: LLMProvider;
  schemaIntelligence: SchemaIntelligence;
  semanticLayer: SemanticLayer;
  schemaRetriever: SchemaRetriever;
  guardian: SQLGuardian;
  auditLogger: AuditLogger;
  orchestrator: QueryOrchestrator;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export async function initializeBackend(config: BackendConfig): Promise<BackendServices> {
  console.log('[Init] Starting backend initialization...');

  // 1. Database
  const dbConfig = buildDatabaseConfig();
  const db = new PostgresAdapter(dbConfig);
  await db.connect();
  console.log('[Init] ✅ Database connected');

  // 2. LLM Provider
  const llmConfig = buildLLMConfig();
  const llm = new SelfHostedLLMProvider(llmConfig, 'qwen_runpod');
  console.log(`[Init] ✅ LLM configured: ${llmConfig.model} at ${llmConfig.baseUrl}`);

  // 3. Schema Intelligence + Semantic Layer
  const schemaIntelligence = new SchemaIntelligence();
  const semanticLayer = new SemanticLayer();

  // Load from JSON files
  const loader = new SchemaConfigLoader(config.databaseDir);
  const loadResult = loader.load(schemaIntelligence, semanticLayer);
  console.log(`[Init] ✅ Schema loaded: ${loadResult.tableCount} tables, ${loadResult.viewCount} views, ${loadResult.termCount} terms, ${loadResult.ruleCount} rules, ${loadResult.relationshipCount} relationships`);

  // 4. Schema Retriever
  const schemaRetriever = new SchemaRetriever(schemaIntelligence, semanticLayer);

  // 5. SQL Guardian
  const guardian = new SQLGuardian(schemaIntelligence, {
    maxResultRows: parseInt(process.env.SQL_MAX_ROWS || '1000', 10),
    maxJoins: parseInt(process.env.SQL_MAX_JOINS || '10', 10),
    maxSubqueryDepth: parseInt(process.env.SQL_MAX_SUBQUERY_DEPTH || '5', 10),
    dialect: 'postgresql',
  });

  // 6. Audit Logger
  const auditLogger = new AuditLogger(config.auditDir);

  // 7. Query Orchestrator
  const orchestratorConfig: Partial<OrchestratorConfig> = {
    maxRepairAttempts: parseInt(process.env.MAX_REPAIR_ATTEMPTS || '3', 10),
    maxResultRows: parseInt(process.env.SQL_MAX_ROWS || '1000', 10),
    sqlTimeoutMs: parseInt(process.env.SQL_TIMEOUT_MS || '30000', 10),
    llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
    dialect: 'postgresql',
  };

  const orchestrator = new QueryOrchestrator(
    llm,
    schemaRetriever,
    guardian,
    db,
    auditLogger,
    orchestratorConfig
  );

  console.log('[Init] ✅ Backend fully initialized');

  return {
    db,
    llm,
    schemaIntelligence,
    semanticLayer,
    schemaRetriever,
    guardian,
    auditLogger,
    orchestrator,
  };
}

// ---------------------------------------------------------------------------
// Config builders
// ---------------------------------------------------------------------------

function buildDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Parse DATABASE_URL connection string
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      user: url.username,
      password: url.password,
      database: url.pathname.replace(/^\//, ''),
      dialect: 'postgresql',
      readOnly: process.env.DB_READ_ONLY !== 'false',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '5', 10),
      idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
      statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
      ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech'),
    };
  }

  // Fallback to individual env vars
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'neondb',
    dialect: 'postgresql',
    readOnly: process.env.DB_READ_ONLY !== 'false',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '5', 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
    statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
  };
}

function buildLLMConfig(): LLMConfig {
  const baseUrl = process.env.LLM_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'LLM_BASE_URL environment variable is required. Set it to your RunPod vLLM endpoint, e.g. https://<pod-id>-8000.proxy.runpod.net/v1'
    );
  }

  return {
    baseUrl,
    model: process.env.LLM_MODEL || 'Qwen/Qwen3-Coder-Next',
    apiKey: process.env.LLM_API_KEY || process.env.RUNPOD_API_KEY,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.05'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '2', 10),
  };
}

// ---------------------------------------------------------------------------
// Standalone health check
// ---------------------------------------------------------------------------

export async function healthCheck(services: BackendServices): Promise<{
  database: { connected: boolean; latencyMs?: number };
  llm: { healthy: boolean; model: string; latencyMs?: number; error?: string };
  schema: { tables: number; terms: number };
}> {
  const dbTest = await services.db.testConnection();
  const llmHealth = await services.llm.healthCheck();

  return {
    database: {
      connected: dbTest.success,
      latencyMs: dbTest.latencyMs,
    },
    llm: {
      healthy: llmHealth.healthy,
      model: llmHealth.model,
      latencyMs: llmHealth.latencyMs,
      error: llmHealth.error,
    },
    schema: {
      tables: services.schemaIntelligence.getAllTables().length,
      terms: services.semanticLayer.getTermCount(),
    },
  };
}
