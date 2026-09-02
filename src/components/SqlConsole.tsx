import { useState, useEffect, useRef } from 'react';
import { Terminal, Play, X, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';

interface SqlConsoleProps {
  open: boolean;
  onClose: () => void;
  /** SQL the agent just ran, offered as the starting point for verification */
  initialSql?: string;
}

/**
 * Read-only SQL console. Every statement is validated by the same guardian that
 * checks the agent's own SQL, so writes are rejected before reaching Neon. Its
 * purpose is verification: run the agent's query yourself, or write your own and
 * compare the numbers.
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
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,12,0.74)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 2rem' }}
    >
      <div
        className="glass fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(1150px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '.9rem', padding: '1.25rem', background: 'var(--surface)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={16} color="var(--accent)" />
            <h3 style={{ margin: 0, color: 'var(--ink)' }}>SQL Console</h3>
            <span style={{ fontSize: '.72rem', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={12} /> read-only &middot; Neon Postgres
            </span>
          </div>
          <button onClick={onClose} title="Close (Esc)" style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <textarea
          ref={areaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onEditorKey}
          spellCheck={false}
          placeholder="SELECT COUNT(*) FROM customers WHERE status = 'ACTIVE';"
          style={{ width: '100%', minHeight: '150px', fontFamily: 'monospace', fontSize: '.85rem', lineHeight: 1.5, color: 'var(--accent)', background: 'var(--surface-2)', resize: 'vertical' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={run} disabled={running || !sql.trim()}
            style={{ background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Play size={15} fill="white" /> {running ? 'Running…' : 'Run'}
          </button>
          <span style={{ fontSize: '.72rem', color: 'var(--ink-3)' }}>⌘/Ctrl + Enter</span>
          {elapsed !== null && (
            <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'monospace' }}>
              <Clock size={12} /> {rowCount?.toLocaleString('en-IN')} rows in {elapsed} ms
            </span>
          )}
        </div>

        {warnings.map((w, i) => (
          <div key={i} style={{ fontSize: '.76rem', color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={13} /> {w}
          </div>
        ))}

        {error && (
          <div style={{ padding: '.8rem 1rem', borderRadius: '4px', background: 'var(--danger-weak)', border: '1px solid rgba(222,106,100,0.35)', color: 'var(--danger)', fontSize: '.83rem' }}>
            <strong style={{ display: 'block', marginBottom: '.2rem' }}>
              {blocked ? 'Blocked by the SQL guardian' : 'The database rejected this statement'}
            </strong>
            {error}
          </div>
        )}

        {rows.length > 0 && (
          <div className="table-container" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table>
              <thead><tr>{Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>{Object.values(r).map((v: any, j) => <td key={j}>{v === null ? 'NULL' : String(v)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!running && !error && rows.length === 0 && rowCount === 0 && (
          <div style={{ color: 'var(--ink-3)', padding: '1.5rem', textAlign: 'center', fontSize: '.85rem' }}>
            The statement ran and returned no rows.
          </div>
        )}
      </div>
    </div>
  );
};

export default SqlConsole;
