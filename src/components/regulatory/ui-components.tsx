// ============================================================================
// Regulatory UI Components — Reusable Primitives
// ============================================================================

import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { DQDimension, ReadinessStatus, WorkflowState, Severity, TrendDataPoint, DimensionScore } from '../../backend/regulatory/types';
import { READINESS_LABELS, WORKFLOW_STEPS, WORKFLOW_LABELS, DQ_DIMENSION_LABELS } from '../../backend/regulatory/types';

// ---------------------------------------------------------------------------
// Score Gauge — Animated radial progress (0-100)
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--ok)';
  if (score >= 75) return 'var(--warn)';
  return 'var(--danger)';
}

export const ScoreGauge: React.FC<{
  score: number; label?: string; sub?: string; size?: 'default' | 'sm';
}> = ({ score, label = '/100', sub, size = 'default' }) => {
  const r = size === 'sm' ? 42 : 76;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(score, 100) / 100);
  const viewBox = size === 'sm' ? 100 : 180;
  const cx = viewBox / 2;

  return (
    <div className={`score-gauge ${size === 'sm' ? 'score-gauge-sm' : ''}`}>
      <svg viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <circle className="score-gauge-bg" cx={cx} cy={cx} r={r} />
        <circle
          className="score-gauge-fill"
          cx={cx} cy={cx} r={r}
          stroke={getScoreColor(score)}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div className="score-gauge-value">{score.toFixed(1)}</div>
        <div className="score-gauge-label">{label}</div>
        {sub && <div className="score-gauge-sub">{sub}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dimension Card
// ---------------------------------------------------------------------------

const DIM_COLORS: Record<DQDimension, string> = {
  accuracy: 'var(--c1)',
  completeness: 'var(--c2)',
  consistency: 'var(--c3)',
  timeliness: 'var(--c5)',
};

export const DimensionCard: React.FC<{
  dimension: DimensionScore;
  previousScore?: number;
}> = ({ dimension, previousScore }) => {
  const diff = previousScore !== undefined ? dimension.score - previousScore : null;
  return (
    <div className="dim-card" data-dim={dimension.dimension}>
      <div className="dim-card-title">{DQ_DIMENSION_LABELS[dimension.dimension]}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="dim-card-score">{dimension.score.toFixed(1)}</div>
        {diff !== null && (
          <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, color: diff >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
            {diff >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
          </span>
        )}
      </div>
      <div className="dim-card-detail">
        <div className="dim-card-bar">
          <div className="dim-card-bar-fill" data-dim={dimension.dimension} style={{ width: `${dimension.score}%` }} />
        </div>
        <span className="num">{dimension.passedRules}/{dimension.totalRules} rules</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 4 }}>
        Weight: {(dimension.weight * 100).toFixed(0)}% · Weighted: {dimension.weightedScore.toFixed(1)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Readiness Status Badge
// ---------------------------------------------------------------------------

export const ReadinessBadge: React.FC<{
  status: ReadinessStatus; large?: boolean;
}> = ({ status, large }) => (
  <span className={`readiness-badge ${large ? 'readiness-badge-lg' : ''}`} data-status={status}>
    <span className={`dot ${status === 'ready' ? 'dot-live' : ''}`}
      style={{ color: status === 'ready' ? 'var(--ok)' : status === 'at_risk' ? 'var(--warn)' : 'var(--danger)' }}
    />
    {READINESS_LABELS[status]}
  </span>
);

// ---------------------------------------------------------------------------
// Workflow Pipeline
// ---------------------------------------------------------------------------

export const WorkflowPipeline: React.FC<{
  currentState: WorkflowState;
}> = ({ currentState }) => {
  const currentIdx = WORKFLOW_STEPS.indexOf(currentState);
  return (
    <div className="wf-pipeline">
      {WORKFLOW_STEPS.map((step, i) => {
        const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
        return (
          <React.Fragment key={step}>
            {i > 0 && <span className="wf-arrow">→</span>}
            <span className={`wf-step ${cls}`}>
              <span className="wf-dot" />
              {WORKFLOW_LABELS[step]}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Exception Row (expandable)
// ---------------------------------------------------------------------------

export const ExceptionRow: React.FC<{
  exception: any; // DQException
  onResolve?: (id: string) => void;
}> = ({ exception, onResolve }) => {
  const [open, setOpen] = useState(false);
  const e = exception;

  return (
    <div className="exc-card" data-severity={e.priority}>
      <div className="exc-card-header" onClick={() => setOpen(!open)}>
        <span className="exc-severity-dot" data-severity={e.priority} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {e.ruleExecution.rule.ruleName}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {e.ruleExecution.rule.exceptionMessage}
          </div>
        </div>
        <span className={`badge badge-${e.priority === 'critical' ? 'danger' : e.priority === 'high' ? 'warn' : 'accent'}`}>
          {e.priority.toUpperCase()}
        </span>
        <span className="badge">{e.status.replace('_', ' ')}</span>
        {e.financialImpact !== null && (
          <span className={`impact-badge ${e.financialImpact > 10 ? 'impact-high' : e.financialImpact > 3 ? 'impact-medium' : 'impact-low'}`}>
            ₹{e.financialImpact} Cr
          </span>
        )}
        <span style={{ color: 'var(--ink-4)', display: 'flex' }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>
      {open && (
        <div className="exc-card-body fade">
          <div className="root-cause-panel" style={{ marginTop: 12 }}>
            <div className="root-cause-chain">
              <RootCauseItem label="Exception" value={e.ruleExecution.rule.exceptionMessage} />
              <RootCauseItem label="Affected Report" value={e.affectedReport} />
              <RootCauseItem label="Data Element" value={e.affectedDataElement} />
              <RootCauseItem label="Source System" value={e.sourceSystem} />
              {e.affectedBranches.length > 0 && (
                <RootCauseItem label="Affected Branches" value={e.affectedBranches.join(', ')} />
              )}
              <RootCauseItem label="Affected Records" value={`${e.affectedRecordCount.toLocaleString('en-IN')} records`} />
              {e.ruleExecution.details && (
                <RootCauseItem label="Details" value={e.ruleExecution.details} />
              )}
              <RootCauseItem label="Root Cause" value={e.rootCause} />
              <RootCauseItem label="Recommended Action" value={e.recommendedAction} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span className="badge" style={{ fontSize: 11 }}>
              Owner: {e.ownerTeam}
            </span>
            <span className="badge" style={{ fontSize: 11 }}>
              Assigned: {e.assignedTo}
            </span>
            <span className="badge" style={{ fontSize: 11 }}>
              Dimension: {DQ_DIMENSION_LABELS[e.ruleExecution.rule.dimension]}
            </span>
          </div>
          {onResolve && e.status !== 'resolved' && e.status !== 'closed' && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => onResolve(e.exceptionId)}>
                <CheckCircle2 size={14} /> Mark as Resolved
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RootCauseItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="root-cause-item">
    <span className="root-cause-label">{label}</span>
    <span className="root-cause-value">{value}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Trend Sparkline (inline SVG)
// ---------------------------------------------------------------------------

export const TrendSparkline: React.FC<{
  data: number[]; width?: number; height?: number;
}> = ({ data, width = 80, height = 24 }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  });
  const last = points[points.length - 1].split(',').map(Number);

  return (
    <svg className="trend-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline className="spark-line" points={points.join(' ')} />
      <circle cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Trend Bar Chart
// ---------------------------------------------------------------------------

export const TrendBarChart: React.FC<{
  data: TrendDataPoint[];
}> = ({ data }) => {
  const maxScore = 100;
  return (
    <div className="trend-chart">
      <div className="trend-chart-bars">
        {data.map((d, i) => {
          const h = (d.overallScore / maxScore) * 100;
          const color = d.overallScore >= 90 ? 'var(--ok)' : d.overallScore >= 75 ? 'var(--warn)' : 'var(--danger)';
          return (
            <div key={i} className="trend-bar-group">
              <div className="trend-bar" style={{ height: `${h}%`, background: color }}>
                <div className="trend-bar-value">{d.overallScore.toFixed(1)}</div>
              </div>
              <div className="trend-bar-label">{d.periodLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Score Breakdown Table (Auditability)
// ---------------------------------------------------------------------------

export const ScoreBreakdownTable: React.FC<{
  dimensions: DimensionScore[];
  overallScore: number;
}> = ({ dimensions, overallScore }) => (
  <div className="tablewrap">
    <table className="score-breakdown">
      <thead>
        <tr>
          <th>Dimension</th>
          <th className="n">Score</th>
          <th className="n">Weight</th>
          <th className="n">Weighted</th>
          <th className="n">Rules</th>
          <th className="n">Passed</th>
          <th className="n">Failed</th>
        </tr>
      </thead>
      <tbody>
        {dimensions.map(d => (
          <tr key={d.dimension}>
            <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{DQ_DIMENSION_LABELS[d.dimension]}</td>
            <td className="n">{d.score.toFixed(1)}</td>
            <td className="n">{(d.weight * 100).toFixed(0)}%</td>
            <td className="n">{d.weightedScore.toFixed(1)}</td>
            <td className="n">{d.totalRules}</td>
            <td className="n" style={{ color: 'var(--ok)' }}>{d.passedRules}</td>
            <td className="n" style={{ color: d.failedRules > 0 ? 'var(--danger)' : 'var(--ink-3)' }}>{d.failedRules}</td>
          </tr>
        ))}
        <tr className="score-total">
          <td>Overall Score</td>
          <td className="n">{overallScore.toFixed(1)}</td>
          <td className="n">100%</td>
          <td className="n">{overallScore.toFixed(1)}</td>
          <td className="n">{dimensions.reduce((s, d) => s + d.totalRules, 0)}</td>
          <td className="n">{dimensions.reduce((s, d) => s + d.passedRules, 0)}</td>
          <td className="n">{dimensions.reduce((s, d) => s + d.failedRules, 0)}</td>
        </tr>
      </tbody>
    </table>
  </div>
);

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

export const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  const cls = severity === 'critical' ? 'badge-danger' : severity === 'high' ? 'badge-warn' : severity === 'medium' ? 'badge-accent' : '';
  return <span className={`badge ${cls}`}>{severity.toUpperCase()}</span>;
};

// ---------------------------------------------------------------------------
// Score Change Indicator
// ---------------------------------------------------------------------------

export const ScoreChange: React.FC<{ change: number | null }> = ({ change }) => {
  if (change === null) return <span className="meta">—</span>;
  const icon = change > 0 ? <TrendingUp size={14} /> : change < 0 ? <TrendingDown size={14} /> : <Minus size={14} />;
  const color = change > 0 ? 'var(--ok)' : change < 0 ? 'var(--danger)' : 'var(--ink-3)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color }}>
      {icon} {change > 0 ? '+' : ''}{change.toFixed(1)}
    </span>
  );
};
