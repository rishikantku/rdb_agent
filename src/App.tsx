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
    window.electronAPI.settingsGet('activeRole').then((r) => {
      if (r) setRoleId(r as RoleId);
    }).catch(() => {});
    // Restore theme
    window.electronAPI.settingsGet('theme').then((t) => {
      if (t === 'dark' || t === 'light') {
        setTheme(t);
        document.documentElement.setAttribute('data-theme', t);
      }
    }).catch(() => {});
  }, []);

  const checkEngine = async () => {
    try {
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
  const handleDeleteSaved = (id: string) => {
    setSavedQueries((prev) => prev.filter((q) => q.id !== id));
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
          <Logo size={26} />
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
