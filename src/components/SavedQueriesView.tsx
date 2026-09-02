import React, { useState } from 'react';
import { Bookmark, Trash2, Play, Plus, Star, Pin } from 'lucide-react';
import { EmptyState } from './ui';

export interface SavedQuery {
  id: string;
  name: string;
  question: string;
  savedAt: Date;
  isPinned?: boolean;
}

interface SavedQueriesViewProps {
  queries: SavedQuery[];
  onRun: (question: string) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onAddQuery?: (name: string, question: string) => void;
}

const SavedQueriesView: React.FC<SavedQueriesViewProps> = ({
  queries,
  onRun,
  onDelete,
  onTogglePin,
  onAddQuery,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuestion, setNewQuestion] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    const name = newName.trim() || newQuestion.trim().slice(0, 32);
    onAddQuery?.(name, newQuestion.trim());
    setNewName('');
    setNewQuestion('');
    setShowAddModal(false);
  };

  const sortedQueries = [...queries].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });

  return (
    <div className="wrap wrap-narrow fade">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Saved & Pinned Queries</h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
            Reusable executive questions pinned for one-click access
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={15} /> Save New Query
        </button>
      </div>

      {sortedQueries.length > 0 ? (
        <div className="grid g2">
          {sortedQueries.map((q) => (
            <div
              key={q.id}
              className="card card-p card-hover"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                borderTop: q.isPinned ? '2px solid var(--accent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: q.isPinned ? '#F59E0B' : 'var(--accent)' }}>
                  {q.isPinned ? <Star size={16} fill="#F59E0B" /> : <Bookmark size={16} />}
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{q.name}</span>
                  {q.isPinned && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#D97706',
                      }}
                    >
                      Pinned
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {onTogglePin && (
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={(e) => { e.stopPropagation(); onTogglePin(q.id); }}
                      style={{ padding: 4, color: q.isPinned ? '#F59E0B' : 'var(--ink-4)' }}
                      title={q.isPinned ? 'Unpin query' : 'Pin query to quick access'}
                    >
                      <Pin size={14} style={{ transform: q.isPinned ? 'rotate(45deg)' : 'none' }} />
                    </button>
                  )}
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(q.id); }}
                    style={{ padding: 4, color: 'var(--ink-4)' }}
                    title="Delete query"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0, flex: 1 }}>
                {q.question}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--hairline)' }}>
                <span className="meta" style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                  {new Date(q.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => onRun(q.question)}>
                  <Play size={13} /> Run Query
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark size={48} />}
          title="No pinned queries yet"
          body="Save recurring executive questions from your analyses to reuse them anytime with one click."
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: 18, marginBottom: 14 }}>Save Reusable Query</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
                  Display Name / Remit (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. High Loan Growth Branches"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
                  Banking Question / Analytical Intent
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="e.g. Which branches in Jharkhand had loan growth above 15% YoY?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Pin Query
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedQueriesView;
