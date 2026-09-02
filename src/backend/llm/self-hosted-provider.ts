// ============================================================================
// Self-Hosted LLM Provider
// ============================================================================
// Communicates with vLLM / SGLang / any OpenAI-compatible inference server.
// This is the primary provider for the POC, connecting to a self-hosted
// Qwen3-Coder-Next (or any open-weight model) on RunPod or similar infra.
//
// All communication uses the OpenAI-compatible chat completions API format.
// ============================================================================

import {
  LLMProvider,
  LLMConfig,
  LLMGenerateOptions,
  LLMResponse,
  LLMStructuredResponse,
  LLMModelInfo,
  LLMHealthCheckResult,
} from './llm-provider.js';

// ---------------------------------------------------------------------------
// Internal Types for OpenAI-compatible API
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class SelfHostedLLMProvider extends LLMProvider {
  private providerName: string;

  constructor(config: LLMConfig, providerName = 'self_hosted') {
    super(config);
    this.providerName = providerName;
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const requestId = this.generateRequestId();

    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.userPrompt });

    const body: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.maxTokens ?? this.config.maxTokens,
      stream: false,
    };

    if (options.stopSequences && options.stopSequences.length > 0) {
      body.stop = options.stopSequences;
    }

    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const { result: response, latencyMs } = await this.withLatency(() =>
      this.callWithRetry(body, requestId)
    );

    const choice = response.choices[0];

    return {
      requestId,
      content: choice.message.content,
      model: response.model || this.config.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      latencyMs,
      finishReason: choice.finish_reason,
    };
  }

  async generateStructured<T>(options: LLMGenerateOptions): Promise<LLMStructuredResponse<T>> {
    // Force JSON mode for structured responses
    const response = await this.generate({
      ...options,
      jsonMode: true,
    });

    const parsed = this.parseJSON<T>(response.content);

    return {
      ...response,
      parsed,
    };
  }

  async healthCheck(): Promise<LLMHealthCheckResult> {
    try {
      const { result: response, latencyMs } = await this.withLatency(async () => {
        const url = `${this.config.baseUrl}/models`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
        }

        return res.json();
      });

      return {
        healthy: true,
        latencyMs,
        model: this.config.model,
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: 0,
        model: this.config.model,
        error: error.message,
      };
    }
  }

  async getModelInfo(): Promise<LLMModelInfo> {
    const health = await this.healthCheck();

    return {
      model: this.config.model,
      provider: this.providerName,
      baseUrl: this.config.baseUrl,
      status: health.healthy ? 'healthy' : 'unavailable',
      metadata: {
        healthLatencyMs: health.latencyMs,
        configuredTemperature: this.config.temperature,
        configuredMaxTokens: this.config.maxTokens,
        configuredTimeoutMs: this.config.timeoutMs,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async callWithRetry(
    body: ChatCompletionRequest,
    requestId: string,
    attempt = 0
  ): Promise<ChatCompletionResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs!),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        const error = new Error(
          `LLM API error ${res.status}: ${res.statusText}. ${errorBody}`
        );
        (error as any).status = res.status;
        throw error;
      }

      return (await res.json()) as ChatCompletionResponse;
    } catch (error: any) {
      // Retry on transient failures (5xx, timeout, network errors)
      const isRetryable =
        error.status >= 500 ||
        error.name === 'TimeoutError' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET';

      if (isRetryable && attempt < (this.config.maxRetries ?? 2)) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.warn(
          `[LLM] Request ${requestId} failed (attempt ${attempt + 1}), retrying in ${backoffMs}ms: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.callWithRetry(body, requestId, attempt + 1);
      }

      throw error;
    }
  }

  private parseJSON<T>(text: string): T {
    // Try direct parse first
    try {
      return JSON.parse(text.trim());
    } catch (_) {
      // Fall through
    }

    // Try extracting JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (_) {
        // Fall through
      }
    }

    // Try extracting first JSON object
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (_) {
        // Fall through
      }
    }

    // Try extracting first JSON array
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(text.substring(arrStart, arrEnd + 1));
      } catch (_) {
        // Fall through
      }
    }

    throw new Error(`Failed to parse LLM response as JSON. Raw content: ${text.substring(0, 200)}...`);
  }
}
