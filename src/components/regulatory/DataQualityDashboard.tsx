// ============================================================================
// Data Quality Dashboard — Flagship Executive View
// ============================================================================
// The hero view of the regulatory module. Shows the overall DQ score,
// four dimension cards, submission readiness, critical exceptions,
// trend analysis, and top contributing issues.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, AlertTriangle, TrendingDown, Play, RefreshCw,
  BarChart3, FileText, ArrowRight, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  ScoreGauge, DimensionCard, ReadinessBadge, TrendBarChart,
  ScoreBreakdownTable, ExceptionRow, ScoreChange, TrendSparkline,
} from './ui-components';
import { ScoringEngine } from '../../backend/regulatory/scoring-engine';
import { ExceptionService } from '../../backend/regulatory/exception-service';
import { DQRuleEngine } from '../../backend/regulatory/dq-rule-engine';
import { MOCK_TREND_DATA, MOCK_REGIONAL_BREAKDOWN } from '../../backend/regulatory/mock-data';
import type { RegionalDQSummary } from '../../backend/regulatory/mock-data';
import { getReadinessStatus } from '../../backend/regulatory/types';
import type { RoleId } from '../../lib/permissions';

interface DataQualityDashboardProps {
  roleId: RoleId;
  onNavigateToExceptions?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToScorecard?: () => void;
  onAskQuestion?: (q: string) => void;
}

// Singletons for demo — in production these come from DI/context
const scoringEngine = new ScoringEngine();
const exceptionService = new ExceptionService();
const ruleEngine = new DQRuleEngine();

const DataQualityDashboard: React.FC<DataQualityDashboardProps> = ({
  roleId,
  onNavigateToExceptions,
  onNavigateToReports,
  onNavigateToScorecard,
  onAskQuestion,
}) => {
  const [revalidated, setRevalidated] = useState(false);

  const currentScore = useMemo(() => scoringEngine.getCurrentScore(), [revalidated]);
  const trendData = useMemo(() => scoringEngine.getTrendData(), [revalidated]);
  const trendExplanation = useMemo(() => scoringEngine.getTrendExplanation(), [revalidated]);
  const exceptions = useMemo(() => exceptionService.getOpenExceptions(), [revalidated]);
  const excSummary = useMemo(() => exceptionService.getSummary(), [revalidated]);
  const readiness = getReadinessStatus(
    currentScore.overallScore,
    exceptions.filter(e => e.priority === 'critical').length,
  );
  const previousTrend = trendData.length >= 2 ? trendData[trendData.length - 2] : null;

  const handleRevalidate = () => {
    // Simulate: resolve critical exceptions, re-score
    const criticalRuleIds = exceptions
      .filter(e => e.priority === 'critical')
      .map(e => e.ruleExecution.ruleId);
    ruleEngine.revalidate('Q4 FY2025-26', criticalRuleIds);
    scoringEngine.simulateRevalidation(93.2);
    for (const exc of exceptions.filter(e => e.priority === 'critical')) {
      exceptionService.resolve(exc.exceptionId, 'Resolved via re-validation');
    }
    setRevalidated(true);
  };

  return (
    <div className="wrap fade">
      {/* Page Header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={24} style={{ color: 'var(--accent)' }} />
          Regulatory Data Quality
        </h1>
        <p className="meta">
          Internal sDQI Readiness Assessment · Q4 FY2025-26 · All Regions
        </p>
      </div>

      {/* Hero Banner */}
      <div className="reg-hero" style={{ marginBottom: 20 }}>
        <div className="reg-hero-left">
          <div className="reg-hero-title">Internal DQ Score</div>
          <ScoreGauge score={currentScore.overallScore} />
          <div className="reg-hero-score-label">
            <ScoreChange change={currentScore.changeFromPrevious} />
            {currentScore.changeFromPrevious !== null && (
              <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 6 }}>vs previous quarter</span>
            )}
          </div>
        </div>

        <div className="reg-hero-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="reg-hero-title" style={{ marginBottom: 6 }}>Submission Readiness</div>
              <ReadinessBadge status={readiness} large />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className="kpi-card" style={{ padding: '12px 20px', minWidth: 90, textAlign: 'center' }}>
                <div className="kpi-label">Exceptions</div>
                <div className="kpi-value" style={{ fontSize: 24, color: excSummary.open > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {excSummary.open}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: '12px 20px', minWidth: 90, textAlign: 'center' }}>
                <div className="kpi-label">Critical</div>
                <div className="kpi-value" style={{ fontSize: 24, color: excSummary.critical > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {excSummary.critical}
                </div>
              </div>
              <div className="kpi-card" style={{ padding: '12px 20px', minWidth: 90, textAlign: 'center' }}>
                <div className="kpi-label">Impact</div>
                <div className="kpi-value" style={{ fontSize: 24 }}>
                  ₹{excSummary.totalFinancialImpact.toFixed(1)} Cr
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {!revalidated && (
              <button className="btn btn-primary btn-sm" onClick={handleRevalidate}>
                <RefreshCw size={14} /> Re-validate & Re-score
              </button>
            )}
            {revalidated && (
              <span className="badge badge-ok" style={{ padding: '6px 14px' }}>
                <CheckCircle2 size={14} /> Re-validated — score updated
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onNavigateToExceptions}>
              <AlertTriangle size={14} /> View Exceptions
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onNavigateToReports}>
              <FileText size={14} /> Regulatory Reports
            </button>
          </div>
        </div>
      </div>

      {/* Dimension Cards */}
      <div style={{ marginBottom: 20 }}>
        <div className="reg-section-header">
          <span className="reg-section-title">Quality Dimensions</span>
          <button className="btn btn-quiet btn-sm" onClick={onNavigateToScorecard}>
            Score Breakdown <ArrowRight size={13} />
          </button>
        </div>
        <div className="grid g4">
          {currentScore.dimensions.map(dim => (
            <DimensionCard
              key={dim.dimension}
              dimension={dim}
              previousScore={previousTrend?.[dim.dimension as keyof typeof previousTrend] as number}
            />
          ))}
        </div>
      </div>

      {/* Critical Exceptions */}
      {exceptions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="reg-section-header">
            <span className="reg-section-title">
              <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--danger)' }} />
              Top Data Quality Issues
            </span>
            <span className="meta">{exceptions.length} open exceptions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exceptions.slice(0, 5).map(exc => (
              <ExceptionRow key={exc.exceptionId} exception={exc} />
            ))}
          </div>
          {exceptions.length > 5 && (
            <button className="btn btn-quiet btn-sm" style={{ marginTop: 10 }} onClick={onNavigateToExceptions}>
              View all {exceptions.length} exceptions <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Trend + Regional */}
      <div className="grid g2" style={{ marginBottom: 20 }}>
        {/* Trend Analysis */}
        <div className="card card-p">
          <div className="reg-section-header" style={{ marginBottom: 8 }}>
            <span className="reg-section-title">Score Trend</span>
            <TrendSparkline data={trendData.map(d => d.overallScore)} />
          </div>
          <TrendBarChart data={trendData} />
          <div className="insight-card insight-card-det" style={{ marginTop: 12 }}>
            <div className="insight-label insight-label-det">
              <BarChart3 size={11} /> Deterministic Finding
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
              {trendExplanation}
            </p>
          </div>
        </div>

        {/* Regional Breakdown */}
        <div className="card card-p">
          <div className="reg-section-header" style={{ marginBottom: 8 }}>
            <span className="reg-section-title">Regional Readiness</span>
          </div>
          <div className="tablewrap" style={{ maxHeight: 360 }}>
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th className="n">Score</th>
                  <th className="n">Exceptions</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_REGIONAL_BREAKDOWN
                  .sort((a, b) => a.overallScore - b.overallScore)
                  .map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{r.region}</td>
                    <td className="n" style={{ fontWeight: 600, color: r.overallScore >= 90 ? 'var(--ok)' : r.overallScore >= 75 ? 'var(--warn)' : 'var(--danger)' }}>
                      {r.overallScore.toFixed(1)}
                    </td>
                    <td className="n">{r.exceptionCount}</td>
                    <td>
                      <ReadinessBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Exception by Dimension & Owner */}
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card card-p">
          <div className="reg-section-title" style={{ marginBottom: 12 }}>Exceptions by Dimension</div>
          {(['accuracy', 'completeness', 'consistency', 'timeliness'] as const).map(dim => (
            <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>
                {dim.charAt(0).toUpperCase() + dim.slice(1)}
              </span>
              <div style={{ flex: 2, height: 6, background: 'var(--surface-3)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 'inherit',
                  width: `${(excSummary.byDimension[dim] / Math.max(excSummary.open, 1)) * 100}%`,
                  background: dim === 'accuracy' ? 'var(--c1)' : dim === 'completeness' ? 'var(--c2)' : dim === 'consistency' ? 'var(--c3)' : 'var(--c5)',
                }} />
              </div>
              <span className="num" style={{ fontSize: 13, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>
                {excSummary.byDimension[dim]}
              </span>
            </div>
          ))}
        </div>

        <div className="card card-p">
          <div className="reg-section-title" style={{ marginBottom: 12 }}>Exceptions by Owner</div>
          {excSummary.byOwner.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>{o.owner}</span>
              <div style={{ flex: 2, height: 6, background: 'var(--surface-3)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 'inherit',
                  width: `${(o.count / Math.max(excSummary.open, 1)) * 100}%`,
                  background: 'var(--accent)',
                }} />
              </div>
              <span className="num" style={{ fontSize: 13, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{o.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Positioning Disclaimer */}
      <div className="card" style={{ padding: '12px 20px', background: 'var(--surface-2)', border: '1px dashed var(--hairline-strong)', marginBottom: 20 }}>
        <p className="meta" style={{ margin: 0, lineHeight: 1.5 }}>
          <strong>Note:</strong> This is an <em>Internal Regulatory Data Quality Score</em> for pre-submission readiness assessment.
          It is not an official RBI sDQI score. All weights, thresholds, and scoring parameters are configurable and should be
          aligned with the bank's internal data quality framework.
        </p>
      </div>
    </div>
  );
};

export default DataQualityDashboard;
