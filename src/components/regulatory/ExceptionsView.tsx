// ============================================================================
// Exceptions View — Exception Deep-Dive & Root-Cause Analysis
// ============================================================================

import React, { useState, useMemo } from 'react';
import { AlertTriangle, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { ExceptionRow, SeverityBadge } from './ui-components';
import { ExceptionService } from '../../backend/regulatory/exception-service';
import { DQ_DIMENSION_LABELS } from '../../backend/regulatory/types';
import type { DQDimension, Severity, ExceptionStatus } from '../../backend/regulatory/types';
import type { RoleId } from '../../lib/permissions';

interface ExceptionsViewProps {
  roleId: RoleId;
}

const exceptionService = new ExceptionService();

type DimFilter = DQDimension | 'all';
type SevFilter = Severity | 'all';
type StatusFilter = ExceptionStatus | 'all';

const ExceptionsView: React.FC<ExceptionsViewProps> = ({ roleId }) => {
  const [dimFilter, setDimFilter] = useState<DimFilter>('all');
  const [sevFilter, setSevFilter] = useState<SevFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const allExceptions = useMemo(() => exceptionService.getAllExceptions(), [refreshKey]);
  const summary = useMemo(() => exceptionService.getSummary(), [refreshKey]);

  const filtered = useMemo(() => {
    return allExceptions.filter(e => {
      if (dimFilter !== 'all' && e.ruleExecution.rule.dimension !== dimFilter) return false;
      if (sevFilter !== 'all' && e.priority !== sevFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [allExceptions, dimFilter, sevFilter, statusFilter]);

  const handleResolve = (exceptionId: string) => {
    exceptionService.resolve(exceptionId, `Resolved by ${roleId}`);
    setRefreshKey(k => k + 1);
  };

  const canResolve = roleId === 'DGM' || roleId === 'REGULATORY_OFFICER';

  return (
    <div className="wrap fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={24} style={{ color: 'var(--warn)' }} />
          Data Quality Exceptions
        </h1>
        <p className="meta">Identify, investigate, and resolve regulatory data quality issues · Q4 FY2025-26</p>
      </div>

      {/* Summary */}
      <div className="grid g6" style={{ marginBottom: 16 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total</div>
          <div className="kpi-value" style={{ fontSize: 24 }}>{summary.total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open</div>
          <div className="kpi-value" style={{ fontSize: 24, color: summary.open > 0 ? 'var(--warn)' : 'var(--ok)' }}>{summary.open}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Critical</div>
          <div className="kpi-value" style={{ fontSize: 24, color: summary.critical > 0 ? 'var(--danger)' : 'var(--ok)' }}>{summary.critical}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High</div>
          <div className="kpi-value" style={{ fontSize: 24, color: summary.high > 0 ? 'var(--warn)' : 'var(--ok)' }}>{summary.high}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Resolved</div>
          <div className="kpi-value" style={{ fontSize: 24, color: 'var(--ok)' }}>{summary.resolved}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Impact</div>
          <div className="kpi-value" style={{ fontSize: 24 }}>₹{summary.totalFinancialImpact.toFixed(1)} Cr</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <Filter size={14} style={{ color: 'var(--ink-4)' }} />

        <button className={`filter-chip ${dimFilter === 'all' ? 'active' : ''}`} onClick={() => setDimFilter('all')}>All Dimensions</button>
        {(['accuracy', 'completeness', 'consistency', 'timeliness'] as DQDimension[]).map(d => (
          <button key={d} className={`filter-chip ${dimFilter === d ? 'active' : ''}`} onClick={() => setDimFilter(d)}>
            {DQ_DIMENSION_LABELS[d]}
          </button>
        ))}

        <span style={{ color: 'var(--hairline-strong)' }}>|</span>

        <button className={`filter-chip ${sevFilter === 'all' ? 'active' : ''}`} onClick={() => setSevFilter('all')}>All Severity</button>
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map(s => (
          <button key={s} className={`filter-chip ${sevFilter === s ? 'active' : ''}`} onClick={() => setSevFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}

        <span style={{ color: 'var(--hairline-strong)' }}>|</span>

        <button className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All Status</button>
        <button className={`filter-chip ${statusFilter === 'open' ? 'active' : ''}`} onClick={() => setStatusFilter('open')}>Open</button>
        <button className={`filter-chip ${statusFilter === 'resolved' ? 'active' : ''}`} onClick={() => setStatusFilter('resolved')}>Resolved</button>
      </div>

      {/* Exception List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div className="empty">
            <CheckCircle2 size={40} style={{ color: 'var(--ok)' }} />
            <h3>No exceptions match your filters</h3>
            <p className="meta">Try adjusting the dimension, severity, or status filters.</p>
          </div>
        )}
        {filtered.map(exc => (
          <ExceptionRow
            key={exc.exceptionId}
            exception={exc}
            onResolve={canResolve ? handleResolve : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default ExceptionsView;
