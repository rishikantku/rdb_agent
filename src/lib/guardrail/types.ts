// ============================================================================
// RDB Agent — AI Guardrail & Query Scope Control Layer Types
// ============================================================================

export type GuardrailCategory =
  | 'IN_SCOPE'
  | 'OUT_OF_SCOPE'
  | 'AMBIGUOUS'
  | 'SECURITY_SENSITIVE'
  | 'UNSUPPORTED';

export type OutOfScopeReason =
  | 'GENERAL_KNOWLEDGE'
  | 'CASUAL_CONVERSATION'
  | 'CREATIVE_WRITING'
  | 'PROGRAMMING_CODE'
  | 'GENERAL_AI'
  | 'PERSONAL_ADVICE'
  | 'UNRELATED_BUSINESS'
  | 'GENERIC_BANKING_CONCEPT';

export interface QueryIntentContract {
  scope: 'BANK_DATA' | 'NON_BANK';
  classification: GuardrailCategory;
  confidence: number;
  domain?: string;
  intent?: 'RETRIEVAL' | 'AGGREGATION' | 'COMPARISON' | 'TREND' | 'RANKING' | 'COMPLEX_ANALYTICS' | 'CLARIFICATION';
  entities: string[];
  metrics: string[];
  timeRange?: string;
  requires_database: boolean;
  requires_sql: boolean;
  reasons: string[];
  outOfScopeSubcategory?: OutOfScopeReason;
  clarificationPrompt?: string;
  clarificationOptions?: Array<{ label: string; prompt: string; description?: string }>;
  suggestedQuery?: string;
}

export interface GuardrailDecision {
  allowed: boolean;
  classification: GuardrailCategory;
  confidence: number;
  contract: QueryIntentContract;
  headline: string;
  message: string;
  reasons: string[];
  suggestedQuery?: string;
  clarificationPrompt?: string;
  clarificationOptions?: Array<{ label: string; prompt: string; description?: string }>;
  isFollowUp?: boolean;
}

export interface ConversationHistoryItem {
  question: string;
  classification: GuardrailCategory;
  domain?: string;
  entities?: string[];
  timestamp: number;
}

export interface GuardrailTestCase {
  id: string;
  name: string;
  question: string;
  expectedClassification: GuardrailCategory;
  categoryGroup: 'In Scope' | 'Out of Scope' | 'Security' | 'Ambiguous' | 'Unsupported';
  description: string;
}

export interface GuardrailTestResult {
  testCase: GuardrailTestCase;
  actualClassification: GuardrailCategory;
  passed: boolean;
  confidence: number;
  latencyMs: number;
  details: string;
}

export interface GuardrailEvaluationSummary {
  total: number;
  passed: number;
  failed: number;
  breakdown: {
    inScope: { total: number; passed: number };
    outOfScope: { total: number; passed: number };
    security: { total: number; passed: number };
    ambiguous: { total: number; passed: number };
    unsupported: { total: number; passed: number };
  };
  results: GuardrailTestResult[];
}
