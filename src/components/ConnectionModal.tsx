import { useState } from 'react';
import { Database, X, CheckCircle, AlertCircle, FileSearch } from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({ isOpen, onClose, onSave }) => {
  const [type, setType] = useState<'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'oracle'>('sqlite');
  const [name, setName] = useState('');
  const [details, setDetails] = useState<any>({
    host: 'localhost',
    port: 5432,
    user: '',
    password: '',
    database: '',
    path: ''
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await window.electronAPI.dbTestConnection({ type, details });
    if (res.success) {
      setTestResult({ success: true, msg: 'Connection Successful!' });
    } else {
      setTestResult({ success: false, msg: res.error || 'Failed to connect.' });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!name) return alert('Please provide a name for this connection.');
    await window.electronAPI.dbSaveConfig({ name, type, details });
    onSave();
    onClose();
  };

  const browseFile = async () => {
    const path = await window.electronAPI.dbSelectFile();
    if (path) setDetails({ ...details, path });
  };

  const updateType = (newType: typeof type) => {
    setType(newType);
    let port = 5432;
    if (newType === 'mysql') port = 3306;
    if (newType === 'mssql') port = 1433;
    if (newType === 'oracle') port = 1521;
    setDetails({ ...details, port });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
      <div className="glass fade-in" style={{ width: '520px', padding: '2rem', position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', color: 'var(--ink-3)' }}>
          <X size={20} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database color="var(--accent)" /> Create New Connection
        </h2>
        <p style={{ color: 'var(--ink-3)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Add a new database environment to your Command Center.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Connection Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Oracle Production / SQL Server" />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Database Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(['sqlite', 'postgres', 'mysql', 'mssql', 'oracle'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => updateType(t)}
                  style={{
                    padding: '0.5rem',
                    background: type === t ? 'var(--accent-weak)' : 'transparent',
                    border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                    color: type === t ? 'var(--accent)' : 'var(--ink-3)',
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {type === 'sqlite' ? (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Database File Path</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={details.path} readOnly style={{ flex: 1, fontSize: '0.8rem' }} placeholder="/path/to/database.db" />
                <button onClick={browseFile} style={{ padding: '0.5rem', background: 'var(--primary-light)', border: '1px solid var(--border)' }}>
                  <FileSearch size={18} color="var(--accent)" />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Host / Endpoint</label>
                <input value={details.host} onChange={e => setDetails({ ...details, host: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Port</label>
                <input type="number" value={details.port} onChange={e => setDetails({ ...details, port: parseInt(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Database / SID</label>
                <input value={details.database} onChange={e => setDetails({ ...details, database: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>User</label>
                <input value={details.user} onChange={e => setDetails({ ...details, user: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--accent)', display: 'block', marginBottom: '0.4rem' }}>Password</label>
                <input type="password" value={details.password} onChange={e => setDetails({ ...details, password: e.target.value })} />
              </div>
            </div>
          )}

          {testResult && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              color: testResult.success ? 'var(--success)' : 'var(--danger)', 
              fontSize: '0.8rem', padding: '0.6rem', 
              background: testResult.success ? 'var(--success-weak)' : 'var(--danger-weak)',
              borderRadius: '6px', border: `1px solid ${testResult.success ? 'var(--success)' : 'var(--danger)'}`
            }}>
              {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {testResult.msg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              onClick={handleTest} 
              disabled={testing}
              style={{ flex: 1, background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}
            >
              {testing ? 'Verifying...' : 'Test Link'}
            </button>
            <button 
              onClick={handleSave}
              style={{ flex: 1 }}
            >
              Save Environment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionModal;
