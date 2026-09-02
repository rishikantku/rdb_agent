import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Landmark, CreditCard, Activity, Search,
  Terminal, ShieldAlert, Database as DatabaseIcon, Box, Layers,
  Network, Mic, MicOff, AlertTriangle, CheckCircle2, ShieldCheck, Table2, X, Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QueryFlow from './QueryFlow';
import SqlConsole from './SqlConsole';
import AccessControlPanel from './AccessControlPanel';
import { permissionService } from '../lib/permissions';
import type { AuthorizationDecision, RoleId } from '../lib/permissions';

interface DashboardProps {
  onConnectionChange: (connected: boolean, name?: string) => void;
  externalConnected: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  positive?: boolean;
  /** Table this card counts — double-clicking opens its rows */
  table?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onConnectionChange, externalConnected }) => {
  const [prompt, setPrompt] = useState('');
  const [sql, setSql] = useState('');
  const [mermaidChart, setMermaidChart] = useState('');
  const [showFlow, setShowFlow] = useState(true);
  const [includeVisualStrategy, setIncludeVisualStrategy] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setSchema] = useState<any>(null);
  const [dbName, setDbName] = useState<string>('Disconnected');
  const [cards, setCards] = useState<StatCardProps[]>([]);
  // Pipeline response detail — summary, guardrails, and honest empty/truncated states
  const [summary, setSummary] = useState<string>('');
  const [filters, setFilters] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any[] | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [clarifications, setClarifications] = useState<any[] | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  // The pipeline holds its own database connection (DATABASE_URL), separate from
  // the environment picker above. Ask is gated on the engine, not on that picker.
  const [aiReady, setAiReady] = useState(false);
  const [aiModel, setAiModel] = useState<string>('');
  // Table preview opened by double-clicking a metric card
  const [peekTable, setPeekTable] = useState<string | null>(null);
  const [peekRows, setPeekRows] = useState<any[]>([]);
  const [peekLoading, setPeekLoading] = useState(false);
  const [peekError, setPeekError] = useState<string | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  // Live pipeline stages, streamed from the orchestrator as it works
  const [steps, setSteps] = useState<{ stage: string; status: string; detail?: string }[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Simulated role-based access. The decision is made before any SQL is generated.
  const [roleId, setRoleId] = useState<RoleId>('DGM');
  const [denied, setDenied] = useState<AuthorizationDecision | null>(null);
  const [authorized, setAuthorized] = useState<AuthorizationDecision | null>(null);
  const [accessPanelOpen, setAccessPanelOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    checkEngine();
    loadEnvironment();
    window.electronAPI.settingsGet('activeRole').then((r) => { if (r) setRoleId(r as RoleId); }).catch(() => {});
  }, []);

  const changeRole = (id: RoleId) => {
    setRoleId(id);
    setDenied(null);
    setAuthorized(null);
    window.electronAPI.settingsSet('activeRole', id).catch(() => {});
  };

  useEffect(() => {
    const off = window.electronAPI.onAiProgress((e) => {
      setProgressPct(Math.round(((e.index - (e.status === 'start' ? 0.5 : 0)) / e.total) * 100));
      setSteps((prev) => {
        const next = [...prev];
        const at = next.findIndex((s2) => s2.stage === e.stage);
        const entry = { stage: e.stage, status: e.status, detail: e.detail };
        if (at >= 0) next[at] = entry; else next.push(entry);
        return next;
      });
    });
    return off;
  }, []);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const t = setInterval(() => setElapsedSec((Date.now() - started) / 1000), 100);
    return () => clearInterval(t);
  }, [loading]);

  const openTable = async (table?: string) => {
    if (!table) return;
    setPeekTable(table); setPeekRows([]); setPeekError(null); setPeekLoading(true);
    try {
      const res = await window.electronAPI.aiDbPreview(table, 50);
      if (res.success) setPeekRows(res.data || []);
      else setPeekError(res.error || 'Could not read that table.');
    } catch (err: any) {
      setPeekError(err.message);
    }
    setPeekLoading(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeekTable(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setConsoleOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const checkEngine = async () => {
    try {
      const h = await window.electronAPI.aiHealth();
      setAiReady(!!h?.llm?.healthy && !!h?.database?.connected);
      setAiModel(h?.llm?.model || '');
    } catch {
      setAiReady(false);
    }
  };

  // Everything on this screen comes from the Neon Postgres analysis database —
  // the same connection that answers questions, so metadata and answers agree.
  const loadEnvironment = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.aiDbSchema();
      if (res.success && res.data) {
        setSchema(res.data);
        const byName = (n: string) =>
          res.data!.tables.find((t: any) => t.name.toLowerCase() === n)?.rowCount ?? 0;

        setCards([
          { title: 'Customers', value: byName('customers').toLocaleString('en-IN'), icon: <Users size={20} />, table: 'customers' },
          { title: 'Accounts', value: byName('accounts').toLocaleString('en-IN'), icon: <Landmark size={20} />, table: 'accounts' },
          { title: 'Loans', value: byName('loans').toLocaleString('en-IN'), icon: <CreditCard size={20} />, table: 'loans' },
          { title: 'Transactions', value: byName('transactions').toLocaleString('en-IN'), icon: <Activity size={20} />, table: 'transactions' },
          { title: 'Branches', value: byName('branches').toLocaleString('en-IN'), icon: <Box size={20} />, table: 'branches' },
          { title: 'Tables', value: `${res.data!.tables.length} + ${res.data!.views.length} views`, icon: <Layers size={20} /> },
        ]);
        onConnectionChange(true, 'Neon Postgres');
        setDbName('Neon Postgres');
      } else {
        setError(res.error || 'Could not read the analysis database.');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const toggleListening = useCallback(async () => {
    if (isListening && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        setLoading(true);
        const res = await window.electronAPI.voiceTranscribe(arrayBuffer);
        setLoading(false);

        if (res.success && res.text) {
          setPrompt(prev => prev + (prev.length > 0 ? ' ' : '') + res.text);
        } else if (res.error) {
          setError(`Voice Transcription Error: ${res.error}`);
        }
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err: any) {
      console.error('[Voice] Init failed:', err);
      setError(`Microphone Init Failed: ${err.message}`);
      setIsListening(false);
    }
  }, [isListening]);

  const resetResponse = () => {
    setResults([]); setSql(''); setMermaidChart(''); setError(null);
    setSummary(''); setFilters([]); setTruncated(false); setDiagnosis(null);
    setStages([]); setClarifications(null); setElapsedMs(null); setRowCount(null);
    setSteps([]); setProgressPct(0); setElapsedSec(0);
    setDenied(null); setAuthorized(null);
  };

  // Runs the full on-prem pipeline: schema retrieval → semantic resolution →
  // planning → SQL generation → guardrail validation → execution → summary.
  const handleAsk = async () => {
    setLoading(true); resetResponse();
    try {
      if (!aiReady) throw new Error('The analysis engine is not reachable. Check the Inference Engine screen.');

      // Authorization is decided before the question reaches the model, so a
      // restricted request never generates or executes SQL.
      const decision = await permissionService.authorize({ question: prompt, roleId });
      if (!decision.allowed) {
        setDenied(decision);
        setLoading(false);
        return;
      }
      setAuthorized(decision);

      const res = await window.electronAPI.aiQuery(prompt, 'demo-session');

      if (res?.sql) setSql(res.sql);
      if (res?.debug?.pipelineStages) setStages(res.debug.pipelineStages);
      if (typeof res?.executionTimeMs === 'number') setElapsedMs(res.executionTimeMs);

      if (res?.success) {
        setResults(res.data || []);
        setRowCount(res.rowCount ?? (res.data?.length ?? 0));
        setSummary(res.summary || '');
        setFilters(res.filtersApplied || []);
        setTruncated(!!res.truncated);
        setDiagnosis(res.emptyResultDiagnosis || null);
      } else if (res?.errorType === 'ambiguity') {
        setClarifications(res.clarificationOptions || []);
        setError(res.error || 'That question is ambiguous.');
      } else {
        setError(res?.error || 'The query could not be completed.');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const exportToXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(results); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results"); XLSX.writeFile(wb, "nexus_report.xlsx");
  };

  const currentRole = permissionService.getRole(roleId);

  const exportToPDF = () => {
    if (results.length === 0) return;
    const doc = new jsPDF(); doc.text(`Nexus Data Report`, 14, 15);
    const tableColumn = Object.keys(results[0]); const tableRows = results.map(row => Object.values(row).map(v => String(v)));
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25, styles: { fontSize: 8 }, headStyles: { fillColor: [20, 24, 31] } });
    doc.save(`Nexus_Report_${Date.now()}.pdf`);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Nexus Command Center</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink-3)', fontSize: '0.9rem' }}>
            <DatabaseIcon size={14} color={aiReady ? 'var(--accent)' : 'var(--ink-3)'} />
            <span>{aiReady ? `Analysis engine: ${aiModel} (on-premise)` : 'Analysis engine unavailable'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => setConsoleOpen(true)} title="SQL Console (⌘K)"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.5rem 0.9rem', background: 'var(--accent-weak)', border: '1px solid var(--accent-line)', color: 'var(--accent)' }}>
          <Terminal size={14} /> SQL Console
        </button>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.45rem 0.9rem', background: 'var(--surface-2)' }}>
          <DatabaseIcon size={14} color="var(--accent)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--ink)' }}>{dbName}</span>
          <button onClick={loadEnvironment} disabled={loading}
            style={{ background: 'transparent', border: 'none', padding: '0 0 0 6px', color: 'var(--ink-3)' }} title="Refresh">
            <Layers size={14} />
          </button>
        </div>
        </div>
      </div>

      {error && <div className="glass fade-in" style={{ padding: '1rem', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', display: 'flex', gap: '10px', marginBottom: '1.5rem' }}><ShieldAlert size={20} /><span>{error}</span></div>}

      <div className="glass" style={{ padding: '2rem', marginBottom: '2rem', background: 'rgba(17, 34, 64, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} color={externalConnected ? "var(--accent)" : "var(--ink-3)"} />
            <h3 style={{ margin: 0 }}>Natural Language Diagnostics</h3>
            {aiReady && <span className="badge badge-active" style={{ marginLeft: '10px', background: 'var(--accent-weak)' }}>AI READY</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--ink-3)' }}>
            <input 
              type="checkbox" 
              id="vi-strategy" 
              checked={includeVisualStrategy} 
              onChange={(e) => setIncludeVisualStrategy(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <label htmlFor="vi-strategy" style={{ cursor: 'pointer' }}>Include Visual Implementation Strategy</label>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', padding: '.7rem .9rem', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Current role</span>
            <select
              value={roleId}
              onChange={(e) => changeRole(e.target.value as RoleId)}
              style={{ width: 'auto', padding: '.35rem 1.6rem .35rem .6rem', fontWeight: 600, fontSize: '.84rem' }}
            >
              {permissionService.listRoles().map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '.79rem', color: 'var(--ink-2)' }}>
            <span style={{ color: 'var(--ink-3)' }}>Scope</span>
            <span style={{ fontWeight: 500 }}>{currentRole.scope.label}</span>
          </div>

          <span className={`badge ${currentRole.restrictions.length === 0 ? 'badge-active' : ''}`}
            style={currentRole.restrictions.length ? { color: 'var(--warn)', borderColor: 'rgba(217,154,69,0.35)', background: 'var(--warn-weak)' } : undefined}>
            {currentRole.restrictions.length === 0 ? 'Full access' : 'Restricted'}
          </span>

          <button onClick={() => setAccessPanelOpen(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.76rem', padding: '.38rem .75rem', background: 'transparent', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>
            <ShieldCheck size={13} /> Access Control
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea 
              value={prompt} 
              onChange={(e) => setPrompt(e.target.value)} 
              placeholder={aiReady ? "What can I analyze for you today?" : "Analysis engine unavailable — see Inference Engine."} 
              disabled={!aiReady || loading} 
              style={{ minHeight: '80px', width: '100%', paddingRight: '45px' }} 
            />
            <button
              onClick={toggleListening}
              className={isListening ? 'mic-pulse' : ''}
              disabled={!aiReady || loading}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '35px',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.3s ease',
                zIndex: 10
              }}
            >
              {isListening ? <MicOff size={18} color="var(--accent)" /> : <Mic size={18} color="var(--ink-3)" />}
            </button>
          </div>
          <button onClick={handleAsk} disabled={!aiReady || loading || !prompt} style={{ padding: '0 2rem', height: '80px' }}>{loading ? '...' : <Search size={24} />}</button>
        </div>

        {denied && (
          <div className="glass fade-in" style={{ marginTop: '1.5rem', padding: '1.35rem 1.5rem', borderLeft: '3px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={17} color="var(--danger)" />
              <h3 style={{ margin: 0, color: 'var(--ink)' }}>Access Restricted</h3>
            </div>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '.88rem', maxWidth: '62ch' }}>
              Your current role does not have permission to run this query. No SQL was
              generated and nothing was read from the database.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '.85rem' }}>
              <Fact label="Current role" value={denied.role.title} />
              <Fact label="Your permitted scope" value={denied.role.scope.label} />
              <Fact label="This query requires" value={denied.requested.scopeLabel} />
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '.5rem' }}>
                Why was this query blocked?
              </div>
              {denied.reasons.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', padding: '.25rem 0', fontSize: '.84rem', color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--danger)' }}>&bull;</span> {r}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setAccessPanelOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} /> Switch role
              </button>
              <span style={{ fontSize: '.75rem', color: 'var(--ink-3)' }}>
                Ask within {denied.role.scope.label.toLowerCase()} to continue.
              </span>
            </div>
          </div>
        )}

        {authorized && !loading && (
          <div className="fade-in" style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '9px', fontSize: '.79rem', color: 'var(--success)' }}>
            <CheckCircle2 size={14} />
            <span style={{ fontWeight: 600 }}>Authorized</span>
            <span style={{ color: 'var(--ink-3)' }}>
              Role: {authorized.role.title} &middot; Access scope: {authorized.role.scope.label}
            </span>
          </div>
        )}

        {loading && (
          <div className="glass fade-in" style={{ marginTop: '1.5rem', padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 600 }}>
                {steps.find((s2) => s2.status === 'start')?.stage || 'Working'}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                {elapsedSec.toFixed(1)}s
              </span>
            </div>

            <div className={`progress${progressPct === 0 ? ' indeterminate' : ''}`}>
              <i style={progressPct === 0 ? undefined : { width: `${Math.min(97, progressPct)}%` }} />
            </div>

            <div className="steps">
              {steps.map((s2, i) => (
                <span key={i} className={`step ${s2.status === 'start' ? 'active' : s2.status === 'error' ? 'failed' : 'done'}`}>
                  <i className="dot" />
                  {s2.stage}
                  {s2.detail && <span style={{ opacity: 0.7 }}>· {s2.detail}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <div className="fade-in glass" style={{ marginTop: '1.5rem', padding: '1.25rem', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent)', fontSize: '0.8rem' }}>
              <CheckCircle2 size={14} /> Executive Summary
            </div>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{summary}</p>
            {filters.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {filters.map((f, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2px 10px' }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {truncated && (
          <div className="fade-in" style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--warn-weak)', border: '1px solid rgba(217,154,69,0.35)', borderRadius: '5px', color: 'var(--warn)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} />
            <span>Showing the first {rowCount?.toLocaleString('en-IN')} rows — the full result set is larger. Narrow the question for a complete answer.</span>
          </div>
        )}

        {diagnosis && diagnosis.length > 0 && (
          <div className="fade-in glass" style={{ marginTop: '1rem', padding: '1.25rem', borderLeft: '3px solid var(--warn)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--warn)', fontSize: '0.8rem' }}>
              <AlertTriangle size={14} /> Why this returned nothing
            </div>
            {diagnosis.map((d: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '6px 0', borderBottom: i < diagnosis.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--ink)' }}>{d.condition}</span>
                <span style={{ color: d.matchCount === 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {d.matchCount === null ? 'n/a' : `${d.matchCount.toLocaleString('en-IN')} rows`}
                </span>
              </div>
            ))}
          </div>
        )}

        {clarifications && clarifications.length > 0 && (
          <div className="fade-in glass" style={{ marginTop: '1rem', padding: '1.25rem', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ marginBottom: '10px', color: 'var(--accent)', fontSize: '0.8rem' }}>Which did you mean?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {clarifications.map((c: any, i: number) => (
                <button key={i} onClick={() => { setPrompt(`${prompt} (${c.label})`); setClarifications(null); }}
                  style={{ background: 'var(--accent-weak)', border: '1px solid var(--accent-line)', color: 'var(--accent)', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {stages.length > 0 && (
          <div className="fade-in" style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={12} /> Pipeline</span>
            {stages.map((st: any, i: number) => (
              <span key={i} title={st.details || ''} style={{ fontSize: '0.68rem', color: st.status === 'success' ? 'var(--success)' : 'var(--danger)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                {st.name} {st.durationMs}ms
              </span>
            ))}
            {elapsedMs !== null && (
              <span style={{ fontSize: '0.68rem', color: 'var(--ink-3)', marginLeft: 'auto' }}>total {(elapsedMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}

        {sql && (
          <div className="fade-in" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '5px' }}><Terminal size={14} /> Suggested Action</span>
                {mermaidChart && includeVisualStrategy && (
                  <button 
                    onClick={() => setShowFlow(!showFlow)}
                    style={{ background: 'var(--accent-weak)', border: '1px solid var(--accent-line)', color: 'var(--accent)', padding: '0.3rem 0.6rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Network size={12} /> {showFlow ? 'Hide Flow' : 'Show Flow'}
                  </button>
                )}
              </div>
              <button onClick={() => setConsoleOpen(true)} title="Open this SQL in the console (⌘K)"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: 'var(--accent-weak)', border: '1px solid var(--accent-line)', color: 'var(--accent)' }}>
                <Terminal size={13} /> Verify in SQL Console
              </button>
            </div>
            <pre style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '5px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sql}</pre>
            
            {mermaidChart && includeVisualStrategy && showFlow && <QueryFlow chart={mermaidChart} />}
          </div>
        )}
      </div>

      {results.length > 0 ? (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Results ({results.length})</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={exportToXLSX} className="nav-item">Excel</button>
              <button onClick={exportToPDF} className="nav-item">PDF</button>
            </div>
          </div>
          <div className="glass table-container">
            <table>
              <thead><tr>{Object.keys(results[0]).map(key => <th key={key}>{key}</th>)}</tr></thead>
              <tbody>{results.map((row, i) => (<tr key={i}>{Object.values(row).map((v: any, j) => <td key={j}>{String(v)}</td>)}</tr>))}</tbody>
            </table>
          </div>
        </div>
      ) : externalConnected && cards.length > 0 ? (
        <div className="fade-in">
          <h2 style={{ marginBottom: '1.5rem' }}>Environment Metadata</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>{cards.map((card, i) => <StatCard key={i} {...card} onOpen={openTable} />)}</div>
        </div>
      ) : <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}><DatabaseIcon size={64} style={{ marginBottom: '1rem', opacity: 0.2 }} /><h3>No Environment Selected</h3><p>Please select a database environment above to view performance metrics.</p></div>}

      <SqlConsole open={consoleOpen} onClose={() => setConsoleOpen(false)} initialSql={sql} />
      <AccessControlPanel open={accessPanelOpen} onClose={() => setAccessPanelOpen(false)} roleId={roleId} onRoleChange={changeRole} />

      {peekTable && (
        <div
          onClick={() => setPeekTable(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,12,0.74)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
        >
          <div className="glass fade-in" onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1100px, 100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.25rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Table2 size={16} color="var(--accent)" />
                <h3 style={{ margin: 0, color: 'var(--ink)' }}>{peekTable}</h3>
                {!peekLoading && !peekError && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>first {peekRows.length} rows from Neon Postgres</span>
                )}
              </div>
              <button onClick={() => setPeekTable(null)} style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', padding: '4px' }} title="Close (Esc)">
                <X size={18} />
              </button>
            </div>

            {peekLoading && <div style={{ color: 'var(--ink-3)', padding: '2rem', textAlign: 'center' }}>Loading rows…</div>}
            {peekError && <div style={{ color: 'var(--danger)', padding: '1rem' }}>{peekError}</div>}

            {!peekLoading && !peekError && peekRows.length > 0 && (
              <div className="table-container" style={{ overflow: 'auto', flex: 1 }}>
                <table>
                  <thead><tr>{Object.keys(peekRows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>
                    {peekRows.map((row, i) => (
                      <tr key={i}>{Object.values(row).map((v: any, j) => <td key={j}>{v === null ? 'NULL' : String(v)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!peekLoading && !peekError && peekRows.length === 0 && (
              <div style={{ color: 'var(--ink-3)', padding: '2rem', textAlign: 'center' }}>This table has no rows.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.64rem', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '.2rem' }}>{label}</div>
    <div style={{ fontSize: '.86rem', color: 'var(--ink)', fontWeight: 500 }}>{value}</div>
  </div>
);

const StatCard = ({ title, value, icon, trend, positive, table, onOpen }: StatCardProps & { onOpen?: (t?: string) => void }) => (
  <div
    className="glass"
    style={{ padding: '1.5rem', cursor: table ? 'pointer' : 'default', position: 'relative' }}
    onDoubleClick={() => onOpen?.(table)}
    onKeyDown={(e) => { if (table && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen?.(table); } }}
    tabIndex={table ? 0 : -1}
    role={table ? 'button' : undefined}
    title={table ? `Double-click to view rows from ${table}` : undefined}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
      <div style={{ color: 'var(--accent)' }}>{icon}</div>
      <div style={{ fontSize: '0.8rem', color: positive ? 'var(--success)' : 'var(--danger)' }}>{trend}</div>
    </div>
    <div style={{ fontSize: '0.8rem', color: 'var(--ink-3)' }}>{title}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
    {table && (
      <div style={{ marginTop: '.5rem', fontSize: '0.68rem', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Table2 size={11} /> double-click to view rows
      </div>
    )}
  </div>
);

export default Dashboard;
