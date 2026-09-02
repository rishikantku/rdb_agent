import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Database, RefreshCw, AlertTriangle, Server } from 'lucide-react';

/**
 * Inference is served by the self-hosted model configured in .env — there is no
 * provider to choose at runtime, and nothing leaves the deployment. This screen
 * reports the live state of that engine rather than offering cloud API keys.
 */
const Settings = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      setHealth(await window.electronAPI.aiHealth());
    } catch (err: any) {
      setHealth({ initialized: false, error: err.message });
    }
    setLoading(false);
  };

  const llm = health?.llm;
  const db = health?.database;
  const schema = health?.schema;
  const ok = !!llm?.healthy;

  return (
    <div className="fade-in">
      <h1>Inference Engine</h1>

      <div className="glass" style={{ padding: '2rem', maxWidth: '700px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: '#fbbf24' }}>Self-Hosted Model</h3>
          <button onClick={refresh} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
            <RefreshCw size={14} /> {loading ? 'Checking…' : 'Re-check'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', borderRadius: '5px', marginBottom: '1.5rem',
          background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
          color: ok ? '#10b981' : '#ef4444' }}>
          {ok ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontWeight: 600 }}>
            {loading ? 'Checking engine…' : ok ? 'Model online' : 'Model unreachable'}
          </span>
          {llm?.latencyMs != null && ok && (
            <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.8rem' }}>{llm.latencyMs}ms</span>
          )}
        </div>

        <Row icon={<Cpu size={16} />} label="Model" value={llm?.model || '—'} />
        <Row icon={<Server size={16} />} label="Served from" value={health?.initialized ? 'Self-hosted vLLM (no data leaves the deployment)' : '—'} />
        <Row icon={<Database size={16} />} label="Database" value={db?.connected ? `Connected (${db.latencyMs}ms)` : 'Disconnected'} />
        <Row icon={<ShieldCheck size={16} />} label="Schema loaded" value={schema ? `${schema.tables} tables, ${schema.terms} business terms` : '—'} />

        {(llm?.error || health?.error) && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '5px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '0.8rem' }}>
            {llm?.error || health?.error}
          </div>
        )}

        <p style={{ marginTop: '1.5rem', marginBottom: 0, fontSize: '0.78rem', color: '#8892b0', lineHeight: 1.6 }}>
          The endpoint and model are set by <code>LLM_BASE_URL</code> and <code>LLM_MODEL</code> in the
          environment configuration. Because the model is open-weight and self-hosted, it can run inside
          the bank's own data centre with no third-party API calls.
        </p>
      </div>
    </div>
  );
};

const Row = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ color: '#64ffda' }}>{icon}</span>
    <span style={{ color: '#8892b0', fontSize: '0.85rem', minWidth: '130px' }}>{label}</span>
    <span style={{ color: '#e6f1ff', fontSize: '0.85rem', wordBreak: 'break-word' }}>{value}</span>
  </div>
);

export default Settings;
