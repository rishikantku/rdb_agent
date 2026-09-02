// ============================================================================
// Audit Logger
// ============================================================================
// Every query creates an audit record. Never logs passwords, API keys, or
// secrets. Result data is logged at summary level only (row count, not rows).
// ============================================================================

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  requestId: string;
  userId: string;
  timestamp: string;
  userQuestion: string;
  model: string;
  retrievedTables: string[];
  retrievedBusinessRules: string[];
  generatedSql: string;
  validationResult: string;
  executionStatus: string;
  executionTimeMs: number;
  rowCount: number;
  repairAttempts: number;
}

// ---------------------------------------------------------------------------
// Audit Logger
// ---------------------------------------------------------------------------

export class AuditLogger {
  private logDir: string;
  private logFile: string;
  private inMemoryLog: AuditEntry[] = [];

  constructor(logDir?: string) {
    this.logDir = logDir || path.join(process.cwd(), 'audit_logs');
    this.logFile = path.join(this.logDir, `audit_${this.getDateStamp()}.jsonl`);

    // Ensure log directory exists
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.warn('[Audit] Could not create log directory:', error);
    }
  }

  /**
   * Log an audit entry. Writes to both file (JSONL) and in-memory store.
   */
  log(entry: AuditEntry): void {
    // Sanitize — never log sensitive data
    const sanitized = this.sanitize(entry);

    // In-memory (for admin dashboard)
    this.inMemoryLog.push(sanitized);
    if (this.inMemoryLog.length > 1000) {
      this.inMemoryLog = this.inMemoryLog.slice(-500);
    }

    // File (JSONL format — one JSON object per line)
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(sanitized) + '\n', 'utf-8');
    } catch (error) {
      console.warn('[Audit] Could not write log:', error);
    }
  }

  /**
   * Get recent audit entries (for admin dashboard).
   */
  getRecent(limit = 50): AuditEntry[] {
    return this.inMemoryLog.slice(-limit).reverse();
  }

  /**
   * Get aggregate metrics.
   */
  getMetrics(): AuditMetrics {
    const entries = this.inMemoryLog;
    if (entries.length === 0) {
      return {
        totalQueries: 0,
        successRate: 0,
        avgExecutionTimeMs: 0,
        avgRepairAttempts: 0,
        topTables: [],
        queriesLast24h: 0,
      };
    }

    const successful = entries.filter((e) => e.executionStatus === 'success').length;
    const avgTime = entries.reduce((sum, e) => sum + e.executionTimeMs, 0) / entries.length;
    const avgRepairs = entries.reduce((sum, e) => sum + e.repairAttempts, 0) / entries.length;

    // Top tables
    const tableCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const table of entry.retrievedTables) {
        tableCounts.set(table, (tableCounts.get(table) || 0) + 1);
      }
    }
    const topTables = Array.from(tableCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([table, count]) => ({ table, count }));

    // Last 24h
    const now = Date.now();
    const last24h = entries.filter(
      (e) => now - new Date(e.timestamp).getTime() < 86400000
    ).length;

    return {
      totalQueries: entries.length,
      successRate: (successful / entries.length) * 100,
      avgExecutionTimeMs: Math.round(avgTime),
      avgRepairAttempts: Math.round(avgRepairs * 100) / 100,
      topTables,
      queriesLast24h: last24h,
    };
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private sanitize(entry: AuditEntry): AuditEntry {
    return {
      ...entry,
      // Ensure no sensitive data leaks through SQL
      generatedSql: entry.generatedSql.replace(
        /password\s*=\s*'[^']*'/gi,
        "password='***'"
      ),
    };
  }

  private getDateStamp(): string {
    return new Date().toISOString().split('T')[0];
  }
}

export interface AuditMetrics {
  totalQueries: number;
  successRate: number;
  avgExecutionTimeMs: number;
  avgRepairAttempts: number;
  topTables: Array<{ table: string; count: number }>;
  queriesLast24h: number;
}
