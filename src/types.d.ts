export interface ElectronAPI {
  dbConnect: (connectionString?: string) => Promise<{ success: boolean; error?: string }>;
  dbQuery: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  dbGetSchema: () => Promise<{ success: boolean; data?: any; error?: string }>;
  dbSelectFile: () => Promise<string | null>;
  
  dbSaveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  dbGetConfigs: () => Promise<any[]>;
  dbDeleteConfig: (id: string) => Promise<{ success: boolean; error?: string }>;
  dbConnectConfig: (id: string) => Promise<{ success: boolean; error?: string }>;
  dbTestConnection: (config: any) => Promise<{ success: boolean; error?: string }>;

  settingsGet: (key: string) => Promise<any>;
  settingsSet: (key: string, value: any) => Promise<boolean>;

  voiceTranscribe: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; text?: string; error?: string }>;

  /** Full NL -> SQL pipeline: retrieval, planning, generation, guardrails, execution */
  aiQuery: (question: string, sessionId?: string) => Promise<AIQueryResponse>;
  aiHealth: () => Promise<any>;
  aiAudit: (limit?: number) => Promise<{ entries: any[]; metrics: any }>;
  aiSchemaPreview: (question: string) => Promise<any>;
}

export interface AIQueryResponse {
  requestId?: string;
  success: boolean;
  data?: any[];
  rowCount?: number;
  fields?: Array<{ name: string; dataType: string }>;
  /** True when the row cap was hit — the result is a partial view */
  truncated?: boolean;
  /** On an empty result: which individual conditions do/don't match data */
  emptyResultDiagnosis?: Array<{ condition: string; matchCount: number | null; error?: string }>;
  summary?: string;
  filtersApplied?: string[];
  executionTimeMs?: number;
  sql?: string;
  error?: string;
  errorType?: 'ambiguity' | 'validation' | 'execution' | 'llm' | 'system';
  clarificationOptions?: Array<{ label: string; description: string; value: string }>;
  debug?: {
    model?: string;
    interpretedIntent?: string;
    tablesSelected?: string[];
    repairAttempts?: number;
    pipelineStages?: Array<{ name: string; status: string; durationMs: number; details?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
