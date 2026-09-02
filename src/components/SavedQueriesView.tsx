import React, { useState } from 'react';
import { Bookmark, Trash2, Play, Plus } from 'lucide-react';
import { EmptyState } from './ui';

export interface SavedQuery {
  id: string;
  name: string;
  question: string;
  savedAt: Date;
}

interface SavedQueriesViewProps {
  queries: SavedQuery[];
  onRun: (question: string) => void;
  onDelete: (id: string) => void;
}

const SavedQueriesView: React.FC<SavedQueriesViewProps> = ({ queries, onRun, onDelete }) => {
  return (
    <div className="wrap wrap-narrow fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Saved Analysis</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          Important questions saved for quick access
        </p>
      </div>

      {queries.length > 0 ? (
        <div className="grid g2">
          {queries.map((q) => (
            <div key={q.id} className="card card-p card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                  <Bookmark size={15} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{q.name}</span>
                </div>
                <button
                  className="btn btn-quiet btn-sm"
                  onClick={(e) => { e.stopPropagation(); onDelete(q.id); }}
                  style={{ padding: 4, color: 'var(--ink-4)' }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0, flex: 1 }}>{q.question}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="meta">
                  {q.savedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => onRun(q.question)}>
                  <Play size={13} /> Run
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark size={48} />}
          title="No saved analyses yet"
          body="Save important questions from your results and reuse them whenever you need."
        />
      )}
    </div>
  );
};

export default SavedQueriesView;
