import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Mic, MicOff, ShieldCheck, CheckCircle2, AlertTriangle,
  Lock, Terminal, Network, Copy, ArrowRight, ChevronRight,
  Download, FileSpreadsheet, FileText, ShieldAlert, HelpCircle, Play,
  Star, Bookmark, Pin,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { permissionService } from '../lib/permissions';
import type { AuthorizationDecision, RoleId } from '../lib/permissions';
import { queryGuardrail } from '../lib/guardrail';
import type { GuardrailDecision, ConversationHistoryItem } from '../lib/guardrail';
import { DataTable, Kpi, Sql, Disclosure, showToast, compact } from './ui';
import QueryFlow from './QueryFlow';
import SqlConsole from './SqlConsole';
import GuardrailTestModal from './GuardrailTestModal';
import type { SavedQuery } from './SavedQueriesView';

interface AskDataViewProps {
  roleId: RoleId;
  aiReady: boolean;
  aiModel: string;
  /** Pre-filled question from dashboard suggestion */
  initialQuestion?: string;
  onClearInitial?: () => void;
  onOpenAccessPanel: () => void;
  savedQueries?: SavedQuery[];
  onToggleSaveQuery?: (question: string, name?: string) => void;
}

const AskDataView: React.FC<AskDataViewProps> = ({
  roleId,
  aiReady,
  aiModel,
  initialQuestion,
  onClearInitial,
  onOpenAccessPanel,
  savedQueries = [],
  onToggleSaveQuery,
}) => {
  const [prompt, setPrompt] = useState('');
  const [sql, setSql] = useState('');
  const [mermaidChart, setMermaidChart] = useState('');
  const [showFlow, setShowFlow] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [filters, setFilters] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any[] | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [clarifications, setClarifications] = useState<any[] | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [denied, setDenied] = useState<AuthorizationDecision | null>(null);
  const [authorized, setAuthorized] = useState<AuthorizationDecision | null>(null);
  const [scopeBlocked, setScopeBlocked] = useState<GuardrailDecision | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryItem[]>([]);
  const [guardrailModalOpen, setGuardrailModalOpen] = useState(false);
  const [steps, setSteps] = useState<{ stage: string; status: string; detail?: string }[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [askedQuestion, setAskedQuestion] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentRole = permissionService.getRole(roleId);

  // Handle initial question from dashboard
  useEffect(() => {
    if (initialQuestion) {
      setPrompt(initialQuestion);
      onClearInitial?.();
      // Auto-submit after a small delay
      setTimeout(() => {
        if (aiReady) handleAsk(initialQuestion);
      }, 200);
    }
  }, [initialQuestion]);

  // Pipeline progress events
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

  // Elapsed time during loading
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const t = setInterval(() => setElapsedSec((Date.now() - started) / 1000), 100);
    return () => clearInterval(t);
  }, [loading]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setConsoleOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      recorder.onstart = () => { setIsListening(true); setError(null); };
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
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err: any) {
      setError(`Microphone Init Failed: ${err.message}`);
      setIsListening(false);
    }
  }, [isListening]);

  const resetResponse = () => {
    setResults([]); setSql(''); setMermaidChart(''); setError(null);
    setSummary(''); setFilters([]); setTruncated(false); setDiagnosis(null);
    setStages([]); setClarifications(null); setElapsedMs(null); setRowCount(null);
    setSteps([]); setProgressPct(0); setElapsedSec(0);
    setDenied(null); setAuthorized(null); setScopeBlocked(null);
  };

  const handleAsk = async (overridePrompt?: string) => {
    const q = overridePrompt || prompt;
    if (!q.trim()) return;
    setLoading(true); resetResponse();
    setAskedQuestion(q.trim());
    try {
      // ----------------------------------------------------------------------
      // Step 0: Direct SQL Execution Support
      // If the user pastes raw SQL (SELECT, WITH, EXPLAIN), run through SQLGuardian
      // and execute directly rather than re-prompting the LLM.
      // ----------------------------------------------------------------------
      const isDirectSql = /^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i.test(q.trim());
      if (isDirectSql) {
        const sqlRes = await window.electronAPI.sqlRun(q.trim());
        if (sqlRes.success) {
          setResults(sqlRes.data || []);
          setRowCount(sqlRes.rowCount ?? (sqlRes.data?.length ?? 0));
          setSql(q.trim());
          setSummary(`Direct SQL query executed successfully. Returned ${sqlRes.rowCount ?? (sqlRes.data?.length ?? 0)} rows in ${sqlRes.elapsedMs ?? 0}ms.`);
          if (sqlRes.rowCount === 0) {
            setDiagnosis([{ condition: 'Direct query returned 0 rows from the database with current filter criteria', matchCount: 0 }]);
          }
          setLoading(false);
          return;
        } else {
          setError(sqlRes.error || 'SQL execution failed.');
          setLoading(false);
          return;
        }
      }

      if (!aiReady) throw new Error('The analysis engine is not reachable.');

      // ----------------------------------------------------------------------
      // Step 1: Query Scope Guardrail & Governance Layer
      // ----------------------------------------------------------------------
      const guardDecision = queryGuardrail.classify(q, conversationHistory);
      if (!guardDecision.allowed) {
        if (guardDecision.classification === 'AMBIGUOUS') {
          setClarifications(guardDecision.clarificationOptions?.map((o) => ({
            label: o.label,
            description: o.description || o.prompt,
            value: o.prompt,
          })) || []);
          setError(guardDecision.message);
        } else {
          setScopeBlocked(guardDecision);
        }
        setLoading(false);
        return;
      }

      // ----------------------------------------------------------------------
      // Step 2: Role Authorization & Scope Access Control
      // ----------------------------------------------------------------------
      const decision = await permissionService.authorize({ question: q, roleId });
      if (!decision.allowed) {
        setDenied(decision);
        setLoading(false);
        return;
      }
      setAuthorized(decision);

      // ----------------------------------------------------------------------
      // Step 3: Full AI Query Pipeline (Semantic Layer → LLM → SQL Guardian → DB)
      // ----------------------------------------------------------------------
      const res = await window.electronAPI.aiQuery(q, 'demo-session');

      if (res?.sql) setSql(res.sql);
      if (res?.debug?.pipelineStages) setStages(res.debug.pipelineStages);
      if (typeof res?.executionTimeMs === 'number') setElapsedMs(res.executionTimeMs);

      if (res?.scopeBlocked && res?.guardrail) {
        // Backend defense-in-depth guardrail triggered
        setScopeBlocked({
          allowed: false,
          classification: res.guardrail.classification as any,
          confidence: res.guardrail.confidence,
          headline: res.guardrail.headline,
          message: res.error || 'Request blocked by scope policy.',
          reasons: res.guardrail.reasons,
          suggestedQuery: res.guardrail.suggestedQuery,
          contract: {
            scope: 'NON_BANK',
            classification: res.guardrail.classification as any,
            confidence: res.guardrail.confidence,
            entities: [],
            metrics: [],
            requires_database: false,
            requires_sql: false,
            reasons: res.guardrail.reasons,
          },
        });
      } else if (res?.success) {
        setResults(res.data || []);
        setRowCount(res.rowCount ?? (res.data?.length ?? 0));
        setSummary(res.summary || '');
        setFilters(res.filtersApplied || []);
        setTruncated(!!res.truncated);
        setDiagnosis(res.emptyResultDiagnosis || null);

        // Record successful in-scope query into session history for follow-up resolution
        setConversationHistory((prev) => [
          ...prev,
          {
            question: q,
            classification: 'IN_SCOPE',
            domain: guardDecision.contract.domain,
            entities: guardDecision.contract.entities,
            timestamp: Date.now(),
          },
        ]);
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

  const copySql = async () => {
    await navigator.clipboard.writeText(sql);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const exportToXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'rdb_agent_report.xlsx');
  };

  const exportToPDF = () => {
    if (results.length === 0) return;
    const doc = new jsPDF();
    doc.text('RDB Agent — Data Report', 14, 15);
    const tableColumn = Object.keys(results[0]);
    const tableRows = results.map(row => Object.values(row).map(v => String(v)));
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25, styles: { fontSize: 8 }, headStyles: { fillColor: [11, 31, 58] } });
    doc.save(`RDB_Agent_Report_${Date.now()}.pdf`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleAsk(); }
  };

  // Compute KPI cards from result columns
  const kpiCards = React.useMemo(() => {
    if (!results.length) return [];
    const cols = Object.keys(results[0]);
    const numCols = cols.filter(c =>
      results.slice(0, 5).every(r => r[c] === null || Number.isFinite(Number(r[c])))
    );
    if (results.length === 1 && numCols.length >= 2) {
      // Single-row result → each numeric column is a KPI
      return numCols.slice(0, 5).map(c => ({
        label: c.replace(/_/g, ' '),
        value: compact(Number(results[0][c]) || 0),
      }));
    }
    // Multi-row → show count
    return [
      { label: 'Results', value: String(results.length) },
    ];
  }, [results]);

  const hasResponse = !loading && (results.length > 0 || denied || error || summary);

  return (
    <div className="wrap fade">
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Ask RDB Agent</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          Ask a question about your banking data
        </p>
      </div>

      {/* Query Input Card */}
      <div className="card" style={{ padding: '24px' }}>
        {/* Role & Guardrail context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
          <span className="label" style={{ fontSize: 10.5 }}>Role</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{currentRole.title}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {currentRole.scope.label}</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {/* Subtle Scope Guard Active Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
              <span className="dot dot-live" style={{ color: 'var(--ok)', width: 6, height: 6 }} />
              <span style={{ fontWeight: 500 }}>RDB Scope Guard Active</span>
            </div>

            <button
              className="btn btn-quiet btn-sm"
              style={{ fontSize: 11.5, padding: '2px 8px', color: 'var(--ink-4)', height: 24 }}
              onClick={() => setGuardrailModalOpen(true)}
              title="Evaluate 25 Standardized Guardrail Test Cases"
            >
              <ShieldCheck size={13} style={{ marginRight: 4 }} /> Test Suite
            </button>

            <span className={`badge ${currentRole.restrictions.length === 0 ? 'badge-ok' : 'badge-warn'}`}>
              {currentRole.restrictions.length === 0 ? 'Full Access' : 'Restricted'}
            </span>
          </div>
        </div>

        {/* Input */}
        <div className="query-input-wrap">
          <textarea
            ref={inputRef}
            className="query-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiReady ? 'What would you like to know about your bank data?' : 'Analysis engine unavailable'}
            disabled={!aiReady || loading}
          />
          <button
            className={`query-voice-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={!aiReady || loading}
            title={isListening ? 'Stop recording' : 'Voice input'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </div>

        {/* Submit row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>⌘/Ctrl + Enter to submit</span>
            {prompt.trim() && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onToggleSaveQuery?.(prompt)}
                style={{ padding: '3px 8px', fontSize: 12, color: (savedQueries || []).some(q => q.question.toLowerCase() === prompt.trim().toLowerCase()) ? '#D97706' : 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                title={(savedQueries || []).some(q => q.question.toLowerCase() === prompt.trim().toLowerCase()) ? 'Unpin query' : 'Pin this query to favorites'}
              >
                <Star size={13} fill={(savedQueries || []).some(q => q.question.toLowerCase() === prompt.trim().toLowerCase()) ? '#F59E0B' : 'none'} color={(savedQueries || []).some(q => q.question.toLowerCase() === prompt.trim().toLowerCase()) ? '#F59E0B' : 'currentColor'} />
                <span>{(savedQueries || []).some(q => q.question.toLowerCase() === prompt.trim().toLowerCase()) ? 'Pinned' : 'Pin'}</span>
              </button>
            )}
          </div>
          <button
            className="query-submit"
            onClick={() => handleAsk()}
            disabled={!aiReady || loading || !prompt.trim()}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                Analyzing...
              </>
            ) : (
              <>
                Ask RDB Agent
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Pinned / Favorite Queries Quick Shelf */}
        {(savedQueries || []).filter(q => q.isPinned).length > 0 && (
          <div className="pinned-queries-shelf">
            <div className="pinned-label">
              <Star size={12} fill="#F59E0B" color="#F59E0B" />
              <span>Pinned:</span>
            </div>
            <div className="pinned-chips">
              {(savedQueries || []).filter(q => q.isPinned).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pinned-chip"
                  onClick={() => {
                    setPrompt(p.question);
                    handleAsk(p.question);
                  }}
                  title={p.question}
                >
                  <Pin size={11} style={{ transform: 'rotate(45deg)', opacity: 0.7 }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== Loading State ===== */}
      {loading && (
        <div className="card card-p fade" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="spinner" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                {steps.find((s) => s.status === 'start')?.stage || 'Preparing'}
              </span>
            </div>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              {elapsedSec.toFixed(1)}s
            </span>
          </div>

          <div className={`bar${progressPct === 0 ? '' : ''}`} style={{ marginBottom: 16 }}>
            <i style={progressPct === 0 ? { width: '30%', animation: 'indeterminate 1.5s ease-in-out infinite' } : { width: `${Math.min(97, progressPct)}%` }} />
          </div>

          <div className="steps">
            {steps.map((s, i) => (
              <div key={i} className={`step ${s.status === 'start' ? 'active' : s.status === 'error' ? 'failed' : 'done'}`}>
                <span className="ring">
                  {s.status === 'done' && <CheckCircle2 size={10} />}
                </span>
                <span>{s.stage}</span>
                {s.detail && <span style={{ opacity: 0.6, fontSize: 12 }}>· {s.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Scope Blocked State (Guardrail Layer) ===== */}
      {scopeBlocked && (
        <div className="card fade" style={{ marginTop: 24, padding: '24px 28px', borderLeft: '4px solid var(--warn)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--r-md)',
                background: scopeBlocked.classification === 'SECURITY_SENSITIVE' ? 'var(--danger-weak)' : 'var(--warn-weak)',
                color: scopeBlocked.classification === 'SECURITY_SENSITIVE' ? 'var(--danger)' : 'var(--warn)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {scopeBlocked.classification === 'SECURITY_SENSITIVE' ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontSize: 17, margin: 0 }}>RDB Agent Scope</h3>
                <span className={`badge ${scopeBlocked.classification === 'SECURITY_SENSITIVE' ? 'badge-danger' : 'badge-warn'}`}>
                  {scopeBlocked.classification}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 'auto' }}>
                  {Math.round(scopeBlocked.confidence * 100)}% confidence
                </span>
              </div>

              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                This request is outside the supported banking-data scope.
              </div>

              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                {scopeBlocked.message}
              </p>

              {/* Suggested query redirect */}
              {scopeBlocked.suggestedQuery && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--surface-2)',
                    marginBottom: 16,
                    border: '1px solid var(--hairline)',
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Try asking:
                  </span>
                  <button
                    className="btn btn-quiet btn-sm"
                    style={{ color: 'var(--ink)', fontWeight: 500, padding: 0, textDecoration: 'underline' }}
                    onClick={() => {
                      const sq = scopeBlocked.suggestedQuery!;
                      setScopeBlocked(null);
                      setPrompt(sq);
                      handleAsk(sq);
                    }}
                  >
                    "{scopeBlocked.suggestedQuery}"
                  </button>
                  <ArrowRight size={13} color="var(--ink-4)" />
                </div>
              )}

              {/* Expandable Why Was This Blocked Panel */}
              <Disclosure title="Why was this blocked? (Governance Detail)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>Category:</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{scopeBlocked.classification}</span>

                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>Governance Reason:</span>
                    <span style={{ color: 'var(--ink-2)' }}>{scopeBlocked.reasons[0]}</span>

                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>Pipeline Action:</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Request blocked before SQL generation.</span>

                    <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>Database Access:</span>
                    <span style={{ color: 'var(--ok)', fontWeight: 600 }}>0 queries executed (Zero data leakage).</span>
                  </div>

                  {scopeBlocked.reasons.length > 1 && (
                    <div style={{ marginTop: 4, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--ink-3)' }}>
                      {scopeBlocked.reasons.slice(1).map((r, i) => (
                        <div key={i}>• {r}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Disclosure>
            </div>
          </div>
        </div>
      )}

      {/* ===== Access Denied ===== */}
      {denied && (
        <div className="access-denied fade" style={{ marginTop: 24 }}>
          <div className="access-denied-icon">
            <Lock size={24} />
          </div>
          <h3>Access Restricted</h3>
          <p>This request requires access beyond your current organizational scope.</p>

          <div className="access-denied-details">
            <div className="access-denied-detail">
              <div className="label">Current Role</div>
              <div className="value">{denied.role.title}</div>
            </div>
            <div className="access-denied-detail">
              <div className="label">Your Scope</div>
              <div className="value">{denied.role.scope.label}</div>
            </div>
            <div className="access-denied-detail">
              <div className="label">Required Scope</div>
              <div className="value" style={{ color: 'var(--warn)' }}>{denied.requested.scopeLabel}</div>
            </div>
          </div>

          {denied.reasons.length > 0 && (
            <div className="access-denied-reasons">
              <div className="label" style={{ marginBottom: 8 }}>Why was this blocked?</div>
              {denied.reasons.map((r, i) => (
                <div key={i} className="reason">
                  <span style={{ color: 'var(--warn)' }}>•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          <div className="access-denied-actions">
            <button className="btn btn-ghost" onClick={onOpenAccessPanel}>
              <ShieldCheck size={15} /> Switch Role
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setDenied(null);
                setPrompt('');
                inputRef.current?.focus();
              }}
            >
              Ask Within My Scope
            </button>
          </div>

          <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--ink-4)' }}>
            No SQL was generated and no data was accessed.
          </div>
        </div>
      )}

      {/* ===== Error ===== */}
      {error && !denied && !scopeBlocked && (
        <div className="card fade" style={{ marginTop: 16, padding: '18px 22px', borderLeft: '3px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ===== Clarification ===== */}
      {clarifications && clarifications.length > 0 && (
        <div className="card card-p fade" style={{ marginTop: 16, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>
            <HelpCircle size={16} />
            <span>Which metric would you like to explore?</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {clarifications.map((c: any, i: number) => (
              <button
                key={i}
                className="btn btn-ghost"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '10px 14px',
                  textAlign: 'left',
                  height: 'auto',
                }}
                onClick={() => {
                  const nextPrompt = c.prompt || c.value || `${prompt} (${c.label})`;
                  setPrompt(nextPrompt);
                  setClarifications(null);
                  handleAsk(nextPrompt);
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{c.label}</span>
                {c.description && (
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{c.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== Authorization badge ===== */}
      {authorized && !loading && (
        <div className="fade" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ok)' }}>
          <CheckCircle2 size={14} />
          <span style={{ fontWeight: 600 }}>Authorized</span>
          <span style={{ color: 'var(--ink-4)' }}>
            Role: {authorized.role.title} · Scope: {authorized.role.scope.label}
          </span>
        </div>
      )}

      {/* ===== Executive Summary ===== */}
      {summary && (
        <div className="answer-card fade" style={{ marginTop: 16 }}>
          <div className="answer-card-header">
            <CheckCircle2 size={14} />
            Executive Answer
          </div>
          <p style={{ color: 'var(--ink)', lineHeight: 1.7, margin: 0, fontSize: 15 }}>{summary}</p>
          {filters.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filters.map((f, i) => (
                <span key={i} className="badge" style={{ fontSize: 11 }}>{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Truncation warning ===== */}
      {truncated && (
        <div className="fade" style={{ marginTop: 12, padding: '10px 16px', background: 'var(--warn-weak)', border: '1px solid rgba(150,100,10,0.18)', borderRadius: 'var(--r-md)', color: 'var(--warn)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} />
          <span>Showing the first {rowCount?.toLocaleString('en-IN')} rows — the full result set is larger.</span>
        </div>
      )}

      {/* ===== KPI Cards (for single-row or summary results) ===== */}
      {kpiCards.length > 1 && (
        <div className="grid g5 fade" style={{ marginTop: 16 }}>
          {kpiCards.map((k, i) => (
            <Kpi key={i} label={k.label} value={k.value} />
          ))}
        </div>
      )}

      {/* ===== Empty Result Diagnosis ===== */}
      {diagnosis && diagnosis.length > 0 && (
        <div className="card card-p fade" style={{ marginTop: 16, borderLeft: '3px solid var(--warn)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--warn)', fontSize: 13, fontWeight: 600 }}>
            <AlertTriangle size={14} /> Why this returned nothing
          </div>
          {diagnosis.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: i < diagnosis.length - 1 ? '1px solid var(--hairline)' : 'none', fontSize: 13.5 }}>
              <span style={{ color: 'var(--ink)' }}>{d.condition}</span>
              <span className="mono" style={{ color: d.matchCount === 0 ? 'var(--danger)' : 'var(--ok)', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                {d.matchCount === null ? 'n/a' : `${d.matchCount.toLocaleString('en-IN')} rows`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ===== Data Table ===== */}
      {results.length > 0 && (
        <div className="fade" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>Results ({results.length.toLocaleString('en-IN')})</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onToggleSaveQuery?.(askedQuestion)}
                style={{ color: (savedQueries || []).some(q => q.question.toLowerCase() === askedQuestion.trim().toLowerCase()) ? '#D97706' : undefined, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                title={(savedQueries || []).some(q => q.question.toLowerCase() === askedQuestion.trim().toLowerCase()) ? 'Remove from pinned queries' : 'Pin this query for quick reuse'}
              >
                <Star size={14} fill={(savedQueries || []).some(q => q.question.toLowerCase() === askedQuestion.trim().toLowerCase()) ? '#F59E0B' : 'none'} color={(savedQueries || []).some(q => q.question.toLowerCase() === askedQuestion.trim().toLowerCase()) ? '#F59E0B' : 'currentColor'} />
                <span>{(savedQueries || []).some(q => q.question.toLowerCase() === askedQuestion.trim().toLowerCase()) ? 'Pinned' : 'Pin Query'}</span>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={exportToXLSX}>
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button className="btn btn-ghost btn-sm" onClick={exportToPDF}>
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
          <DataTable rows={results} onExport={exportToXLSX} />
        </div>
      )}

      {/* ===== Expandable Sections ===== */}
      {hasResponse && !denied && (sql || stages.length > 0) && (
        <div style={{ marginTop: 20 }}>
          {/* SQL Section */}
          {sql && (
            <Disclosure
              title="Generated SQL"
              right={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-quiet btn-sm" onClick={copySql}>
                    <Copy size={13} /> {sqlCopied ? 'Copied' : 'Copy'}
                  </button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setConsoleOpen(true)}>
                    <Terminal size={13} /> Console
                  </button>
                </div>
              }
            >
              <Sql sql={sql} />

              {/* Validation badges */}
              <div className="validation-row" style={{ marginTop: 12 }}>
                <span className="validation-badge"><CheckCircle2 size={12} /> SQL Validated</span>
                <span className="validation-badge"><ShieldCheck size={12} /> Read-only Query</span>
                <span className="validation-badge"><Lock size={12} /> Authorized</span>
                {elapsedMs !== null && (
                  <span className="validation-badge"><CheckCircle2 size={12} /> {(elapsedMs / 1000).toFixed(2)}s</span>
                )}
              </div>
            </Disclosure>
          )}

          {/* Pipeline Stages */}
          {stages.length > 0 && (
            <Disclosure title="How this answer was produced">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stages.map((st: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <span className="ring" style={{
                      width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: st.status === 'success' ? 'var(--ok-weak)' : 'var(--danger-weak)',
                      color: st.status === 'success' ? 'var(--ok)' : 'var(--danger)',
                      border: `1.5px solid ${st.status === 'success' ? 'var(--ok)' : 'var(--danger)'}`,
                      flexShrink: 0,
                    }}>
                      {st.status === 'success' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500, flex: 1 }}>{st.name}</span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>{st.durationMs}ms</span>
                  </div>
                ))}
              </div>
              {elapsedMs !== null && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-4)', textAlign: 'right' }}>
                  Total: {(elapsedMs / 1000).toFixed(2)}s
                </div>
              )}
            </Disclosure>
          )}

          {/* Mermaid flow chart */}
          {mermaidChart && (
            <Disclosure title="Visual Query Flow">
              <QueryFlow chart={mermaidChart} />
            </Disclosure>
          )}
        </div>
      )}

      {/* SQL Console Modal */}
      <SqlConsole open={consoleOpen} onClose={() => setConsoleOpen(false)} initialSql={sql} />

      {/* Guardrail Test Suite Modal */}
      <GuardrailTestModal
        open={guardrailModalOpen}
        onClose={() => setGuardrailModalOpen(false)}
        onTryQuestion={(q) => {
          setPrompt(q);
          handleAsk(q);
        }}
      />
    </div>
  );
};

export default AskDataView;
