import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, MessageSquare, Clock, Bookmark,
  ShieldCheck, Database, Settings as SettingsIcon, Sun, Moon,
} from 'lucide-react';
import './App.css';
import { Logo } from './components/brand/Logo';
import { StatusDot, ToastContainer, showToast } from './components/ui';
import { permissionService } from './lib/permissions';
import type { RoleId } from './lib/permissions';

// Views
import DashboardView from './components/DashboardView';
import AskDataView from './components/AskDataView';
import HistoryView from './components/HistoryView';
import type { HistoryEntry } from './components/HistoryView';
import SavedQueriesView from './components/SavedQueriesView';
import type { SavedQuery } from './components/SavedQueriesView';
import PermissionsView from './components/PermissionsView';
import SchemaExplorer from './components/SchemaExplorer';
import Settings from './components/Settings';
import AccessControlPanel from './components/AccessControlPanel';
import GuardrailTestModal from './components/GuardrailTestModal';

type Tab = 'dashboard' | 'ask' | 'history' | 'saved' | 'permissions' | 'explorer' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ask', label: 'Ask Data', icon: MessageSquare },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'saved', label: 'Saved Queries', icon: Bookmark },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck, group: 'Admin' },
  { id: 'explorer', label: 'Schema Explorer', icon: Database },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const DEFAULT_SAVED_QUERIES: SavedQuery[] = [
  {
    id: 'pinned-1',
    name: 'High Loan Growth Branches',
    question: 'Which branches had the highest loan growth this financial year?',
    savedAt: new Date(),
    isPinned: true,
  },
  {
    id: 'pinned-2',
    name: 'NPA Monitoring',
    question: 'What is the gross NPA ratio across all loan categories?',
    savedAt: new Date(),
    isPinned: true,
  },
  {
    id: 'pinned-3',
    name: 'Deposit Concentration',
    question: 'List top 10 customers by total savings account balance',
    savedAt: new Date(),
    isPinned: true,
  },
  {
    id: 'pinned-4',
    name: 'Employee Productivity',
    question: 'Average transactions processed per employee by branch in Jharkhand',
    savedAt: new Date(),
    isPinned: true,
  },
];

async function safeGetSetting(key: string): Promise<any> {
  try {
    if (window.electronAPI?.settingsGet) {
      return await window.electronAPI.settingsGet(key);
    }
  } catch {}
  try {
    const raw = localStorage.getItem(`rdb_${key}`);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

async function safeSetSetting(key: string, value: any): Promise<boolean> {
  try {
    if (window.electronAPI?.settingsSet) {
      return await window.electronAPI.settingsSet(key, value);
    }
  } catch {}
  try {
    localStorage.setItem(`rdb_${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [roleId, setRoleId] = useState<RoleId>('DGM');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [aiReady, setAiReady] = useState(false);
  const [aiModel, setAiModel] = useState('');
  const [dbConnected, setDbConnected] = useState(false);
  const [accessPanelOpen, setAccessPanelOpen] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [cachedSchema, setCachedSchema] = useState<{ tables: any[]; views: any[] } | null>(null);
  const [guardrailModalOpen, setGuardrailModalOpen] = useState(false);

  const currentRole = permissionService.getRole(roleId);

  // Initialize
  useEffect(() => {
    checkEngine();
    loadSchema();
    // Restore persisted role
    safeGetSetting('activeRole').then((r) => {
      if (r) setRoleId(r as RoleId);
    }).catch(() => {});
    // Restore theme
    safeGetSetting('theme').then((t) => {
      if (t === 'dark' || t === 'light') {
        setTheme(t);
        document.documentElement.setAttribute('data-theme', t);
      }
    }).catch(() => {});
    // Restore saved & pinned queries
    safeGetSetting('saved_queries').then((saved) => {
      if (Array.isArray(saved) && saved.length > 0) {
        setSavedQueries(saved.map((s: any) => ({ ...s, savedAt: new Date(s.savedAt) })));
      } else {
        setSavedQueries(DEFAULT_SAVED_QUERIES);
        safeSetSetting('saved_queries', DEFAULT_SAVED_QUERIES).catch(() => {});
      }
    }).catch(() => {
      setSavedQueries(DEFAULT_SAVED_QUERIES);
    });
  }, []);

  const checkEngine = async () => {
    try {
      if (!window.electronAPI?.aiHealth) {
        setAiReady(false);
        return;
      }
      const h = await window.electronAPI.aiHealth();
      const ready = !!h?.llm?.healthy && !!h?.database?.connected;
      setAiReady(ready);
      setAiModel(h?.llm?.model || '');
      setDbConnected(!!h?.database?.connected);
    } catch {
      setAiReady(false);
    }
  };

  const loadSchema = async () => {
    try {
      if (!window.electronAPI?.aiDbSchema) return;
      const res = await window.electronAPI.aiDbSchema();
      if (res.success && res.data) setCachedSchema(res.data);
    } catch { /* ignore */ }
  };

  const changeRole = useCallback((id: RoleId) => {
    setRoleId(id);
    window.electronAPI.settingsSet('activeRole', id).catch(() => {});
  }, []);

  const changeTheme = useCallback((t: 'light' | 'dark') => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    window.electronAPI.settingsSet('theme', t).catch(() => {});
  }, []);

  const toggleTheme = () => changeTheme(theme === 'light' ? 'dark' : 'light');

  // Handle "ask question" from dashboard
  const handleAskFromDashboard = (question: string) => {
    setInitialQuestion(question);
    setActiveTab('ask');
  };

  // Add to history
  const addToHistory = (question: string, status: 'success' | 'denied' | 'error') => {
    setHistory((prev) => [
      { id: String(Date.now()), question, role: currentRole.title, timestamp: new Date(), status },
      ...prev,
    ]);
  };

  // Handle rerun from history
  const handleRerun = (question: string) => {
    setInitialQuestion(question);
    setActiveTab('ask');
  };

  // Saved queries
  const handleToggleSaveQuery = (question: string, name?: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const existing = savedQueries.find((q) => q.question.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      const updated = savedQueries.filter((q) => q.id !== existing.id);
      setSavedQueries(updated);
      safeSetSetting('saved_queries', updated).catch(() => {});
      showToast('Query removed from pinned queries', 'info');
    } else {
      const newQuery: SavedQuery = {
        id: String(Date.now()),
        name: name || (trimmed.length > 36 ? trimmed.slice(0, 36) + '...' : trimmed),
        question: trimmed,
        savedAt: new Date(),
        isPinned: true,
      };
      const updated = [newQuery, ...savedQueries];
      setSavedQueries(updated);
      safeSetSetting('saved_queries', updated).catch(() => {});
      showToast('Query pinned to favorites', 'success');
    }
  };

  const handleTogglePinQuery = (id: string) => {
    const updated = savedQueries.map((q) => q.id === id ? { ...q, isPinned: !q.isPinned } : q);
    setSavedQueries(updated);
    safeSetSetting('saved_queries', updated).catch(() => {});
    showToast('Pin status updated', 'info');
  };

  const handleAddSavedQuery = (name: string, question: string) => {
    const newQuery: SavedQuery = {
      id: String(Date.now()),
      name,
      question: question.trim(),
      savedAt: new Date(),
      isPinned: true,
    };
    const updated = [newQuery, ...savedQueries];
    setSavedQueries(updated);
    safeSetSetting('saved_queries', updated).catch(() => {});
    showToast('Query saved and pinned', 'success');
  };

  const handleDeleteSaved = (id: string) => {
    const updated = savedQueries.filter((q) => q.id !== id);
    setSavedQueries(updated);
    safeSetSetting('saved_queries', updated).catch(() => {});
    showToast('Saved query deleted', 'info');
  };

  const handleRunSaved = (question: string) => {
    setInitialQuestion(question);
    setActiveTab('ask');
  };

  let lastGroup = '';

  return (
    <div className="app-shell">
      {/* ===== Topbar ===== */}
      <header className="topbar">
        <div className="topbar-left">
          <Logo size={32} subtitle="BANKING DATA INTELLIGENCE" />
        </div>

        <div className="topbar-center">
          <div className="status-row">
            <div className="status-item">
              <StatusDot tone={aiReady ? 'ok' : 'danger'} live={aiReady} />
              <span>{aiReady ? 'AI Online' : 'AI Offline'}</span>
            </div>
            <div className="status-item">
              <StatusDot tone={dbConnected ? 'ok' : 'danger'} live={dbConnected} />
              <span>{dbConnected ? 'Database Connected' : 'Disconnected'}</span>
            </div>
            <div
              className="status-item"
              onClick={() => setGuardrailModalOpen(true)}
              style={{ cursor: 'pointer' }}
              title="Click to inspect AI Guardrail & Governance evaluation suite (25 test cases)"
            >
              <StatusDot tone="ok" live={true} />
              <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>RDB Scope Guard Active</span>
            </div>
            <div className="status-item">
              <StatusDot tone="ok" />
              <span>Authorization Active</span>
            </div>
            <div className="status-item">
              <StatusDot tone="ok" />
              <span>SQL Guardian Active</span>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button className="role-badge" onClick={() => setAccessPanelOpen(true)}>
            <StatusDot tone={currentRole.restrictions.length === 0 ? 'ok' : 'warn'} />
            <span>{currentRole.title}</span>
            <span className="role-scope">{currentRole.restrictions.length === 0 ? 'Full Access' : 'Restricted'}</span>
          </button>
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="app-body">
        {/* Left Rail */}
        <nav className="rail">
          <div className="rail-nav">
            {NAV_ITEMS.map((item) => {
              const showGroup = item.group && item.group !== lastGroup;
              if (item.group) lastGroup = item.group;
              return (
                <React.Fragment key={item.id}>
                  {showGroup && <div className="navgroup">{item.group}</div>}
                  <button
                    className={`navitem ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <span className="ico"><item.icon size={18} /></span>
                    <span>{item.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="rail-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 12, color: 'var(--ink-4)' }}>
              <StatusDot tone={dbConnected ? 'ok' : 'danger'} />
              <span>{dbConnected ? 'Neon Postgres' : 'Disconnected'}</span>
            </div>
          </div>
        </nav>

        {/* Workspace */}
        <main className="workspace">
          {activeTab === 'dashboard' && (
            <DashboardView
              roleId={roleId}
              aiReady={aiReady}
              aiModel={aiModel}
              cachedSchema={cachedSchema}
              savedQueries={savedQueries}
              onAskQuestion={handleAskFromDashboard}
              onNavigateToAsk={() => setActiveTab('ask')}
            />
          )}

          {activeTab === 'ask' && (
            <AskDataView
              roleId={roleId}
              aiReady={aiReady}
              aiModel={aiModel}
              initialQuestion={initialQuestion}
              savedQueries={savedQueries}
              onToggleSaveQuery={handleToggleSaveQuery}
              onClearInitial={() => setInitialQuestion(undefined)}
              onOpenAccessPanel={() => setAccessPanelOpen(true)}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              entries={history}
              onRerun={handleRerun}
            />
          )}

          {activeTab === 'saved' && (
            <SavedQueriesView
              queries={savedQueries}
              onRun={handleRunSaved}
              onDelete={handleDeleteSaved}
              onTogglePin={handleTogglePinQuery}
              onAddQuery={handleAddSavedQuery}
            />
          )}

          {activeTab === 'permissions' && (
            <PermissionsView
              roleId={roleId}
              onRoleChange={changeRole}
            />
          )}

          {activeTab === 'explorer' && <SchemaExplorer cachedSchema={cachedSchema} />}

          {activeTab === 'settings' && (
            <Settings
              theme={theme}
              onThemeChange={changeTheme}
            />
          )}
        </main>
      </div>

      {/* ===== Overlays ===== */}
      <AccessControlPanel
        open={accessPanelOpen}
        onClose={() => setAccessPanelOpen(false)}
        roleId={roleId}
        onRoleChange={changeRole}
      />

      <GuardrailTestModal
        open={guardrailModalOpen}
        onClose={() => setGuardrailModalOpen(false)}
        onTryQuestion={(q) => handleAskFromDashboard(q)}
      />

      <ToastContainer />
    </div>
  );
};

export default App;
