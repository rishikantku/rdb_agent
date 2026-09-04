// ============================================================================
// Regulatory Intelligence View — Natural Language Investigation
// ============================================================================
// Extends the existing "Ask Data" pattern for regulatory questions.
// Pre-built queries, deterministic findings clearly labeled vs AI insights.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Brain, Search, TrendingDown, BarChart3, MapPin, AlertTriangle,
  ArrowRight, ChevronRight, Lightbulb, Database, Sparkles,
} from 'lucide-react';
import { ScoreGauge, TrendSparkline, ReadinessBadge, ScoreChange } from './ui-components';
import { ScoringEngine } from '../../backend/regulatory/scoring-engine';
import { ExceptionService } from '../../backend/regulatory/exception-service';
import { ReconciliationEngine } from '../../backend/regulatory/reconciliation-engine';
import { MOCK_TREND_DATA, MOCK_REGIONAL_BREAKDOWN, MOCK_RECONCILIATIONS } from '../../backend/regulatory/mock-data';
import type { RoleId } from '../../lib/permissions';

interface RegulatoryIntelligenceViewProps {
  roleId: RoleId;
}

const scoringEngine = new ScoringEngine();
const exceptionService = new ExceptionService();
const reconEngine = new ReconciliationEngine();

// Pre-built regulatory questions
const PRESET_QUESTIONS = [
  { icon: <TrendingDown size={15} />, question: 'Why did our score decline this quarter?', category: 'trend' },
  { icon: <MapPin size={15} />, question: 'Which regions contribute most to exceptions?', category: 'regional' },
  { icon: <AlertTriangle size={15} />, question: 'Show me the largest reconciliation mismatches', category: 'recon' },
  { icon: <BarChart3 size={15} />, question: 'What is our submission readiness status?', category: 'readiness' },
  { icon: <Database size={15} />, question: 'Which rules failed in the accuracy dimension?', category: 'rules' },
  { icon: <Lightbulb size={15} />, question: 'What should we fix first to improve our score?', category: 'priority' },
];

// Deterministic response generator — NOT AI, uses data-driven templates
function generateResponse(category: string): { type: 'deterministic' | 'ai_insight'; content: React.ReactNode }[] {
  const trend = MOCK_TREND_DATA;
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  const exceptions = exceptionService.getOpenExceptions();
  const criticals = exceptions.filter(e => e.priority === 'critical');
  const regions = MOCK_REGIONAL_BREAKDOWN;
  const recons = MOCK_RECONCILIATIONS;

  switch (category) {
    case 'trend': {
      const diff = latest.overallScore - previous.overallScore;
      const worstDim = (['accuracy', 'completeness', 'consistency', 'timeliness'] as const)
        .map(d => ({ dim: d, diff: latest[d] - previous[d] }))
        .sort((a, b) => a.diff - b.diff)[0];
      return [
        {
          type: 'deterministic',
          content: (
            <div>
              <p>Your overall score declined by <strong>{Math.abs(diff).toFixed(1)} points</strong> from {previous.periodLabel} ({previous.overallScore}) to {latest.periodLabel} ({latest.overallScore}).</p>
              <p>The primary driver is <strong>{worstDim.dim}</strong>, which dropped by <strong>{Math.abs(worstDim.diff).toFixed(1)} points</strong>.</p>
              <p>Key contributing factors:</p>
              <ul>
                <li>CBS-Regulatory advances mismatch of <strong>₹42.6 Cr</strong> across 23 branches (DQ-001)</li>
                <li>NPA classification discrepancy of <strong>₹13.7 Cr</strong> (DQ-003)</li>
                <li>CBS vs MIS consistency gap of <strong>₹15.7 Cr</strong> (DQ-015)</li>
                <li>3 branches with missing data submissions (DQ-010)</li>
              </ul>
              <p>This is a <strong>{trend.filter((_, i) => i > 0 && trend[i].overallScore < trend[i-1].overallScore).length}-quarter consecutive decline</strong>.</p>
            </div>
          ),
        },
        {
          type: 'ai_insight',
          content: (
            <p>
              The pattern suggests a systemic issue with the CBS-to-regulatory data pipeline rather than isolated data errors.
              The 23-branch concentration of advances mismatches, combined with the CBS/MIS timing gap, indicates that the
              end-of-day processing cutoff is not aligned with the data extraction window. Addressing this single pipeline
              issue could resolve both the accuracy and consistency dimension declines simultaneously.
            </p>
          ),
        },
      ];
    }

    case 'regional': {
      const sorted = [...regions].sort((a, b) => b.exceptionCount - a.exceptionCount);
      const top3 = sorted.slice(0, 3);
      return [
        {
          type: 'deterministic',
          content: (
            <div>
              <p>Top 3 regions by exception count:</p>
              <table style={{ width: '100%', marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: 12, color: 'var(--ink-3)', borderBottom: '2px solid var(--hairline)' }}>Region</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 12, color: 'var(--ink-3)', borderBottom: '2px solid var(--hairline)' }}>Score</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 12, color: 'var(--ink-3)', borderBottom: '2px solid var(--hairline)' }}>Exceptions</th>
                    <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 12, color: 'var(--ink-3)', borderBottom: '2px solid var(--hairline)' }}>Critical</th>
                    <th style={{ padding: '6px 12px', fontSize: 12, color: 'var(--ink-3)', borderBottom: '2px solid var(--hairline)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {top3.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--hairline)' }}>{r.region}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--hairline)', color: r.overallScore >= 90 ? 'var(--ok)' : r.overallScore >= 75 ? 'var(--warn)' : 'var(--danger)' }}>{r.overallScore.toFixed(1)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--hairline)' }}>{r.exceptionCount}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--hairline)', color: r.criticalCount > 0 ? 'var(--danger)' : 'var(--ink-3)' }}>{r.criticalCount}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--hairline)' }}>
                        <ReadinessBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p><strong>Northeast Region</strong> has the lowest score (79.3) with 5 exceptions (2 critical), driven by connectivity issues at Imphal and Shillong branches.</p>
            </div>
          ),
        },
      ];
    }

    case 'recon': {
      const mismatches = recons.filter(r => r.status === 'mismatched');
      return [
        {
          type: 'deterministic',
          content: (
            <div>
              <p>Found <strong>{mismatches.length} reconciliation mismatches</strong>:</p>
              {mismatches.map((m, i) => (
                <div key={i} className="card" style={{ padding: '12px 16px', marginBottom: 8, border: '1px solid var(--hairline)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{m.dataElement}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                    {m.sourceSystem}: <strong>₹{(m.sourceValue / 100).toFixed(0)} Cr</strong> vs {m.targetSystem}: <strong>₹{(m.targetValue / 100).toFixed(0)} Cr</strong>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
                    Difference: ₹{(m.differenceAbs / 100).toFixed(1)} Cr ({m.deviationPct.toFixed(3)}%)
                  </div>
                  <div className="meta" style={{ marginTop: 4 }}>{m.affectedBranches.length} affected branches</div>
                </div>
              ))}
            </div>
          ),
        },
      ];
    }

    case 'readiness': {
      const score = latest.overallScore;
      const critCount = criticals.length;
      return [
        {
          type: 'deterministic',
          content: (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <ScoreGauge score={score} size="sm" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {score >= 90 && critCount === 0 ? 'Submission Ready' :
                     score >= 75 ? 'At Risk — Corrections Recommended' :
                     'Not Ready — Critical Issues Must Be Resolved'}
                  </div>
                  <p className="meta" style={{ margin: 0 }}>
                    Score: {score.toFixed(1)}/100 · {critCount} critical exceptions · {exceptions.length} total open exceptions
                  </p>
                </div>
              </div>
              <p>To achieve submission readiness:</p>
              <ol>
                <li>Resolve {critCount} critical exceptions (advances mismatch, branch data gaps, CBS/MIS sync)</li>
                <li>Address {exceptions.filter(e => e.priority === 'high').length} high-severity exceptions</li>
                <li>Re-validate after corrections to confirm score improvement</li>
              </ol>
            </div>
          ),
        },
      ];
    }

    case 'rules': {
      const failedAccuracy = exceptionService.getByDimension('accuracy');
      return [
        {
          type: 'deterministic',
          content: (
            <div>
              <p><strong>{failedAccuracy.length} exceptions</strong> in the Accuracy dimension:</p>
              {failedAccuracy.map((exc, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${exc.priority === 'critical' ? 'badge-danger' : exc.priority === 'high' ? 'badge-warn' : ''}`}>
                      {exc.priority}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{exc.ruleExecution.rule.ruleName}</span>
                  </div>
                  <p className="meta" style={{ marginTop: 4, marginBottom: 0 }}>{exc.ruleExecution.details}</p>
                </div>
              ))}
            </div>
          ),
        },
      ];
    }

    case 'priority': {
      const sorted = [...exceptions].sort((a, b) => {
        const sev = { critical: 0, high: 1, medium: 2, low: 3 };
        if (sev[a.priority] !== sev[b.priority]) return sev[a.priority] - sev[b.priority];
        return (b.financialImpact || 0) - (a.financialImpact || 0);
      });
      const top5 = sorted.slice(0, 5);
      return [
        {
          type: 'deterministic',
          content: (
            <div>
              <p>Priority fix order based on severity and financial impact:</p>
              <ol>
                {top5.map((exc, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <strong>{exc.ruleExecution.rule.ruleName}</strong>
                    {exc.financialImpact && <span className="impact-badge impact-high" style={{ marginLeft: 8 }}>₹{exc.financialImpact} Cr</span>}
                    <div className="meta">{exc.recommendedAction}</div>
                  </li>
                ))}
              </ol>
            </div>
          ),
        },
        {
          type: 'ai_insight',
          content: (
            <p>
              Resolving the top 3 items (CBS-Regulatory advances reconciliation, CBS/MIS sync alignment, and NPA classification
              refresh) would address approximately <strong>₹72 Cr</strong> in data discrepancies and is projected to improve
              the overall score from 87.6 to approximately <strong>93-94</strong>, crossing the 90-point readiness threshold.
              These three fixes share a common root cause in the data pipeline timing, so a single infrastructure change
              could resolve all three simultaneously.
            </p>
          ),
        },
      ];
    }

    default:
      return [{
        type: 'deterministic',
        content: <p>No specific analysis available for this query. Try one of the preset questions below.</p>,
      }];
  }
}

const RegulatoryIntelligenceView: React.FC<RegulatoryIntelligenceViewProps> = ({ roleId }) => {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [responses, setResponses] = useState<{ type: 'deterministic' | 'ai_insight'; content: React.ReactNode }[]>([]);
  const [customQuestion, setCustomQuestion] = useState('');

  const trendData = useMemo(() => scoringEngine.getTrendData(), []);
  const currentScore = useMemo(() => scoringEngine.getCurrentScore(), []);

  const handleAsk = (question: string, category: string) => {
    setSelectedQuestion(question);
    setResponses(generateResponse(category));
  };

  const handleCustomAsk = () => {
    if (!customQuestion.trim()) return;
    // Map custom questions to closest category via keyword matching
    const q = customQuestion.toLowerCase();
    let cat = 'readiness';
    if (q.includes('decline') || q.includes('trend') || q.includes('why')) cat = 'trend';
    else if (q.includes('region') || q.includes('branch') || q.includes('which')) cat = 'regional';
    else if (q.includes('recon') || q.includes('mismatch')) cat = 'recon';
    else if (q.includes('rule') || q.includes('accuracy') || q.includes('fail')) cat = 'rules';
    else if (q.includes('fix') || q.includes('priority') || q.includes('first') || q.includes('improve')) cat = 'priority';
    handleAsk(customQuestion, cat);
    setCustomQuestion('');
  };

  return (
    <div className="wrap fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={24} style={{ color: 'var(--accent)' }} />
          Regulatory Intelligence
        </h1>
        <p className="meta">Investigate regulatory data quality with natural language · Q4 FY2025-26</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <div className="card card-p" style={{ textAlign: 'center' }}>
          <div className="label">Current Score</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>{currentScore.overallScore.toFixed(1)}</div>
          <ScoreChange change={currentScore.changeFromPrevious} />
        </div>
        <div className="card card-p" style={{ textAlign: 'center' }}>
          <div className="label">Trend</div>
          <TrendSparkline data={trendData.map(d => d.overallScore)} width={100} height={32} />
          <div className="meta" style={{ marginTop: 4 }}>4-quarter view</div>
        </div>
        <div className="card card-p" style={{ textAlign: 'center' }}>
          <div className="label">Open Exceptions</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warn)' }}>{exceptionService.getOpenExceptions().length}</div>
        </div>
        <div className="card card-p" style={{ textAlign: 'center' }}>
          <div className="label">Financial Impact</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>₹{exceptionService.getSummary().totalFinancialImpact.toFixed(1)} Cr</div>
        </div>
      </div>

      {/* Search Input */}
      <div className="card card-p" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }} />
            <input
              type="text"
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomAsk()}
              placeholder="Ask about regulatory data quality..."
              style={{
                width: '100%', padding: '12px 12px 12px 40px',
                borderRadius: 'var(--r-md)', border: '1px solid var(--hairline)',
                background: 'var(--surface-2)', fontSize: 14, color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCustomAsk}>
            <ArrowRight size={16} /> Ask
          </button>
        </div>
      </div>

      {/* Preset Questions */}
      <div className="reg-section-title" style={{ marginBottom: 12 }}>Suggested Questions</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 24 }}>
        {PRESET_QUESTIONS.map((pq, i) => (
          <button
            key={i}
            className="reg-question-chip"
            onClick={() => handleAsk(pq.question, pq.category)}
          >
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{pq.icon}</span>
            {pq.question}
          </button>
        ))}
      </div>

      {/* Response Area */}
      {selectedQuestion && (
        <div className="fade">
          <div className="card card-p" style={{ marginBottom: 12, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>
              Question
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{selectedQuestion}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {responses.map((r, i) => (
              <div key={i} className={`insight-card ${r.type === 'ai_insight' ? 'insight-card-ai' : 'insight-card-det'}`}>
                <div className={`insight-label ${r.type === 'ai_insight' ? 'insight-label-ai' : 'insight-label-det'}`}>
                  {r.type === 'ai_insight' ? (
                    <><Sparkles size={11} /> AI Insight</>
                  ) : (
                    <><Database size={11} /> Deterministic Finding</>
                  )}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  {r.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedQuestion && (
        <div className="empty" style={{ marginTop: 40 }}>
          <Brain size={48} style={{ color: 'var(--ink-4)' }} />
          <h3>Ask a Question</h3>
          <p className="meta">
            Select a suggested question above or type your own to investigate regulatory data quality issues.
          </p>
          <p className="meta" style={{ marginTop: 8, fontSize: 11.5 }}>
            Deterministic findings are derived from rule engine data. AI insights are supplemental explanations.
          </p>
        </div>
      )}
    </div>
  );
};

export default RegulatoryIntelligenceView;
