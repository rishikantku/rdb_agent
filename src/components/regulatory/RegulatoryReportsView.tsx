// ============================================================================
// Regulatory Reports View — Report Generation & Maker-Checker Workflow
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  FileText, Play, CheckCircle2, Clock, Download,
  ArrowRight, Eye, ChevronRight, Shield,
} from 'lucide-react';
import { WorkflowPipeline, ReadinessBadge, ScoreGauge } from './ui-components';
import { RegulatoryReportService } from '../../backend/regulatory/regulatory-report-service';
import { WORKFLOW_LABELS } from '../../backend/regulatory/types';
import type { RegulatoryReport, WorkflowState } from '../../backend/regulatory/types';
import { getReadinessStatus } from '../../backend/regulatory/types';
import type { RoleId } from '../../lib/permissions';

interface RegulatoryReportsViewProps {
  roleId: RoleId;
}

const reportService = new RegulatoryReportService();

const RegulatoryReportsView: React.FC<RegulatoryReportsViewProps> = ({ roleId }) => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const definitions = useMemo(() => reportService.getAllDefinitions(), []);
  const instances = useMemo(() => reportService.getAllInstances(), [refreshKey]);
  const workflowSummary = useMemo(() => reportService.getWorkflowSummary('Q4 FY2025-26'), [refreshKey]);

  const selected = selectedReport ? instances.find(i => i.instanceId === selectedReport) : null;

  const handleTransition = (instanceId: string, toState: WorkflowState) => {
    reportService.transitionState(instanceId, toState, roleId, `Transitioned by ${roleId}`);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="wrap fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={24} style={{ color: 'var(--accent)' }} />
          Regulatory Reports
        </h1>
        <p className="meta">Generate, validate, and submit regulatory returns · Q4 FY2025-26</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Reports</div>
          <div className="kpi-value" style={{ fontSize: 28 }}>{workflowSummary.total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Submission Ready</div>
          <div className="kpi-value" style={{ fontSize: 28, color: 'var(--ok)' }}>{workflowSummary.submissionReady}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">In Progress</div>
          <div className="kpi-value" style={{ fontSize: 28, color: 'var(--warn)' }}>{workflowSummary.inProgress}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Blocked</div>
          <div className="kpi-value" style={{ fontSize: 28, color: workflowSummary.blocked > 0 ? 'var(--danger)' : 'var(--ok)' }}>{workflowSummary.blocked}</div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="reg-section-title" style={{ marginBottom: 12 }}>Report Instances</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {instances.map(inst => {
          const isSelected = selectedReport === inst.instanceId;
          const readiness = getReadinessStatus(inst.dqScore || 0, inst.criticalExceptionCount);
          return (
            <div key={inst.instanceId}>
              <div
                className="report-card card-hover"
                onClick={() => setSelectedReport(isSelected ? null : inst.instanceId)}
                style={{ cursor: 'pointer' }}
              >
                <div className="report-card-header">
                  <div>
                    <div className="report-card-title">{inst.definition.reportName}</div>
                    <div className="report-card-code">{inst.definition.reportCode} · {inst.reportingPeriod}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ReadinessBadge status={readiness} />
                    <span style={{ color: 'var(--ink-4)' }}>
                      {isSelected ? <ChevronRight size={16} style={{ transform: 'rotate(90deg)', transition: 'transform .2s' }} /> : <ChevronRight size={16} />}
                    </span>
                  </div>
                </div>

                <div className="report-card-meta">
                  <span>
                    <span className="badge">{WORKFLOW_LABELS[inst.workflowState]}</span>
                  </span>
                  <span>DQ Score: <strong style={{ color: 'var(--ink)' }}>{inst.dqScore?.toFixed(1) || '—'}</strong></span>
                  <span>Exceptions: <strong>{inst.exceptionCount}</strong></span>
                  <span>Version: <strong>v{inst.version}</strong></span>
                  {inst.maker && <span>Maker: <strong>{inst.maker}</strong></span>}
                  {inst.checker && <span>Checker: <strong>{inst.checker}</strong></span>}
                </div>

                <WorkflowPipeline currentState={inst.workflowState} />
              </div>

              {/* Expanded Detail */}
              {isSelected && (
                <div className="card" style={{ padding: 20, marginTop: 4, borderTop: '2px solid var(--accent)' }}>
                  <div className="fade">
                    <h3 style={{ marginBottom: 12 }}>{inst.definition.reportName} — Details</h3>

                    <div className="grid g3" style={{ marginBottom: 16 }}>
                      <div>
                        <div className="label" style={{ marginBottom: 4 }}>Authority</div>
                        <div style={{ fontWeight: 600 }}>{inst.definition.authority}</div>
                      </div>
                      <div>
                        <div className="label" style={{ marginBottom: 4 }}>Frequency</div>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{inst.definition.frequency}</div>
                      </div>
                      <div>
                        <div className="label" style={{ marginBottom: 4 }}>Entity</div>
                        <div style={{ fontWeight: 600 }}>{inst.entity}</div>
                      </div>
                    </div>

                    <div className="label" style={{ marginBottom: 6 }}>Data Elements</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                      {inst.definition.dataElements.map(de => (
                        <span key={de} className="badge">{de}</span>
                      ))}
                    </div>

                    <div className="label" style={{ marginBottom: 6 }}>Workflow History</div>
                    <div className="tablewrap" style={{ marginBottom: 16 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>From</th>
                            <th>To</th>
                            <th>Action By</th>
                            <th>Time</th>
                            <th>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inst.history.map((h, i) => (
                            <tr key={i}>
                              <td>{WORKFLOW_LABELS[h.fromState]}</td>
                              <td style={{ fontWeight: 600 }}>{WORKFLOW_LABELS[h.toState]}</td>
                              <td>{h.actionBy}</td>
                              <td className="meta">{new Date(h.actionAt).toLocaleDateString('en-IN')}</td>
                              <td className="meta">{h.comments}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Workflow Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {inst.workflowState === 'ready_for_review' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleTransition(inst.instanceId, 'maker_submitted')}>
                          <Shield size={14} /> Submit as Maker
                        </button>
                      )}
                      {inst.workflowState === 'maker_submitted' && (roleId === 'DGM' || roleId === 'REGULATORY_OFFICER') && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleTransition(inst.instanceId, 'checker_approved')}>
                          <CheckCircle2 size={14} /> Approve as Checker
                        </button>
                      )}
                      {inst.workflowState === 'checker_approved' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleTransition(inst.instanceId, 'submission_ready')}>
                          <Play size={14} /> Mark Submission Ready
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm">
                        <Download size={14} /> Export to Excel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Report Templates */}
      <div className="reg-section-title" style={{ marginBottom: 12 }}>Available Report Templates</div>
      <div className="grid g2" style={{ marginBottom: 20 }}>
        {definitions.map(def => (
          <div key={def.reportId} className="card card-p">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--accent-weak)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{def.reportName}</div>
                <div className="meta" style={{ marginBottom: 6 }}>{def.reportCode} · {def.authority} · {def.frequency}</div>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>{def.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegulatoryReportsView;
