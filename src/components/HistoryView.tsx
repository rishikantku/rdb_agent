import React from 'react';
import { Clock, Search as SearchIcon, ArrowRight } from 'lucide-react';
import { EmptyState } from './ui';

export interface HistoryEntry {
  id: string;
  question: string;
  role: string;
  timestamp: Date;
  status: 'success' | 'denied' | 'error';
}

interface HistoryViewProps {
  entries: HistoryEntry[];
  onRerun: (question: string) => void;
}

function formatTimestamp(d: Date): string {
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return `Today ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    return `Yesterday ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const HistoryView: React.FC<HistoryViewProps> = ({ entries, onRerun }) => {
  const [filter, setFilter] = React.useState('');

  const filtered = entries.filter((e) =>
    e.question.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="wrap wrap-narrow fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Recent Questions</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          Your recent questions and their outcomes
        </p>
      </div>

      {entries.length > 0 && (
        <div style={{ position: 'relative', maxWidth: 320, marginBottom: 8 }}>
          <SearchIcon size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ink-4)' }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search history"
            style={{ paddingLeft: 34, fontSize: 13 }}
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtered.map((entry, i) => (
            <button
              key={entry.id}
              className="history-item"
              onClick={() => onRerun(entry.question)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', background: 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--hairline)' : 'none',
                borderRadius: 0,
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="history-question">{entry.question}</div>
                <div className="history-role">{entry.role}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge badge-${entry.status === 'success' ? 'ok' : entry.status === 'denied' ? 'warn' : 'danger'}`}>
                  {entry.status === 'success' ? 'Completed' : entry.status === 'denied' ? 'Denied' : 'Error'}
                </span>
                <span className="history-meta">{formatTimestamp(entry.timestamp)}</span>
                <ArrowRight size={14} style={{ color: 'var(--ink-4)' }} />
              </div>
            </button>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Clock size={48} />}
          title="No questions yet"
          body="Your questions will appear here after you ask RDB Agent for the first time."
          action={null}
        />
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          No results matching "{filter}"
        </div>
      )}
    </div>
  );
};

export default HistoryView;
