// ============================================================================
// LLM Provider Abstraction Layer
// ============================================================================
// This module defines the interface contract for all LLM providers.
// The rest of the application interacts ONLY through this interface.
// Whether the underlying model is Qwen, DeepSeek, Llama, or any future model,
// the application code remains unchanged.
// ============================================================================

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LLMGenerateOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  /** If provided, the response will be parsed as JSON matching this schema hint */
  jsonMode?: boolean;
}

export interface LLMResponse {
  requestId: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  finishReason: string;
}

export interface LLMStructuredResponse<T> extends LLMResponse {
  parsed: T;
}

export interface LLMModelInfo {
  model: string;
  provider: string;
  baseUrl: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  metadata?: Record<string, any>;
}

export interface LLMHealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  model: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Abstract Provider Interface
// ---------------------------------------------------------------------------

export abstract class LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0.1,
      maxTokens: 4096,
      timeoutMs: 60000,
      maxRetries: 2,
      ...config,
    };
  }

  /** Generate a free-text completion */
  abstract generate(options: LLMGenerateOptions): Promise<LLMResponse>;

  /** Generate and parse a structured JSON response */
  abstract generateStructured<T>(options: LLMGenerateOptions): Promise<LLMStructuredResponse<T>>;

  /** Check model endpoint health */
  abstract healthCheck(): Promise<LLMHealthCheckResult>;

  /** Get model metadata */
  abstract getModelInfo(): Promise<LLMModelInfo>;

  /** Get the current configuration (without secrets) */
  getConfig(): Omit<LLMConfig, 'apiKey'> {
    const { apiKey, ...safe } = this.config;
    return safe;
  }

  /** Generate a unique request ID for tracing */
  protected generateRequestId(): string {
    return `req_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
  }

  /** Measure execution time of an async function */
  protected async withLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const start = performance.now();
    const result = await fn();
    const latencyMs = Math.round(performance.now() - start);
    return { result, latencyMs };
  }
}
