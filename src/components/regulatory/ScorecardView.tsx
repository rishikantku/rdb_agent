// ============================================================================
// Scorecard View — Score Breakdown & Auditability
// ============================================================================

import React, { useMemo } from 'react';
import { Shield, Settings, Clock, User, Hash, FileText } from 'lucide-react';
import { ScoreGauge, ScoreBreakdownTable, DimensionCard, TrendBarChart, ScoreChange } from './ui-components';
import { ScoringEngine } from '../../backend/regulatory/scoring-engine';
import { DQRuleEngine } from '../../backend/regulatory/dq-rule-engine';
import { AuditService } from '../../backend/regulatory/audit-service';
import { DQ_DIMENSION_LABELS } from '../../backend/regulatory/types';
import type { RoleId } from '../../lib/permissions';

interface ScorecardViewProps {
  roleId: RoleId;
}

const scoringEngine = new ScoringEngine();
const ruleEngine = new DQRuleEngine();
const auditService = new AuditService();

const ScorecardView: React.FC<ScorecardViewProps> = ({ roleId }) => {
  const currentScore = useMemo(() => scoringEngine.getCurrentScore(), []);
  const config = useMemo(() => scoringEngine.getActiveConfig(), []);
  const trendData = useMemo(() => scoringEngine.getTrendData(), []);
  const executions = useMemo(() => ruleEngine.getExecutions('Q4 FY2025-26'), []);
  const execSummary = useMemo(() => ruleEngine.getExecutionSummary('Q4 FY2025-26'), []);
  const auditEvents = useMemo(() => auditService.getByPeriod('Q4 FY2025-26'), []);

  return (
    <div className="wrap fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={24} style={{ color: 'var(--accent)' }} />
          Regulatory Data Quality Scorecard
        </h1>
        <p className="meta">
          Complete scoring breakdown and audit trail · Q4 FY2025-26
        </p>
      </div>

      {/* Score + Change */}
      <div className="card card-p" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <ScoreGauge score={currentScore.overallScore} />
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 8 }}>Internal Regulatory Data Quality Score</h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <ScoreChange change={currentScore.changeFromPrevious} />
              <span className="meta">vs previous quarter ({currentScore.previousScore?.toFixed(1) || '—'})</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge"><Clock size={11} /> Calculated: {new Date(currentScore.calculatedAt).toLocaleString('en-IN')}</span>
              <span className="badge"><User size={11} /> By: {currentScore.calculatedBy}</span>
              <span className="badge"><Settings size={11} /> Config: v{config.version}</span>
              <span className="badge"><Hash size={11} /> Rules: {execSummary.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown Table */}
      <div style={{ marginBottom: 20 }}>
        <div className="reg-section-title" style={{ marginBottom: 12 }}>Score Calculation Breakdown</div>
        <ScoreBreakdownTable dimensions={currentScore.dimensions} overallScore={currentScore.overallScore} />
        <div className="card" style={{ padding: '12px 20px', background: 'var(--surface-2)', border: '1px dashed var(--hairline-strong)', marginTop: 8 }}>
          <p className="meta" style={{ margin: 0, lineHeight: 1.5 }}>
            <strong>Why this score?</strong> The score is calculated as the weighted average of four dimension scores.
            Each dimension score is the percentage of rules passed, weighted by rule severity (critical=3×, high=2×, medium=1×, low=0.5×).
            Dimension weights are: Accuracy ({(config.dimensionWeights[0].weight * 100).toFixed(0)}%), Completeness ({(config.dimensionWeights[1].weight * 100).toFixed(0)}%), Consistency ({(config.dimensionWeights[2].weight * 100).toFixed(0)}%), Timeliness ({(config.dimensionWeights[3].weight * 100).toFixed(0)}%).
          </p>
        </div>
      </div>

      {/* Dimension Cards */}
      <div style={{ marginBottom: 20 }}>
        <div className="reg-section-title" style={{ marginBottom: 12 }}>Dimension Detail</div>
        <div className="grid g4">
          {currentScore.dimensions.map(dim => {
            const prevData = trendData.length >= 2 ? trendData[trendData.length - 2] : null;
            return (
              <DimensionCard
                key={dim.dimension}
                dimension={dim}
                previousScore={prevData ? (prevData as any)[dim.dimension] : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Trend */}
      <div className="card card-p" style={{ marginBottom: 20 }}>
        <div className="reg-section-title" style={{ marginBottom: 12 }}>Historical Trend</div>
        <TrendBarChart data={trendData} />
        <div className="tablewrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th className="n">Overall</th>
                <th className="n">Accuracy</th>
                <th className="n">Completeness</th>
                <th className="n">Consistency</th>
                <th className="n">Timeliness</th>
                <th className="n">Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {trendData.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.period}</td>
                  <td className="n" style={{ fontWeight: 600 }}>{t.overallScore.toFixed(1)}</td>
                  <td className="n">{t.accuracy.toFixed(1)}</td>
                  <td className="n">{t.completeness.toFixed(1)}</td>
                  <td className="n">{t.consistency.toFixed(1)}</td>
                  <td className="n">{t.timeliness.toFixed(1)}</td>
                  <td className="n">{t.exceptionCount} ({t.criticalExceptionCount} critical)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoring Config */}
      <div className="card card-p" style={{ marginBottom: 20 }}>
        <div className="reg-section-title" style={{ marginBottom: 12 }}>
          <Settings size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Scoring Configuration
        </div>
        <div className="grid g2">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Configuration Name</div>
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{config.configName}</div>
            <p className="meta" style={{ marginTop: 4 }}>{config.description}</p>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Parameters</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="meta">Version: <strong>v{config.version}</strong></span>
              <span className="meta">Effective From: <strong>{config.effectiveFrom}</strong></span>
              <span className="meta">Created By: <strong>{config.createdBy}</strong></span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="label" style={{ marginBottom: 8 }}>Dimension Weights</div>
          <div className="grid g4">
            {config.dimensionWeights.map(dw => (
              <div key={dw.dimension} className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
                <div className="label" style={{ marginBottom: 4 }}>{DQ_DIMENSION_LABELS[dw.dimension]}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{(dw.weight * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rule Execution Summary */}
      <div className="card card-p" style={{ marginBottom: 20 }}>
        <div className="reg-section-title" style={{ marginBottom: 12 }}>Rule Execution Summary</div>
        <div className="grid g5" style={{ marginBottom: 16 }}>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Total Rules</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{execSummary.total}</div>
          </div>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Passed</div>
            <div className="kpi-value" style={{ fontSize: 24, color: 'var(--ok)' }}>{execSummary.passed}</div>
          </div>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Failed</div>
            <div className="kpi-value" style={{ fontSize: 24, color: 'var(--danger)' }}>{execSummary.failed}</div>
          </div>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Skipped</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{execSummary.skipped}</div>
          </div>
          <div className="kpi-card" style={{ textAlign: 'center' }}>
            <div className="kpi-label">Pass Rate</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{execSummary.total > 0 ? ((execSummary.passed / execSummary.total) * 100).toFixed(0) : 0}%</div>
          </div>
        </div>

        {/* Per-rule detail */}
        <div className="tablewrap" style={{ maxHeight: 400 }}>
          <table>
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Rule Name</th>
                <th>Dimension</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {executions.map(exec => (
                <tr key={exec.executionId}>
                  <td className="mono" style={{ fontSize: 12 }}>{exec.ruleId}</td>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{exec.rule.ruleName}</td>
                  <td><span className="badge badge-accent">{DQ_DIMENSION_LABELS[exec.rule.dimension]}</span></td>
                  <td>
                    <span className={`badge ${exec.rule.severity === 'critical' ? 'badge-danger' : exec.rule.severity === 'high' ? 'badge-warn' : ''}`}>
                      {exec.rule.severity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${exec.status === 'passed' ? 'badge-ok' : exec.status === 'failed' ? 'badge-danger' : ''}`}>
                      {exec.status === 'passed' ? '✓ Passed' : exec.status === 'failed' ? '✗ Failed' : exec.status}
                    </span>
                  </td>
                  <td className="meta" style={{ maxWidth: 300, whiteSpace: 'normal' }}>{exec.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="card card-p" style={{ marginBottom: 20 }}>
        <div className="reg-section-title" style={{ marginBottom: 12 }}>
          <FileText size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Audit Trail
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Type</th>
                <th>Timestamp</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map(ae => (
                <tr key={ae.eventId}>
                  <td className="mono" style={{ fontSize: 12 }}>{ae.eventId}</td>
                  <td><span className="badge">{ae.eventType.replace(/_/g, ' ')}</span></td>
                  <td className="meta">{new Date(ae.timestamp).toLocaleString('en-IN')}</td>
                  <td>{ae.userId}</td>
                  <td className="meta" style={{ maxWidth: 300, whiteSpace: 'normal' }}>
                    {JSON.stringify(ae.details).slice(0, 120)}
                    {JSON.stringify(ae.details).length > 120 ? '…' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScorecardView;
