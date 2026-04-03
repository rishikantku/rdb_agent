import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Landmark, CreditCard, Activity, Database, FolderOpen, Search, Play, FileSpreadsheet, FileText,
  Terminal, ShieldAlert, PlusCircle, Database as DatabaseIcon, Settings2, Trash2, Box, Layers, BarChart3,
  Network, Mic, MicOff
} from 'lucide-react';
import { convertNLtoSQL } from '../lib/gemini';
import { convertNLtoSQLOpenAI } from '../lib/openai';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConnectionModal from './ConnectionModal';
import QueryFlow from './QueryFlow';

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
  const [schema, setSchema] = useState<any>(null);
  const [dbName, setDbName] = useState<string>('Disconnected');
  const [configs, setConfigs] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cards, setCards] = useState<StatCardProps[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => { loadConfigs(); }, []);

  useEffect(() => {
    if (externalConnected) fetchDataAfterConnect();
    else { setCards([]); setSchema(null); }
  }, [externalConnected]);

  const loadConfigs = async () => {
    const res = await window.electronAPI.dbGetConfigs();
    setConfigs(res || []);
  };

  const handleSwitch = async (id: string) => {
    if (id === 'add-new') { setIsModalOpen(true); return; }
    setLoading(true); setError(null); setResults([]); setSql(''); setMermaidChart('');
    try {
      if (id === 'load-sample') {
        const res = await window.electronAPI.dbConnect();
        if (res.success) { setActiveId('load-sample'); setDbName('Nexus Banking DB'); onConnectionChange(true, 'Nexus Banking DB'); await fetchDataAfterConnect(); }
        else throw new Error(res.error);
      } else {
        const res = await window.electronAPI.dbConnectConfig(id);
        if (res.success) {
          const config = configs.find(c => c.id === id);
          setActiveId(id); setDbName(config.name); onConnectionChange(true, config.name); await fetchDataAfterConnect();
        } else throw new Error(res.error);
      }
    } catch (err: any) { setError(`Connection Failed: ${err.message}`); onConnectionChange(false); }
    setLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'load-sample') return;
    if (confirm('Delete this connection?')) {
      await window.electronAPI.dbDeleteConfig(id); loadConfigs();
      if (activeId === id) { onConnectionChange(false); setActiveId(''); setDbName('Disconnected'); }
    }
  };

  const fetchDataAfterConnect = async () => {
    setLoading(true);
    const schemaRes = await window.electronAPI.dbGetSchema();
    if (schemaRes.success) { setSchema(schemaRes.data); await generateMetrics(schemaRes.data); }
    setLoading(false);
  };

  const generateMetrics = async (currentSchema: any) => {
    const tableNames = (currentSchema.tables || []).map((t: any) => t.name.toLowerCase());
    const isBanking = tableNames.includes('customers') && tableNames.includes('accounts');
    if (isBanking) {
      try {
        const customers = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM Customers');
        const accounts = await window.electronAPI.dbQuery('SELECT COUNT(*) as count, SUM(balance) as total FROM Accounts');
        const trans = await window.electronAPI.dbQuery('SELECT COUNT(*) as count FROM Transactions');
        setCards([
          { title: 'Total Customers', value: customers.data?.[0]?.count || 0, icon: <Users size={20} />, trend: '+12%', positive: true },
          { title: 'Active Accounts', value: accounts.data?.[0]?.count || 0, icon: <Landmark size={20} />, trend: '+5%', positive: true },
          { title: 'Liquidity', value: `₹${((accounts.data?.[0]?.total || 0) / 1000000).toFixed(1)}M`, icon: <CreditCard size={20} />, trend: '-2%', positive: false },
          { title: 'Activity', value: trans.data?.[0]?.count || 0, icon: <Activity size={20} />, trend: '+28%', positive: true },
        ]);
        return;
      } catch (e) { console.warn('Banking stats failed'); }
    }
    try {
      const tableCount = currentSchema.tables.length; const viewCount = currentSchema.views.length;
      let totalRows = 0; const sampleTables = currentSchema.tables.slice(0, 5);
      for (const t of sampleTables) { const res = await window.electronAPI.dbQuery(`SELECT COUNT(*) as count FROM ${t.name}`); totalRows += res.data?.[0]?.count || 0; }
      setCards([
        { title: 'Total Tables', value: tableCount, icon: <Box size={20} />, trend: 'Schema Root', positive: true },
        { title: 'Total Views', value: viewCount, icon: <Layers size={20} />, trend: 'Virtual', positive: true },
        { title: 'Sampling Records', value: totalRows >= 1000 ? `${(totalRows / 1000).toFixed(1)}k` : totalRows, icon: <BarChart3 size={20} />, trend: 'Top 5 Tables', positive: true },
        { title: 'Env Capacity', value: `${tableNames.length * 12} Objects`, icon: <DatabaseIcon size={20} />, trend: 'Healthy', positive: true },
      ]);
    } catch (e) { console.error('Generic stats failed'); }
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

  const handleGenerateSQL = async () => {
    setLoading(true); setResults([]); setSql(''); setMermaidChart(''); setError(null);
    try {
      const provider = await window.electronAPI.settingsGet('llmProvider') || 'gemini';
      const geminiKey = await window.electronAPI.settingsGet('geminiAPIKey');
      const openaiKey = await window.electronAPI.settingsGet('openaiAPIKey');
      if (!schema) throw new Error('Connect a database first.');
      const res = provider === 'gemini' 
        ? await convertNLtoSQL(prompt, schema, geminiKey || '') 
        : await convertNLtoSQLOpenAI(prompt, schema, openaiKey || '');
      setSql(res.sql);
      setMermaidChart(res.mermaid);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const handleExecute = async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.dbQuery(sql);
      if (res.success) { if (res.data && res.data.length > 0) setResults(res.data); else setError("No records found."); }
      else throw new Error(res.error);
    } catch (err: any) { setError(`Execution Error: ${err.message}`); }
    setLoading(false);
  };

  const exportToXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(results); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results"); XLSX.writeFile(wb, "nexus_report.xlsx");
  };

  const exportToPDF = () => {
    if (results.length === 0) return;
    const doc = new jsPDF(); doc.text(`Nexus Data Report`, 14, 15);
    const tableColumn = Object.keys(results[0]); const tableRows = results.map(row => Object.values(row).map(v => String(v)));
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25, styles: { fontSize: 8 }, headStyles: { fillColor: [10, 25, 47] } });
    doc.save(`Nexus_Report_${Date.now()}.pdf`);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Nexus Command Center</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8892b0', fontSize: '0.9rem' }}>
            <DatabaseIcon size={14} color={externalConnected ? '#64ffda' : '#8892b0'} />
            <span>{externalConnected ? `Environment: ${dbName}` : 'Select an environment to begin.'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', padding: '0.2rem 0.5rem', background: 'rgba(10, 25, 47, 0.5)' }}>
            <Settings2 size={16} style={{ margin: '0 8px', color: '#8892b0' }} />
            <select value={activeId} onChange={(e) => handleSwitch(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#e6f1ff', padding: '0.5rem', outline: 'none', fontSize: '0.85rem' }}>
              <option value="" disabled>Select Environment...</option>
              <option value="load-sample">🌟 Nexus Banking DB</option>
              <hr />
              {configs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              <option value="add-new">+ Add New Connection</option>
            </select>
          </div>
          {activeId && activeId !== 'load-sample' && <button onClick={(e) => handleDelete(activeId, e)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.7rem' }}><Trash2 size={16} /></button>}
        </div>
      </div>

      {error && <div className="glass fade-in" style={{ padding: '1rem', borderLeft: '4px solid #ef4444', color: '#ef4444', display: 'flex', gap: '10px', marginBottom: '1.5rem' }}><ShieldAlert size={20} /><span>{error}</span></div>}

      <div className="glass" style={{ padding: '2rem', marginBottom: '2rem', background: 'rgba(17, 34, 64, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} color={externalConnected ? "#64ffda" : "#8892b0"} />
            <h3 style={{ margin: 0 }}>Natural Language Diagnostics</h3>
            {externalConnected && <span className="badge badge-active" style={{ marginLeft: '10px', background: 'rgba(100, 255, 218, 0.2)' }}>AI READY</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#8892b0' }}>
            <input 
              type="checkbox" 
              id="vi-strategy" 
              checked={includeVisualStrategy} 
              onChange={(e) => setIncludeVisualStrategy(e.target.checked)}
              style={{ accentColor: '#64ffda', cursor: 'pointer' }}
            />
            <label htmlFor="vi-strategy" style={{ cursor: 'pointer' }}>Include Visual Implementation Strategy</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea 
              value={prompt} 
              onChange={(e) => setPrompt(e.target.value)} 
              placeholder={externalConnected ? "What can I analyze for you today?" : "Select an environment first."} 
              disabled={!externalConnected || loading} 
              style={{ minHeight: '80px', width: '100%', paddingRight: '45px' }} 
            />
            <button
              onClick={toggleListening}
              className={isListening ? 'mic-pulse' : ''}
              disabled={!externalConnected || loading}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(10, 25, 47, 0.8)',
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
              {isListening ? <MicOff size={18} color="#64ffda" /> : <Mic size={18} color="#8892b0" />}
            </button>
          </div>
          <button onClick={handleGenerateSQL} disabled={!externalConnected || loading || !prompt} style={{ padding: '0 2rem', height: '80px' }}>{loading ? '...' : <Search size={24} />}</button>
        </div>

        {sql && (
          <div className="fade-in" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64ffda', display: 'flex', alignItems: 'center', gap: '5px' }}><Terminal size={14} /> Suggested Action</span>
                {mermaidChart && includeVisualStrategy && (
                  <button 
                    onClick={() => setShowFlow(!showFlow)}
                    style={{ background: 'rgba(100,255,218,0.1)', border: '1px solid rgba(100,255,218,0.3)', color: '#64ffda', padding: '0.3rem 0.6rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Network size={12} /> {showFlow ? 'Hide Flow' : 'Show Flow'}
                  </button>
                )}
              </div>
              <button onClick={handleExecute} style={{ background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}><Play size={16} fill="white" /> Run</button>
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '5px', color: '#64ffda', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sql}</pre>
            
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>{cards.map((card, i) => <StatCard key={i} {...card} />)}</div>
        </div>
      ) : <div className="glass" style={{ padding: '4rem', textAlign: 'center' }}><DatabaseIcon size={64} style={{ marginBottom: '1rem', opacity: 0.2 }} /><h3>No Environment Selected</h3><p>Please select a database environment above to view performance metrics.</p></div>}
      <ConnectionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={loadConfigs} />
    </div>
  );
};

const StatCard = ({ title, value, icon, trend, positive }: StatCardProps) => (
  <div className="glass" style={{ padding: '1.5rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}><div style={{ color: '#64ffda' }}>{icon}</div><div style={{ fontSize: '0.8rem', color: positive ? '#10b981' : '#ef4444' }}>{trend}</div></div>
    <div style={{ fontSize: '0.8rem', color: '#text-dim' }}>{title}</div><div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e6f1ff' }}>{value}</div>
  </div>
);

export default Dashboard;
