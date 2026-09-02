import React, { useState, useMemo } from 'react';
import {
  Users, Landmark, CreditCard, Activity, Box, Layers,
  TrendingUp, Building2, UserCheck, BarChart3, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { Kpi } from './ui';
import type { RoleId } from '../lib/permissions';
import { permissionService } from '../lib/permissions';

interface DashboardViewProps {
  roleId: RoleId;
  aiReady: boolean;
  aiModel: string;
  cachedSchema: { tables: any[]; views: any[] } | null;
  onAskQuestion: (question: string) => void;
  onNavigateToAsk: () => void;
}

interface StatCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  table?: string;
}

const SUGGESTIONS = [
  { icon: <TrendingUp size={20} />, title: 'Loan Growth', desc: 'Which branches have loan growth above 15% YoY?' },
  { icon: <Building2 size={20} />, title: 'Branch Performance', desc: 'Top performing branches by deposit growth this quarter' },
  { icon: <Users size={20} />, title: 'Customer Trends', desc: 'Customer acquisition trends across all zones' },
  { icon: <UserCheck size={20} />, title: 'Employee Productivity', desc: 'Average transactions processed per employee by branch' },
  { icon: <BarChart3 size={20} />, title: 'Risk Analysis', desc: 'NPA ratio trends across branches for the past 4 quarters' },
  { icon: <ShieldCheck size={20} />, title: 'Financial Overview', desc: 'Revenue and profitability summary by region' },
];

const DashboardView: React.FC<DashboardViewProps> = ({
  roleId,
  aiReady,
  aiModel,
  cachedSchema,
  onAskQuestion,
  onNavigateToAsk,
}) => {
  const [prompt, setPrompt] = useState('');
  const role = permissionService.getRole(roleId);

  const cards = useMemo<StatCard[]>(() => {
    if (!cachedSchema) return [];
    const byName = (n: string) =>
      cachedSchema.tables.find((t: any) => t.name.toLowerCase() === n)?.rowCount ?? 0;
    return [
      { title: 'Customers', value: byName('customers').toLocaleString('en-IN'), icon: <Users size={18} />, table: 'customers' },
      { title: 'Accounts', value: byName('accounts').toLocaleString('en-IN'), icon: <Landmark size={18} />, table: 'accounts' },
      { title: 'Loans', value: byName('loans').toLocaleString('en-IN'), icon: <CreditCard size={18} />, table: 'loans' },
      { title: 'Transactions', value: byName('transactions').toLocaleString('en-IN'), icon: <Activity size={18} />, table: 'transactions' },
      { title: 'Branches', value: byName('branches').toLocaleString('en-IN'), icon: <Box size={18} />, table: 'branches' },
      { title: 'Tables', value: `${cachedSchema.tables.length} + ${cachedSchema.views.length} views`, icon: <Layers size={18} /> },
    ];
  }, [cachedSchema]);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onAskQuestion(prompt.trim());
    setPrompt('');
  };

  const handleSuggestion = (desc: string) => {
    onAskQuestion(desc);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="wrap fade">
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          What would you like to know about your bank data?
        </h1>
      </div>

      {/* Primary Query Input */}
      <div className="card" style={{ padding: '28px 28px 24px', marginBottom: 8 }}>
        <div className="query-input-wrap">
          <textarea
            className="query-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiReady
              ? 'Ask your bank data... e.g. "Which branches have loan growth above 15% YoY?"'
              : 'Analysis engine unavailable'}
            disabled={!aiReady}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-4)' }}>
            {aiReady && (
              <>
                <span className="dot" style={{ color: 'var(--ok)', width: 6, height: 6 }} />
                <span>{aiModel || 'AI Ready'}</span>
              </>
            )}
          </div>
          <button
            className="query-submit"
            onClick={handleSubmit}
            disabled={!aiReady || !prompt.trim()}
          >
            Ask RDB Agent
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Suggested Questions */}
      <div style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Suggested Questions
        </h3>
        <div className="grid g3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="suggestion-card"
              onClick={() => handleSuggestion(s.desc)}
              style={{ textAlign: 'left', border: '1px solid var(--hairline)' }}
            >
              <div className="suggestion-icon">{s.icon}</div>
              <div>
                <div className="suggestion-text">{s.title}</div>
                <div className="suggestion-desc">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Data Overview */}
      {cards.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Data Overview
          </h3>
          <div className="grid g6">
            {cards.map((c, i) => (
              <Kpi key={i} label={c.title} value={c.value} />
            ))}
          </div>
        </div>
      )}

      {!cachedSchema && (
        <div className="grid g6" style={{ marginTop: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--r-lg)' }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardView;
