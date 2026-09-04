// ============================================================================
// Scoring Engine — Configurable DQ Scoring
// ============================================================================
// Produces the Internal Regulatory Data Quality Score from rule execution
// results. All weights and thresholds are configurable.
//
// IMPORTANT: This produces an "Internal Regulatory Data Quality Score" or
// "sDQI Readiness Score" — NOT an official RBI score. The methodology is
// configurable and can be updated when RBI guidelines change.
//
// DETERMINISTIC: No LLM dependency. Given the same input data and scoring
// configuration, the engine always produces the same score.
// ============================================================================

import type {
  DQRuleExecution, ScoringConfig, ScoreResult, DimensionScore, DQDimension,
} from './types.js';
import { MOCK_SCORING_CONFIG, MOCK_TREND_DATA } from './mock-data.js';
import type { TrendDataPoint } from './types.js';

export class ScoringEngine {
  private config: ScoringConfig;
  private trendData: TrendDataPoint[];

  constructor() {
    this.config = { ...MOCK_SCORING_CONFIG };
    this.trendData = [...MOCK_TREND_DATA];
  }

  // -----------------------------------------------------------------------
  // Scoring Configuration
  // -----------------------------------------------------------------------

  /** Get the active scoring configuration */
  getActiveConfig(): ScoringConfig {
    return this.config;
  }

  /** Update scoring configuration (admin action) */
  updateConfig(updates: Partial<ScoringConfig>): ScoringConfig {
    this.config = { ...this.config, ...updates, version: this.config.version + 1 };
    return this.config;
  }

  // -----------------------------------------------------------------------
  // Score Calculation
  // -----------------------------------------------------------------------

  /**
   * Calculate the overall DQ score from rule executions.
   *
   * Algorithm:
   * 1. Group executions by dimension
   * 2. For each dimension: score = (passed / total) * 100
   * 3. Weight each dimension score by the configured weight
   * 4. Overall = sum of weighted dimension scores
   *
   * This is fully deterministic and auditable.
   */
  calculateScore(
    executions: DQRuleExecution[],
    reportingPeriod: string,
    calculatedBy: string = 'System',
  ): ScoreResult {
    const dimensions: DQDimension[] = ['accuracy', 'completeness', 'consistency', 'timeliness'];
    const dimensionScores: DimensionScore[] = [];

    for (const dim of dimensions) {
      const dimExecs = executions.filter(e => e.rule.dimension === dim);
      const total = dimExecs.length;
      const passed = dimExecs.filter(e => e.status === 'passed').length;
      const failed = dimExecs.filter(e => e.status === 'failed').length;
      const skipped = dimExecs.filter(e => e.status === 'skipped').length;

      // Dimension score: percentage of rules passed (weighted by severity)
      let score: number;
      if (total === 0) {
        score = 100;
      } else {
        // Severity-weighted scoring: critical failures reduce score more
        const severityWeights: Record<string, number> = {
          critical: 3.0,
          high: 2.0,
          medium: 1.0,
          low: 0.5,
        };

        let totalWeight = 0;
        let passedWeight = 0;

        for (const exec of dimExecs) {
          const w = severityWeights[exec.rule.severity] || 1;
          totalWeight += w;
          if (exec.status === 'passed') {
            passedWeight += w;
          }
        }

        score = totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 100;
      }

      const configWeight = this.config.dimensionWeights.find(w => w.dimension === dim)?.weight || 0.25;

      dimensionScores.push({
        dimension: dim,
        score: Math.round(score * 10) / 10,
        weight: configWeight,
        weightedScore: Math.round(score * configWeight * 10) / 10,
        totalRules: total,
        passedRules: passed,
        failedRules: failed,
        skippedRules: skipped,
      });
    }

    const overallScore = Math.round(
      dimensionScores.reduce((sum, ds) => sum + ds.weightedScore, 0) * 10
    ) / 10;

    // Find previous period score
    const periodIndex = this.trendData.findIndex(t => t.period === reportingPeriod);
    const previousScore = periodIndex > 0 ? this.trendData[periodIndex - 1].overallScore : null;

    return {
      scoreId: `SCORE-${Date.now()}`,
      reportingPeriod,
      overallScore,
      dimensions: dimensionScores,
      scoringConfig: this.config,
      ruleExecutions: executions,
      calculatedAt: new Date().toISOString(),
      calculatedBy,
      previousScore,
      changeFromPrevious: previousScore !== null ? Math.round((overallScore - previousScore) * 10) / 10 : null,
    };
  }

  // -----------------------------------------------------------------------
  // Pre-computed Score (for demo — uses mock trend data)
  // -----------------------------------------------------------------------

  /** Get the current period's pre-computed score result */
  getCurrentScore(): ScoreResult {
    const current = this.trendData[this.trendData.length - 1];
    return {
      scoreId: 'SCORE-CURRENT',
      reportingPeriod: current.period,
      overallScore: current.overallScore,
      dimensions: [
        { dimension: 'accuracy', score: current.accuracy, weight: 0.30, weightedScore: Math.round(current.accuracy * 0.30 * 10) / 10, totalRules: 7, passedRules: 5, failedRules: 2, skippedRules: 0 },
        { dimension: 'completeness', score: current.completeness, weight: 0.25, weightedScore: Math.round(current.completeness * 0.25 * 10) / 10, totalRules: 7, passedRules: 3, failedRules: 4, skippedRules: 0 },
        { dimension: 'consistency', score: current.consistency, weight: 0.25, weightedScore: Math.round(current.consistency * 0.25 * 10) / 10, totalRules: 6, passedRules: 3, failedRules: 3, skippedRules: 0 },
        { dimension: 'timeliness', score: current.timeliness, weight: 0.20, weightedScore: Math.round(current.timeliness * 0.20 * 10) / 10, totalRules: 5, passedRules: 4, failedRules: 1, skippedRules: 0 },
      ],
      scoringConfig: this.config,
      ruleExecutions: [],
      calculatedAt: new Date().toISOString(),
      calculatedBy: 'System',
      previousScore: this.trendData.length >= 2 ? this.trendData[this.trendData.length - 2].overallScore : null,
      changeFromPrevious: this.trendData.length >= 2
        ? Math.round((current.overallScore - this.trendData[this.trendData.length - 2].overallScore) * 10) / 10
        : null,
    };
  }

  // -----------------------------------------------------------------------
  // Trend Analysis
  // -----------------------------------------------------------------------

  /** Get trend data across reporting periods */
  getTrendData(): TrendDataPoint[] {
    return this.trendData;
  }

  /**
   * Generate a deterministic trend explanation based on data.
   * NOT AI-generated — uses data-driven templates.
   */
  getTrendExplanation(): string {
    const data = this.trendData;
    if (data.length < 2) return 'Insufficient historical data for trend analysis.';

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    const diff = Math.round((latest.overallScore - previous.overallScore) * 10) / 10;

    if (diff < 0) {
      // Identify the most deteriorated dimension
      const dims: { name: string; current: number; prev: number; diff: number }[] = [
        { name: 'Accuracy', current: latest.accuracy, prev: previous.accuracy, diff: latest.accuracy - previous.accuracy },
        { name: 'Completeness', current: latest.completeness, prev: previous.completeness, diff: latest.completeness - previous.completeness },
        { name: 'Consistency', current: latest.consistency, prev: previous.consistency, diff: latest.consistency - previous.consistency },
        { name: 'Timeliness', current: latest.timeliness, prev: previous.timeliness, diff: latest.timeliness - previous.timeliness },
      ];
      dims.sort((a, b) => a.diff - b.diff);
      const worst = dims[0];

      // Check for consecutive decline
      let consecutiveDecline = 0;
      for (let i = data.length - 1; i > 0; i--) {
        if (data[i].overallScore < data[i - 1].overallScore) {
          consecutiveDecline++;
        } else {
          break;
        }
      }

      const trend = consecutiveDecline > 1
        ? `Score has declined for ${consecutiveDecline} consecutive quarters.`
        : '';

      return `Overall score declined by ${Math.abs(diff)} points from ${previous.periodLabel} to ${latest.periodLabel}. ${worst.name} deteriorated the most (${previous.periodLabel}: ${worst.prev.toFixed(1)} → ${latest.periodLabel}: ${worst.current.toFixed(1)}), primarily due to increased reconciliation differences and data gaps. ${trend}`;
    }

    return `Overall score improved by ${diff} points from ${previous.periodLabel} to ${latest.periodLabel}.`;
  }

  /**
   * Update trend data after re-validation (for demo scenario).
   * Simulates score improvement when exceptions are resolved.
   */
  simulateRevalidation(newOverallScore: number): void {
    const latest = this.trendData[this.trendData.length - 1];
    const improvementRatio = newOverallScore / latest.overallScore;
    this.trendData[this.trendData.length - 1] = {
      ...latest,
      overallScore: newOverallScore,
      accuracy: Math.min(100, Math.round(latest.accuracy * improvementRatio * 10) / 10),
      completeness: Math.min(100, Math.round(latest.completeness * improvementRatio * 10) / 10),
      consistency: Math.min(100, Math.round(latest.consistency * improvementRatio * 10) / 10),
      timeliness: Math.min(100, Math.round(latest.timeliness * improvementRatio * 10) / 10),
      exceptionCount: Math.max(0, latest.exceptionCount - 5),
      criticalExceptionCount: 0,
    };
  }
}
