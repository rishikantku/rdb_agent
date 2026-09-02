import { useMemo, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Search, Download, ArrowUpDown, CheckCircle2, X } from 'lucide-react';

/* ============================================================== formatting */

const CURRENCY_HINT = /(amount|balance|salary|cost|value|disbursed|outstanding|sanction|deposit|expense|revenue)/i;
const PERCENT_HINT = /(pct|percent|percentage|ratio|growth|rate)$/i;
const ID_HINT = /(_id|id|number|code|year|pin|phone)$/i;

/** Indian grouping, with the unit implied by the column name. */
export function formatCell(value: unknown, column = ''): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  const n = typeof value === 'number' ? value : Number(value);
  const numeric = value !== '' && Number.isFinite(n);

  if (numeric && !ID_HINT.test(column)) {
    if (PERCENT_HINT.test(column)) return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
    if (CURRENCY_HINT.test(column)) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return String(value);
}

export const isNumericColumn = (rows: any[], col: string) =>
  rows.length > 0 && rows.slice(0, 12).every((r) => r[col] === null || r[col] === '' || Number.isFinite(Number(r[col])));

export const compact = (n: number) =>
  Math.abs(n) >= 1e7 ? `${(n / 1e7).toFixed(2)} Cr`
  : Math.abs(n) >= 1e5 ? `${(n / 1e5).toFixed(2)} L`
  : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/* =================================================================== card */

export const Card = ({ children, className = '', pad = true, ...rest }: any) => (
  <div className={`card ${pad ? 'card-p' : ''} ${className}`} {...rest}>{children}</div>
);

/* ==================================================================== kpi */

export const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'danger' }) => (
  <div className="kpi-card">
    <div className="kpi-label">{label}</div>
    <div
      className="kpi-value"
      style={tone ? { color: `var(--${tone})` } : undefined}
    >
      {value}
    </div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);

/* ============================================================= disclosure */

export const Disclosure = ({ title, right, children, defaultOpen = false }: any) => (
  <details className="disc" open={defaultOpen}>
    <summary>
      <span className="chev"><ChevronRight size={15} /></span>
      <span style={{ flex: 1 }}>{title}</span>
      {right}
    </summary>
    <div className="inner">{children}</div>
  </details>
);

/* ================================================================= status */

export const StatusDot = ({ tone = 'ok', live = false }: { tone?: 'ok' | 'warn' | 'danger' | 'idle'; live?: boolean }) => (
  <span
    className={`dot ${live ? 'dot-live' : ''}`}
    style={{ color: tone === 'idle' ? 'var(--ink-4)' : `var(--${tone})` }}
  />
);

/* ================================================================== empty */

export const EmptyState = ({ icon, title, body, action }: any) => (
  <div className="empty">
    <div className="ico">{icon}</div>
    <h3 style={{ marginTop: 2 }}>{title}</h3>
    <p className="meta" style={{ maxWidth: '42ch' }}>{body}</p>
    {action && <div style={{ marginTop: 6 }}>{action}</div>}
  </div>
);

/* ============================================================== bar list */

/** Ranked comparison — the right chart for "top branches by X" style answers. */
export const BarList = ({ rows, labelKey, valueKey, max = 8 }: { rows: any[]; labelKey: string; valueKey: string; max?: number }) => {
  const data = rows.slice(0, max).map((r) => ({ label: String(r[labelKey]), value: Number(r[valueKey]) || 0 }));
  const peak = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 200px) 1fr auto', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{ width: `${(Math.abs(d.value) / peak) * 100}%`, height: '100%', background: 'var(--c1)', borderRadius: 'inherit', transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
          </div>
          <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 74, textAlign: 'right' }}>
            {formatCell(d.value, valueKey)}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ============================================================== data table */

export const DataTable = ({ rows, pageSize = 12, onExport }: { rows: any[]; pageSize?: number; onExport?: () => void }) => {
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const cols = rows.length ? Object.keys(rows[0]) : [];
  const numeric = useMemo(() => new Set(cols.filter((c) => isNumericColumn(rows, c))), [rows, cols]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => cols.some((c) => String(r[c] ?? '').toLowerCase().includes(needle)));
  }, [rows, q, cols]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => {
      const x = a[sort.col], y = b[sort.col];
      if (numeric.has(sort.col)) return ((Number(x) || 0) - (Number(y) || 0)) * sort.dir;
      return String(x ?? '').localeCompare(String(y ?? '')) * sort.dir;
    });
  }, [filtered, sort, numeric]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggle = (c: string) => {
    setPage(0);
    setSort((s) => (s?.col === c ? { col: c, dir: s.dir === 1 ? -1 : 1 } : { col: c, dir: 1 }));
  };

  if (!rows.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', maxWidth: 280, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-4)' }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Filter results"
            style={{ paddingLeft: 34, fontSize: 13, padding: '9px 14px 9px 34px' }}
          />
        </div>
        <div className="meta" style={{ marginLeft: 'auto' }}>
          {sorted.length.toLocaleString('en-IN')} {sorted.length === 1 ? 'row' : 'rows'}
        </div>
        {onExport && (
          <button className="btn btn-ghost btn-sm" onClick={onExport}>
            <Download size={13} /> Export
          </button>
        )}
      </div>

      <div className="tablewrap" style={{ maxHeight: 440 }}>
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className={numeric.has(c) ? 'n' : ''} onClick={() => toggle(c)} title="Sort">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {c.replace(/_/g, ' ')}
                    <ArrowUpDown size={11} style={{ opacity: sort?.col === c ? 1 : 0.28 }} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c} className={numeric.has(c) ? 'n' : ''}>{formatCell(r[c], c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-quiet" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={15} /></button>
          <span className="meta num">Page {page + 1} of {pages}</span>
          <button className="btn btn-quiet" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
};

/* ========================================================== sql rendering */

const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|LIMIT|WITH|AS|AND|OR|NOT|IN|CASE|WHEN|THEN|ELSE|END|OVER|PARTITION BY|DISTINCT|UNION|ALL|IS|NULL|BETWEEN|EXISTS|DESC|ASC|INTERVAL)\b/gi;
const SQL_FUNCS = /\b(COUNT|SUM|AVG|MIN|MAX|ROUND|COALESCE|LAG|LEAD|RANK|DENSE_RANK|ROW_NUMBER|NTILE|PERCENT_RANK|PERCENTILE_CONT|EXTRACT|NULLIF|CAST|DATE)\b/gi;

/** Lightweight highlighter — escapes first, so generated SQL cannot inject markup. */
export function highlightSql(sql: string): string {
  const esc = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/--[^\n]*/g, (m) => `\0cm\x01${m}\x02`)
    .replace(/'[^']*'/g, (m) => `\0str\x01${m}\x02`)
    .replace(SQL_KEYWORDS, (m) => `\0kw\x01${m}\x02`)
    .replace(SQL_FUNCS, (m) => `\0fn\x01${m}\x02`)
    .replace(/\b\d+(\.\d+)?\b/g, (m) => `\0num2\x01${m}\x02`)
    .replace(/\0(\w+)\x01([\s\S]*?)\x02/g, (_, cls, txt) => `<span class="${cls}">${txt}</span>`);
}

export const Sql = ({ sql }: { sql: string }) => (
  <pre className="sql" dangerouslySetInnerHTML={{ __html: highlightSql(sql) }} />
);

/* ================================================================== toast */

interface ToastMessage {
  id: string;
  text: string;
  icon?: React.ReactNode;
  duration?: number;
}

let toastId = 0;
const toastListeners: Set<(t: ToastMessage) => void> = new Set();

export function showToast(text: string, icon?: React.ReactNode, duration = 3000) {
  const msg: ToastMessage = { id: String(++toastId), text, icon, duration };
  toastListeners.forEach((fn) => fn(msg));
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<(ToastMessage & { exiting?: boolean })[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => t.id === msg.id ? { ...t, exiting: true } : t));
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== msg.id));
        }, 250);
      }, msg.duration ?? 3000);
    };
    toastListeners.add(handler);
    return () => { toastListeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  const latest = toasts[toasts.length - 1];
  return (
    <div className={`toast ${latest.exiting ? 'toast-exit' : ''}`}>
      {latest.icon && <span className="toast-icon">{latest.icon}</span>}
      <span>{latest.text}</span>
    </div>
  );
};

/* ======================================================= step indicator */

interface PipelineStep {
  stage: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

export const StepIndicator = ({ steps }: { steps: PipelineStep[] }) => (
  <div className="steps">
    {steps.map((s, i) => (
      <div key={i} className={`step ${s.status === 'active' ? 'active' : s.status === 'done' ? 'done' : s.status === 'error' ? 'failed' : ''}`}>
        <span className="ring">
          {s.status === 'done' && <CheckCircle2 size={12} />}
          {s.status === 'error' && <X size={10} />}
        </span>
        <span>{s.stage}</span>
        {s.detail && <span style={{ opacity: 0.65, fontSize: '12px' }}>· {s.detail}</span>}
      </div>
    ))}
  </div>
);

/* ======================================================= greeting helper */

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
