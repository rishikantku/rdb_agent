import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Play, X,
  Filter, Activity, Lock, HelpCircle, AlertTriangle, Layers,
} from 'lucide-react';
import { runGuardrailEvaluation } from '../lib/guardrail/evaluator';
import type { GuardrailEvaluationSummary, GuardrailCategory } from '../lib/guardrail/types';

interface GuardrailTestModalProps {
  open: boolean;
  onClose: () => void;
  onTryQuestion?: (q: string) => void;
}

const GuardrailTestModal: React.FC<GuardrailTestModalProps> = ({ open, onClose, onTryQuestion }) => {
  const [summary, setSummary] = useState<GuardrailEvaluationSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    if (open) {
      runSuite();
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const runSuite = () => {
    setRunning(true);
    setTimeout(() => {
      const res = runGuardrailEvaluation();
      setSummary(res);
      setRunning(false);
    }, 150);
  };

  if (!open) return null;

  const filteredResults = summary?.results.filter((r) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'in_scope') return r.testCase.expectedClassification === 'IN_SCOPE';
    if (activeTab === 'out_of_scope') return r.testCase.expectedClassification === 'OUT_OF_SCOPE';
    if (activeTab === 'security') return r.testCase.expectedClassification === 'SECURITY_SENSITIVE';
    if (activeTab === 'ambiguous') return r.testCase.expectedClassification === 'AMBIGUOUS';
    if (activeTab === 'unsupported') return r.testCase.expectedClassification === 'UNSUPPORTED';
    return true;
  }) || [];

  const getBadgeClass = (cat: GuardrailCategory) => {
    switch (cat) {
      case 'IN_SCOPE':
        return 'badge-ok';
      case 'OUT_OF_SCOPE':
        return 'badge-warn';
      case 'SECURITY_SENSITIVE':
        return 'badge-danger';
      case 'AMBIGUOUS':
        return 'badge-accent';
      case 'UNSUPPORTED':
        return 'badge-warn';
      default:
        return '';
    }
  };

  return (
    <div className="overlay modal-center" onClick={onClose}>
      <div
        className="modal-box fade"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(980px, 96vw)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--r-md)',
                background: 'var(--accent-weak)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>AI Guardrail & Query Scope Evaluation</h3>
                <span className="badge badge-ok" style={{ fontSize: 11 }}>
                  Fail-Closed Policy Active
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>
                Deterministic classification preventing out-of-scope, malicious, or unconfigured requests from reaching SQL generation
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={runSuite} disabled={running}>
              <Play size={13} /> {running ? 'Evaluating…' : 'Re-run 25 Tests'}
            </button>
            <button className="btn btn-quiet btn-icon" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary KPIs */}
          {summary && (
            <div className="grid g6" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              <div className="kpi-card" style={{ padding: '12px 14px' }}>
                <div className="kpi-label">Total Tests</div>
                <div className="kpi-value" style={{ fontSize: 22 }}>
                  {summary.total}
                </div>
                <div className="kpi-sub" style={{ fontSize: 11 }}>Standard suite</div>
              </div>

              <div className="kpi-card" style={{ padding: '12px 14px' }}>
                <div className="kpi-label" style={{ color: 'var(--ok)' }}>In Scope</div>
                <div className="kpi-value" style={{ fontSize: 22, color: 'var(--ok)' }}>
                  {summary.breakdown.inScope.passed}/{summary.breakdown.inScope.total}
                </div>
                <div className="kpi-sub" style={{ fontSize: 11 }}>Banking analytics</div>
              </div>

              <div className="kpi-card" style={{ padding: '12px 14px' }}>
                <div className="kpi-label" style={{ color: 'var(--warn)' }}>Out of Scope</div>
                <div className="kpi-value" style={{ fontSize: 22, color: 'var(--warn)' }}>
                  {summary.breakdown.outOfScope.passed}/{summary.breakdown.outOfScope.total}
                </div>
                <div className="kpi-sub" style={{ fontSize: 11 }}>Refused safely</div>
              </div>

              <div className="kpi-card" style={{ padding: '12px 14px' }}>
                <div className="kpi-label" style={{ color: 'var(--danger)' }}>Security</div>
                <div className="kpi-value" style={{ fontSize: 22, color: 'var(--danger)' }}>
                  {summary.breakdown.security.passed}/{summary.breakdown.security.total}
                </div>
                <div className="kpi-sub" style={{ fontSize: 11 }}>Injection/secrets</div>
              </div>

              <div className="kpi-card" style={{ padding: '12px 14px' }}>
                <div className="kpi-label" style={{ color: 'var(--accent)' }}>Ambiguous</div>
                <div className="kpi-value" style={{ fontSize: 22, color: 'var(--accent)' }}>
                  {summary.breakdown.ambiguous.passed}/{summary.breakdown.ambiguous.total}
                </div>
                <div className="kpi-sub" style={{ fontSize: 11 }}>Clarification</div>
              </div>

              <div className="kpi-card" style={{ padding: '12px 14px' }}>
                <div className="kpi-label" style={{ color: 'var(--ink-3)' }}>Unsupported</div>
                <div className="kpi-value" style={{ fontSize: 22, color: 'var(--ink-2)' }}>
                  {summary.breakdown.unsupported.passed}/{summary.breakdown.unsupported.total}
                </div>
                <div className="kpi-sub" style={{ fontSize: 11 }}>Zero hallucination</div>
              </div>
            </div>
          )}

          {/* Pass/Fail Status Banner */}
          {summary && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: 'var(--r-md)',
                background: summary.failed === 0 ? 'var(--ok-weak)' : 'var(--danger-weak)',
                border: `1px solid ${summary.failed === 0 ? 'rgba(14,122,85,0.2)' : 'rgba(179,38,30,0.2)'}`,
                color: summary.failed === 0 ? 'var(--ok)' : 'var(--danger)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {summary.failed === 0 ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                <span>
                  {summary.failed === 0
                    ? 'All 25 Governance Test Cases Passed — Zero Out-of-Scope Leakage'
                    : `${summary.failed} Test Case(s) Failed Validation`}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>
                Pass Rate: {Math.round((summary.passed / summary.total) * 100)}%
              </span>
            </div>
          )}

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--hairline)', paddingBottom: 10 }}>
            <button
              className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('all')}
            >
              All Tests ({summary?.total ?? 25})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'in_scope' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('in_scope')}
            >
              In Scope ({summary?.breakdown.inScope.total ?? 10})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'out_of_scope' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('out_of_scope')}
            >
              Out of Scope ({summary?.breakdown.outOfScope.total ?? 8})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'security' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('security')}
            >
              Security Sensitive ({summary?.breakdown.security.total ?? 4})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'ambiguous' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('ambiguous')}
            >
              Ambiguous ({summary?.breakdown.ambiguous.total ?? 2})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'unsupported' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('unsupported')}
            >
              Unsupported ({summary?.breakdown.unsupported.total ?? 1})
            </button>
          </div>

          {/* Test Case Table / List */}
          <div className="tablewrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Test ID</th>
                  <th style={{ width: '80px' }}>Status</th>
                  <th>Question</th>
                  <th style={{ width: '150px' }}>Expected</th>
                  <th style={{ width: '150px' }}>Actual Result</th>
                  <th className="n" style={{ width: '70px' }}>Latency</th>
                  <th style={{ width: '70px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item) => (
                  <tr key={item.testCase.id}>
                    <td className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>
                      {item.testCase.id}
                    </td>
                    <td>
                      {item.passed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ok)', fontSize: 12, fontWeight: 600 }}>
                          <CheckCircle2 size={13} /> Pass
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                          <XCircle size={13} /> Fail
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>
                        {item.testCase.question}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                        {item.testCase.description}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getBadgeClass(item.testCase.expectedClassification)}`}>
                        {item.testCase.expectedClassification}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getBadgeClass(item.actualClassification)}`}>
                        {item.actualClassification}
                      </span>
                    </td>
                    <td className="n mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {item.latencyMs}ms
                    </td>
                    <td>
                      {onTryQuestion && (
                        <button
                          className="btn btn-quiet btn-sm"
                          style={{ padding: '3px 8px', fontSize: 11.5 }}
                          onClick={() => {
                            onTryQuestion(item.testCase.question);
                            onClose();
                          }}
                          title="Try this question in Ask Data"
                        >
                          Try
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-4)', paddingTop: 4 }}>
            <span>Policy: Questions classified as OUT_OF_SCOPE, SECURITY_SENSITIVE, or UNSUPPORTED are rejected with 0 database queries.</span>
            <span className="mono">Deterministic Evaluation Layer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardrailTestModal;
