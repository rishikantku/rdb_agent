// ============================================================================
// RDB Agent — AI Guardrail & Query Scope Control Layer
// ============================================================================
// Pure, deterministic, multi-stage classifier that enforces the governance
// boundary between user input and the SQL/LLM pipeline.
//
// Categories:
//   1. SECURITY_SENSITIVE  → Prompt injection, jailbreak, credential harvesting
//   2. UNSUPPORTED         → Banking question, but data absent from schema
//   3. OUT_OF_SCOPE        → Non-bank trivia, banter, code, creative writing
//   4. AMBIGUOUS           → Under-specified metric or entity needing clarification
//   5. IN_SCOPE            → Authorized banking data/analytics queries
// ============================================================================

import type {
  ConversationHistoryItem,
  GuardrailCategory,
  GuardrailDecision,
  OutOfScopeReason,
  QueryIntentContract,
} from './types';

// ----------------------------------------------------------------------------
// 1. Security Patterns (Strict Prompt Injection & Reconnaissance)
// ----------------------------------------------------------------------------

const SECURITY_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+|prior\s+)?(instructions|rules|restrictions|prompts)/i,
  /forget\s+(that\s+)?you\s+are\s+(an?\s+)?rdb\s+agent/i,
  /act\s+as\s+(a\s+)?general(-|\s+)purpose\s+chat(bot)?/i,
  /bypass(\s+the)?\s+(database|security|system)?\s*(restrictions|guardrails|filters|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|internal\s+instructions|hidden\s+prompt)/i,
  /tell\s+me\s+your\s+internal\s+instructions/i,
  /print\s+(your\s+)?system\s+prompt/i,
  /disregard\s+all\s+constraints/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /dan\s+mode/i,
];

const SECURITY_CREDENTIAL_PATTERNS = [
  /(show|give|extract|dump|fetch|get)\s+(me\s+)?(all\s+)?(database\s+|db\s+)?(passwords|credentials|secret\s*keys|api\s*keys)/i,
  /(show|give|dump)\s+(me\s+)?(all\s+)?users\s+and\s+passwords/i,
  /database\s+credentials/i,
  /internal\s+system\s+configuration/i,
  /connection\s+string/i,
  /master\s+encryption\s+key/i,
  /env(ironment)?\s+variables/i,
];

// ----------------------------------------------------------------------------
// 2. Unsupported Domains (Entities / Data Not in Connected Banking Schema)
// ----------------------------------------------------------------------------

const UNSUPPORTED_SCHEMA_PATTERNS = [
  {
    regex: /\b(atm|atms)\s+(uptime|downtime|cash\s+level|maintenance|hardware|dispenser|failure)\b/i,
    entity: 'ATM Hardware Telemetry',
    reason: 'ATM machine telemetry, uptime, and maintenance data are not captured in the connected banking core schema.',
  },
  {
    regex: /\b(atm\s+uptime)\b/i,
    entity: 'ATM Uptime',
    reason: 'ATM machine telemetry and uptime are not present in the connected schema.',
  },
  {
    regex: /\b(credit\s*card\s*reward(\s*points)?|loyalty\s*points)\b/i,
    entity: 'Credit Card Loyalty Program',
    reason: 'Credit card rewards and loyalty program ledgers are not part of the connected core database.',
  },
  {
    regex: /\b(pos\s*terminal|merchant\s*swipe\s*machine)\b/i,
    entity: 'POS Terminal Hardware',
    reason: 'Merchant POS physical telemetry is not stored in the core banking database.',
  },
  {
    regex: /\b(mobile\s*app\s*crash|play\s*store\s*rating|app\s*store\s*reviews)\b/i,
    entity: 'Mobile App Analytics',
    reason: 'Mobile application telemetry and app store ratings are external data sources.',
  },
  {
    regex: /\b(forex\s*trading\s*desk|currency\s*derivatives\s*swap)\b/i,
    entity: 'Forex Trading Desk',
    reason: 'Real-time treasury dealing room books are not available in this reporting database.',
  },
];

// ----------------------------------------------------------------------------
// 3. Out-Of-Scope Patterns (Trivia, Banter, Coding, Creative, Personal)
// ----------------------------------------------------------------------------

interface OutOfScopeMatch {
  regex: RegExp;
  reason: OutOfScopeReason;
  label: string;
}

const OUT_OF_SCOPE_PATTERNS: OutOfScopeMatch[] = [
  // General Knowledge & Politics
  { regex: /\b(prime\s+minister|president|parliament|election|narendra\s+modi|bjp|congress|politician)\b/i, reason: 'GENERAL_KNOWLEDGE', label: 'Politics / Government' },
  { regex: /\b(capital\s+of\s+[a-z]+|largest\s+country|population\s+of\s+[a-z]+|who\s+is\s+[a-z\s]+(actor|singer|leader))\b/i, reason: 'GENERAL_KNOWLEDGE', label: 'General Geography / Facts' },
  { regex: /\b(quantum\s+physics|relativity|speed\s+of\s+light|gravity|black\s+hole|photosynthesis)\b/i, reason: 'GENERAL_KNOWLEDGE', label: 'Science / Physics' },
  { regex: /\b(cricket\s+score|ipl|world\s+cup|football|fifa|messi|ronaldo|olympics)\b/i, reason: 'GENERAL_KNOWLEDGE', label: 'Sports & Entertainment' },

  // Casual Banter & Conversational AI
  { regex: /^(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening|howdy|sup)\b/i, reason: 'CASUAL_CONVERSATION', label: 'Casual Greeting' },
  { regex: /\b(how\s+are\s+you|how's\s+it\s+going|who\s+made\s+you|what('s|\s+is)\s+your\s+name|who\s+are\s+you)\b/i, reason: 'CASUAL_CONVERSATION', label: 'Conversational Banter' },
  { regex: /\b(tell\s+me\s+a\s+joke|make\s+me\s+laugh|funny\s+story|riddle)\b/i, reason: 'CASUAL_CONVERSATION', label: 'Entertainment / Humor' },

  // Personal Advice
  { regex: /\b(what\s+should\s+i\s+(eat|cook|wear|buy|watch)|movie\s+recommendation)\b/i, reason: 'PERSONAL_ADVICE', label: 'Personal Advice' },
  { regex: /\b(how\s+to\s+lose\s+weight|workout\s+routine|diet\s+plan|headache\s+remedy)\b/i, reason: 'PERSONAL_ADVICE', label: 'Health / Lifestyle Advice' },
  { regex: /\b(should\s+i\s+buy\s+a\s+house|relationship\s+advice|career\s+advice)\b/i, reason: 'PERSONAL_ADVICE', label: 'Personal Consultation' },

  // Creative Writing
  { regex: /\b(write(\s+me)?\s+(a\s+)?(poem|song|story|rap|birthday\s+message|essay|haiku))\b/i, reason: 'CREATIVE_WRITING', label: 'Creative Writing' },

  // Programming & Coding
  { regex: /\b(write|create|code|debug|explain)\s+(a\s+)?(python|javascript|typescript|java|c\+\+|golang|html|css)\s+(program|code|script|function)\b/i, reason: 'PROGRAMMING_CODE', label: 'Software Programming' },
  { regex: /\b(sort\s+an\s+array|reverse\s+a\s+linked\s+list|binary\s+tree|kubernetes|docker\s+container)\b/i, reason: 'PROGRAMMING_CODE', label: 'Computer Science / DevOps' },

  // General AI & Tech questions
  { regex: /\b(what\s+is\s+chatgpt|which\s+llm\s+is\s+better|how\s+does\s+gpt\s+work|what\s+is\s+artificial\s+intelligence)\b/i, reason: 'GENERAL_AI', label: 'General AI Questions' },

  // Unrelated Business & External Markets
  { regex: /\b(stock\s+price\s+of\s+(apple|google|microsoft|tesla|amazon|meta|tcs|infosys))\b/i, reason: 'UNRELATED_BUSINESS', label: 'External Equities' },
  { regex: /\b(bitcoin|cryptocurrency|ethereum|solana|crypto\s+price)\b/i, reason: 'UNRELATED_BUSINESS', label: 'Cryptocurrency' },
  { regex: /\b(weather\s+(today|tomorrow|in)|temperature\s+outside|will\s+it\s+rain)\b/i, reason: 'UNRELATED_BUSINESS', label: 'Weather Report' },

  // Generic Banking Educational Concept / Tutor
  { regex: /^what\s+is\s+a\s+(savings\s+account|current\s+account|fixed\s+deposit|recurring\s+deposit|debit\s+card|loan|mortgage|banking)\??$/i, reason: 'GENERIC_BANKING_CONCEPT', label: 'Generic Banking Definition' },
  { regex: /^explain\s+(compound\s+interest|what\s+is\s+banking|how\s+do\s+banks\s+work)\??$/i, reason: 'GENERIC_BANKING_CONCEPT', label: 'Banking Tutorial' },
];

// ----------------------------------------------------------------------------
// 4. Ambiguous Question Detector
// ----------------------------------------------------------------------------

interface AmbiguousPattern {
  regex: RegExp;
  clarificationPrompt: string;
  options: Array<{ label: string; prompt: string; description: string }>;
}

const AMBIGUOUS_PATTERNS: AmbiguousPattern[] = [
  {
    regex: /^(show(\s+me)?|view|get|display)\s+(the\s+)?performance(\.|\?)?$/i,
    clarificationPrompt: 'What type of performance would you like to see — branch, employee, loan portfolio, or another banking metric?',
    options: [
      { label: 'Branch Performance', prompt: 'Top performing branches by deposit growth this quarter', description: 'Deposits and loan growth by branch' },
      { label: 'Employee Productivity', prompt: 'Average transactions processed per employee by branch', description: 'Staff throughput & performance scores' },
      { label: 'Loan Portfolio Quality', prompt: 'NPA ratio and overdue trends across all loan types', description: 'Delinquency and recovery tracking' },
      { label: 'Financial Performance', prompt: 'Revenue and profitability summary by region', description: 'Net margins and income distribution' },
    ],
  },
  {
    regex: /^(show(\s+me)?|view|get|display)\s+(the\s+)?growth(\.|\?)?$/i,
    clarificationPrompt: 'Would you like to see loan growth, deposit growth, transaction growth, customer growth, or another metric?',
    options: [
      { label: 'Loan Growth', prompt: 'Which branches had loan growth above 15% YoY?', description: 'Advance portfolio expansion' },
      { label: 'Deposit Growth', prompt: 'Top branches by deposit growth this financial year', description: 'Savings and current balance trends' },
      { label: 'Transaction Growth', prompt: 'Transaction volume growth month-over-month by channel', description: 'Digital vs branch velocity' },
      { label: 'Customer Acquisition', prompt: 'New customer onboarding count by zone for the last 6 months', description: 'Account opening momentum' },
    ],
  },
  {
    regex: /^(show(\s+me)?|what\s+are\s+the|display)\s+(the\s+)?trends?(\.|\?)?$/i,
    clarificationPrompt: 'Which trend would you like to analyze — loan disbursements, deposits, transactions, or NPA ratios?',
    options: [
      { label: 'Deposit Trends', prompt: 'Deposit growth trends by branch over the last 4 quarters', description: 'Balance movement analysis' },
      { label: 'Loan Disbursements', prompt: 'Quarterly loan disbursement trends for the past 2 financial years', description: 'Credit sanction volume' },
      { label: 'NPA Ratio Trends', prompt: 'NPA ratio trends across branches for the past 4 quarters', description: 'Credit asset quality evolution' },
      { label: 'Transaction Volume', prompt: 'Monthly transaction count and volume trends by channel', description: 'Operational channel activity' },
    ],
  },
  {
    regex: /^(show(\s+me)?|what\s+is\s+the)\s+(the\s+)?status(\.|\?)?$/i,
    clarificationPrompt: 'Which status would you like to inspect — loan portfolio status, account status, or customer KYC status?',
    options: [
      { label: 'Loan Portfolio Status', prompt: 'Active, closed, and NPA loan breakdown by branch', description: 'Credit status distribution' },
      { label: 'Account Status', prompt: 'Count of active, dormant, and frozen accounts by branch', description: 'Deposit account health' },
      { label: 'Customer KYC Status', prompt: 'Breakdown of customers by risk category and KYC status', description: 'Compliance segmentation' },
    ],
  },
];

// ----------------------------------------------------------------------------
// 5. Banking Data Recognizers (Entities, Metrics, Analytics)
// ----------------------------------------------------------------------------

const BANKING_ENTITIES = [
  'customer', 'client', 'borrower', 'depositor',
  'account', 'savings', 'current account', 'fixed deposit', 'balance',
  'loan', 'advance', 'npa', 'disbursement', 'sanction', 'portfolio', 'interest rate', 'emi',
  'transaction', 'txn', 'deposit', 'withdrawal', 'transfer', 'debit', 'credit', 'channel',
  'branch', 'zone', 'region', 'state', 'territory',
  'employee', 'staff', 'manager', 'headcount', 'salary', 'attrition', 'productivity',
  'department', 'complaint', 'interaction', 'product',
];

const BANKING_METRICS = [
  'growth', 'decline', 'yoy', 'qoq', 'financial year', 'fy', 'ratio', 'percentage', 'pct',
  'total', 'average', 'avg', 'sum', 'count', 'max', 'min', 'volume', 'turnover',
  'highest', 'lowest', 'top', 'bottom', 'rank', 'ranking', 'compare', 'comparison',
  'overdue', 'delinquent', 'provision', 'yield', 'margin', 'profitability', 'revenue',
];

const BANKING_GEO_TERMS = [
  'ranchi', 'jharkhand', 'dhanbad', 'jamshedpur', 'bokaro', 'hazaribagh',
  'bihar', 'patna', 'delhi', 'mumbai', 'kolkata', 'bengaluru', 'pan india',
  'all branches', 'every branch', 'my branch', 'my zone', 'my region',
];

// ----------------------------------------------------------------------------
// 6. Conversational Follow-Up Recognizers
// ----------------------------------------------------------------------------

const FOLLOW_UP_PATTERNS = [
  /^(only|just)\s+for\s+[a-z0-9\s]+$/i,
  /^(now\s+)?compare\s+(that|this|it)\s+(with|to)\s+[a-z0-9\s]+$/i,
  /^(what\s+about|how\s+about)\s+[a-z0-9\s]+$/i,
  /^(filter|narrow\s+down)\s+(by|to)\s+[a-z0-9\s]+$/i,
  /^(sort|order)\s+by\s+[a-z0-9\s]+$/i,
  /^(top|bottom)\s+\d+(\s+only)?$/i,
  /^(break\s+it\s+down|breakdown)\s+by\s+[a-z0-9\s]+$/i,
  /^(and\s+)?for\s+(last\s+year|last\s+quarter|q[1-4]|202[0-9])/i,
];

// ----------------------------------------------------------------------------
// Core Classifier Class
// ----------------------------------------------------------------------------

export class QueryGuardrail {
  private confidenceThreshold = 0.70;

  /**
   * Evaluates a user input against the governance boundary.
   * Runs before authorization, semantic retrieval, or LLM invocation.
   */
  classify(
    question: string,
    history: ConversationHistoryItem[] = []
  ): GuardrailDecision {
    const raw = question.trim();
    const q = raw.toLowerCase();

    // ------------------------------------------------------------------------
    // Stage 1: Security & Injection Scan (Highest Priority)
    // ------------------------------------------------------------------------
    for (const pattern of SECURITY_INJECTION_PATTERNS) {
      if (pattern.test(q)) {
        return this.buildSecurityDecision(
          raw,
          'Prompt injection attempt detected: Instruction override or system prompt extraction is prohibited.',
          'System integrity guardrail triggered'
        );
      }
    }

    for (const pattern of SECURITY_CREDENTIAL_PATTERNS) {
      if (pattern.test(q)) {
        return this.buildSecurityDecision(
          raw,
          'Security policy: System credentials, internal configuration, and secrets cannot be accessed.',
          'Credential protection guardrail triggered'
        );
      }
    }

    // ------------------------------------------------------------------------
    // Stage 2: Unsupported Schema Scanner
    // ------------------------------------------------------------------------
    for (const unsup of UNSUPPORTED_SCHEMA_PATTERNS) {
      if (unsup.regex.test(q)) {
        return this.buildUnsupportedDecision(raw, unsup.entity, unsup.reason);
      }
    }

    // ------------------------------------------------------------------------
    // Stage 3: Ambiguous Query Check (Must precede general out-of-scope)
    // ------------------------------------------------------------------------
    for (const ambig of AMBIGUOUS_PATTERNS) {
      if (ambig.regex.test(q)) {
        return this.buildAmbiguousDecision(raw, ambig.clarificationPrompt, ambig.options);
      }
    }

    // ------------------------------------------------------------------------
    // Stage 4: Out-Of-Scope Scanner
    // ------------------------------------------------------------------------
    for (const oos of OUT_OF_SCOPE_PATTERNS) {
      if (oos.regex.test(q)) {
        return this.buildOutOfScopeDecision(raw, oos.reason, oos.label);
      }
    }

    // ------------------------------------------------------------------------
    // Stage 5: Conversational Follow-Up Resolution
    // ------------------------------------------------------------------------
    const lastInScope = [...history].reverse().find((h) => h.classification === 'IN_SCOPE');
    const isFollowUpPattern = FOLLOW_UP_PATTERNS.some((pat) => pat.test(q));

    if (lastInScope && (isFollowUpPattern || this.isShortRefinement(q))) {
      // Inherit banking data context
      return this.buildInScopeDecision(
        raw,
        lastInScope.entities || ['inherited'],
        ['trend', 'comparison'],
        lastInScope.domain || 'BANK_ANALYTICS',
        'COMPLEX_ANALYTICS',
        0.94,
        true
      );
    }

    // ------------------------------------------------------------------------
    // Stage 6: In-Scope Banking Analytics Evaluator
    // ------------------------------------------------------------------------
    const matchedEntities = BANKING_ENTITIES.filter((e) => q.includes(e));
    const matchedMetrics = BANKING_METRICS.filter((m) => q.includes(m));
    const matchedGeos = BANKING_GEO_TERMS.filter((g) => q.includes(g));

    const totalSignals = matchedEntities.length + matchedMetrics.length + matchedGeos.length;

    if (matchedEntities.length > 0 || (matchedMetrics.length > 0 && matchedGeos.length > 0)) {
      const intent = this.inferIntent(matchedMetrics, q);
      const domain = this.inferDomain(matchedEntities);
      const confidence = Math.min(0.99, 0.85 + totalSignals * 0.03);

      return this.buildInScopeDecision(
        raw,
        matchedEntities,
        matchedMetrics,
        domain,
        intent,
        confidence,
        false
      );
    }

    // ------------------------------------------------------------------------
    // Stage 7: Fail-Closed Catch-All
    // ------------------------------------------------------------------------
    // If no banking entities/metrics were found and confidence is low:
    // Do NOT generate SQL. Fail closed as OUT_OF_SCOPE.
    return {
      allowed: false,
      classification: 'OUT_OF_SCOPE',
      confidence: 0.65,
      headline: 'RDB Agent Scope',
      message: "I'm designed to answer questions related to authorized banking data and analytics. Please ask a question about customers, accounts, transactions, loans, branches, employees, or other available bank data.",
      reasons: [
        'The request does not match recognized banking database entities or analytical metrics.',
        'Request blocked before SQL generation to prevent unverified data access.',
      ],
      suggestedQuery: 'Which branches had the highest loan growth this financial year?',
      contract: {
        scope: 'NON_BANK',
        classification: 'OUT_OF_SCOPE',
        confidence: 0.65,
        entities: [],
        metrics: [],
        requires_database: false,
        requires_sql: false,
        reasons: ['No banking entities or metrics detected.'],
        suggestedQuery: 'Which branches had the highest loan growth this financial year?',
      },
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private isShortRefinement(q: string): boolean {
    const words = q.split(/\s+/);
    // Short phrases under 6 words mentioning regions, dates, or sorting
    return words.length <= 5 && (
      BANKING_GEO_TERMS.some((g) => q.includes(g)) ||
      /\b(last\s+year|last\s+quarter|this\s+quarter|yoy|qoq|highest|lowest)\b/i.test(q)
    );
  }

  private inferIntent(
    metrics: string[],
    q: string
  ): 'RETRIEVAL' | 'AGGREGATION' | 'COMPARISON' | 'TREND' | 'RANKING' | 'COMPLEX_ANALYTICS' {
    if (/exceeded.*while.*declined|while.*consecutive/i.test(q)) return 'COMPLEX_ANALYTICS';
    if (metrics.some((m) => ['yoy', 'qoq', 'trend', 'trends', 'growth', 'decline'].includes(m))) return 'TREND';
    if (metrics.some((m) => ['compare', 'comparison', 'versus', 'vs'].includes(m))) return 'COMPARISON';
    if (metrics.some((m) => ['highest', 'lowest', 'top', 'bottom', 'rank', 'ranking'].includes(m))) return 'RANKING';
    if (metrics.some((m) => ['total', 'average', 'avg', 'sum', 'count'].includes(m))) return 'AGGREGATION';
    return 'RETRIEVAL';
  }

  private inferDomain(entities: string[]): string {
    if (entities.some((e) => ['loan', 'npa', 'disbursement', 'sanction', 'advance'].includes(e))) return 'LOAN_ANALYTICS';
    if (entities.some((e) => ['transaction', 'txn', 'deposit', 'withdrawal'].includes(e))) return 'TRANSACTION_ANALYTICS';
    if (entities.some((e) => ['customer', 'client', 'depositor', 'borrower'].includes(e))) return 'CUSTOMER_ANALYTICS';
    if (entities.some((e) => ['account', 'savings', 'current account', 'balance'].includes(e))) return 'ACCOUNT_ANALYTICS';
    if (entities.some((e) => ['employee', 'staff', 'salary', 'attrition', 'productivity'].includes(e))) return 'WORKFORCE_ANALYTICS';
    if (entities.some((e) => ['branch', 'zone', 'region', 'state'].includes(e))) return 'BRANCH_NETWORK';
    return 'GENERAL_BANKING_DATA';
  }

  private buildSecurityDecision(raw: string, reason: string, rule: string): GuardrailDecision {
    return {
      allowed: false,
      classification: 'SECURITY_SENSITIVE',
      confidence: 0.99,
      headline: 'Security Policy Restriction',
      message: 'This request was blocked because it contains instructions that violate security policy or attempt to access system credentials.',
      reasons: [reason, rule, 'Blocked immediately before query planning or semantic parsing.'],
      suggestedQuery: 'Show total deposits by branch.',
      contract: {
        scope: 'NON_BANK',
        classification: 'SECURITY_SENSITIVE',
        confidence: 0.99,
        entities: [],
        metrics: [],
        requires_database: false,
        requires_sql: false,
        reasons: [reason, rule],
      },
    };
  }

  private buildUnsupportedDecision(raw: string, entity: string, reason: string): GuardrailDecision {
    return {
      allowed: false,
      classification: 'UNSUPPORTED',
      confidence: 0.95,
      headline: 'Information Not Available in Schema',
      message: 'This information is not currently available in the connected data sources.',
      reasons: [
        reason,
        'Available data domains include customers, accounts, loans, transactions, branches and employees.',
        'Request blocked to guarantee zero hallucination of unconfigured data.',
      ],
      suggestedQuery: 'Show total deposits by branch.',
      contract: {
        scope: 'BANK_DATA',
        classification: 'UNSUPPORTED',
        confidence: 0.95,
        entities: [entity],
        metrics: [],
        requires_database: false,
        requires_sql: false,
        reasons: [reason],
        suggestedQuery: 'Show total deposits by branch.',
      },
    };
  }

  private buildAmbiguousDecision(
    raw: string,
    prompt: string,
    options: Array<{ label: string; prompt: string; description: string }>
  ): GuardrailDecision {
    return {
      allowed: false,
      classification: 'AMBIGUOUS',
      confidence: 0.90,
      headline: 'Clarification Needed',
      message: prompt,
      reasons: [
        'The query is under-specified and references multiple potential banking metrics.',
        'Clarification requested to ensure precise analytical results.',
      ],
      clarificationPrompt: prompt,
      clarificationOptions: options,
      contract: {
        scope: 'BANK_DATA',
        classification: 'AMBIGUOUS',
        confidence: 0.90,
        intent: 'CLARIFICATION',
        entities: [],
        metrics: ['performance_or_growth'],
        requires_database: false,
        requires_sql: false,
        reasons: ['Under-specified query requires metric disambiguation.'],
        clarificationPrompt: prompt,
        clarificationOptions: options,
      },
    };
  }

  private buildOutOfScopeDecision(
    raw: string,
    reason: OutOfScopeReason,
    label: string
  ): GuardrailDecision {
    return {
      allowed: false,
      classification: 'OUT_OF_SCOPE',
      confidence: 0.96,
      headline: 'RDB Agent Scope',
      message: "I'm designed to answer questions related to authorized banking data and analytics. Please ask a question about customers, accounts, transactions, loans, branches, employees, or other available bank data.",
      reasons: [
        `The request was identified as ${label} (${reason}).`,
        'The request does not require authorized banking data or analytics.',
        'Request blocked before SQL generation.',
      ],
      suggestedQuery: 'Which branches had the highest loan growth this financial year?',
      contract: {
        scope: 'NON_BANK',
        classification: 'OUT_OF_SCOPE',
        confidence: 0.96,
        outOfScopeSubcategory: reason,
        entities: [],
        metrics: [],
        requires_database: false,
        requires_sql: false,
        reasons: [`Identified as ${label}`],
        suggestedQuery: 'Which branches had the highest loan growth this financial year?',
      },
    };
  }

  private buildInScopeDecision(
    raw: string,
    entities: string[],
    metrics: string[],
    domain: string,
    intent: 'RETRIEVAL' | 'AGGREGATION' | 'COMPARISON' | 'TREND' | 'RANKING' | 'COMPLEX_ANALYTICS',
    confidence: number,
    isFollowUp: boolean
  ): GuardrailDecision {
    return {
      allowed: true,
      classification: 'IN_SCOPE',
      confidence,
      isFollowUp,
      headline: 'In Scope: Banking Intelligence',
      message: 'Authorized banking data request.',
      reasons: [
        `Target domain: ${domain}`,
        `Analytical intent: ${intent}`,
        `Recognized entities: ${entities.join(', ') || 'implicit'}`,
      ],
      contract: {
        scope: 'BANK_DATA',
        classification: 'IN_SCOPE',
        confidence,
        domain,
        intent,
        entities,
        metrics,
        requires_database: true,
        requires_sql: true,
        reasons: [`Matches ${domain} with ${intent} intent`],
      },
    };
  }
}

export const queryGuardrail = new QueryGuardrail();
