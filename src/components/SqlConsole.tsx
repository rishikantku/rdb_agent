import { useState, useEffect, useRef } from 'react';
import { Terminal, Play, X, ShieldCheck, AlertTriangle, Clock, CheckCircle2, Lock } from 'lucide-react';
import { DataTable, Sql } from './ui';

interface SqlConsoleProps {
  open: boolean;
  onClose: () => void;
  /** SQL the agent just ran, offered as the starting point for verification */
  initialSql?: string;
}

/**
 * Read-only SQL console. Every statement is validated by the same guardian that
 * checks the agent's own SQL, so writes are rejected before reaching Neon.
 */
const SqlConsole = ({ open, onClose, initialSql }: SqlConsoleProps) => {
  const [sql, setSql] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (initialSql) setSql(initialSql);
    const t = setTimeout(() => areaRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open, initialSql]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const run = async () => {
    setRunning(true); setError(null); setBlocked(false); setRows([]);
    setWarnings([]); setElapsed(null); setRowCount(null);
    try {
      const res = await window.electronAPI.aiSqlRun(sql);
      if (res.success) {
        setRows(res.data || []);
        setRowCount(res.rowCount ?? res.data?.length ?? 0);
        setElapsed(res.elapsedMs ?? null);
        setWarnings(res.warnings || []);
      } else {
        setError(res.error || 'The statement could not be run.');
        setBlocked(!!res.blocked);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setRunning(false);
  };

  const onEditorKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  };

  if (!open) return null;

  return (
    <div className="overlay modal-center" onClick={onClose}>
      <div className="modal-box fade" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Terminal size={18} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>SQL Console</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-4)' }}>
              <ShieldCheck size={13} /> Read-only · Neon Postgres
            </div>
          </div>
          <button className="btn btn-quiet btn-icon" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <textarea
            ref={areaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onEditorKey}
            spellCheck={false}
            placeholder="SELECT COUNT(*) FROM customers WHERE status = 'ACTIVE';"
            style={{ width: '100%', minHeight: '140px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', background: 'var(--surface-2)', resize: 'vertical', borderRadius: 'var(--r-md)' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={run} disabled={running || !sql.trim()}>
              <Play size={15} /> {running ? 'Running…' : 'Run'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>⌘/Ctrl + Enter</span>
            {elapsed !== null && (
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} /> {rowCount?.toLocaleString('en-IN')} rows in {elapsed} ms
              </span>
            )}
          </div>

          {/* Validation badges */}
          {rows.length > 0 && (
            <div className="validation-row">
              <span className="validation-badge"><CheckCircle2 size={12} /> SQL Validated</span>
              <span className="validation-badge"><Lock size={12} /> Read-only</span>
              <span className="validation-badge"><CheckCircle2 size={12} /> Executed</span>
            </div>
          )}

          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> {w}
            </div>
          ))}

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--danger-weak)', border: '1px solid rgba(179,38,30,0.18)', color: 'var(--danger)', fontSize: 13.5 }}>
              <strong style={{ display: 'block', marginBottom: 3 }}>
                {blocked ? 'Blocked by the SQL guardian' : 'The database rejected this statement'}
              </strong>
              {error}
            </div>
          )}

          {rows.length > 0 && (
            <DataTable rows={rows} pageSize={20} />
          )}

          {!running && !error && rows.length === 0 && rowCount === 0 && (
            <div style={{ color: 'var(--ink-3)', padding: '24px', textAlign: 'center', fontSize: 14 }}>
              The statement ran and returned no rows.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlConsole;
