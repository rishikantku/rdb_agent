import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Database, RefreshCw, AlertTriangle, Server, Sun, Moon } from 'lucide-react';
import { StatusDot } from './ui';

interface SettingsProps {
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
}

/**
 * Inference engine status and application settings.
 * The model is self-hosted — there is no provider to choose at runtime.
 */
const Settings = ({ theme, onThemeChange }: SettingsProps) => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { refresh(); }, []);

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
    <div className="wrap wrap-narrow fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          System configuration and inference engine status
        </p>
      </div>

      {/* Appearance */}
      <div className="card card-p">
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Appearance</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onThemeChange('light')}
          >
            <Sun size={15} /> Light
          </button>
          <button
            className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onThemeChange('dark')}
          >
            <Moon size={15} /> Dark
          </button>
        </div>
      </div>

      {/* Inference Engine */}
      <div className="card card-p">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14 }}>Inference Engine</h3>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} /> {loading ? 'Checking…' : 'Re-check'}
          </button>
        </div>

        {/* Status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderRadius: 'var(--r-md)', marginBottom: 16,
          background: ok ? 'var(--ok-weak)' : 'var(--danger-weak)',
          border: `1px solid ${ok ? 'rgba(14,122,85,0.18)' : 'rgba(179,38,30,0.18)'}`,
          color: ok ? 'var(--ok)' : 'var(--danger)',
        }}>
          {ok ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {loading ? 'Checking engine…' : ok ? 'Model online' : 'Model unreachable'}
          </span>
          {llm?.latencyMs != null && ok && (
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 12.5 }}>{llm.latencyMs}ms</span>
          )}
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <DetailRow icon={<Cpu size={15} />} label="Model" value={llm?.model || '—'} />
          <DetailRow icon={<Server size={15} />} label="Served from" value={health?.initialized ? 'Self-hosted (no data leaves deployment)' : '—'} />
          <DetailRow icon={<Database size={15} />} label="Database" value={db?.connected ? `Connected (${db.latencyMs}ms)` : 'Disconnected'} />
          <DetailRow icon={<ShieldCheck size={15} />} label="Schema" value={schema ? `${schema.tables} tables, ${schema.terms} business terms` : '—'} />
        </div>

        {(llm?.error || health?.error) && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--danger-weak)', color: 'var(--danger)', fontSize: 13 }}>
            {llm?.error || health?.error}
          </div>
        )}

        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          The endpoint and model are set by <code>LLM_BASE_URL</code> and <code>LLM_MODEL</code> in the
          environment configuration. The model is open-weight and self-hosted — it runs inside
          the bank's own data centre with no third-party API calls.
        </p>
      </div>
    </div>
  );
};

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
    <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>
    <span style={{ color: 'var(--ink-3)', fontSize: 13.5, minWidth: 110 }}>{label}</span>
    <span style={{ color: 'var(--ink)', fontSize: 13.5, wordBreak: 'break-word' }}>{value}</span>
  </div>
);

export default Settings;
