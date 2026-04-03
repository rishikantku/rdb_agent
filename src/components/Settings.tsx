import { useState, useEffect } from 'react';
import { Save, Key, ShieldCheck, Globe, Cpu } from 'lucide-react';

const Settings = () => {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedGemini = await window.electronAPI.settingsGet('geminiAPIKey');
    const savedOpenai = await window.electronAPI.settingsGet('openaiAPIKey');
    const savedProvider = await window.electronAPI.settingsGet('llmProvider');
    
    if (savedGemini) setGeminiKey(savedGemini);
    if (savedOpenai) setOpenaiKey(savedOpenai);
    if (savedProvider) setProvider(savedProvider);
  };

  const handleSave = async () => {
    await window.electronAPI.settingsSet('geminiAPIKey', geminiKey);
    await window.electronAPI.settingsSet('openaiAPIKey', openaiKey);
    await window.electronAPI.settingsSet('llmProvider', provider);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="fade-in">
      <h1>Settings</h1>
      
      <div className="glass" style={{ padding: '2rem', maxWidth: '650px' }}>
        <h3 style={{ marginBottom: '1.5rem', color: '#fbbf24' }}>AI Model Provider</h3>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <div 
            onClick={() => setProvider('gemini')}
            className={`glass ${provider === 'gemini' ? 'active' : ''}`}
            style={{ 
              flex: 1, padding: '1rem', cursor: 'pointer', 
              border: provider === 'gemini' ? '2px solid #64ffda' : '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
            }}
          >
            <Cpu size={24} color={provider === 'gemini' ? '#64ffda' : '#8892b0'} />
            <span style={{ fontWeight: 600 }}>Google Gemini</span>
          </div>
          <div 
            onClick={() => setProvider('openai')}
            className={`glass ${provider === 'openai' ? 'active' : ''}`}
            style={{ 
              flex: 1, padding: '1rem', cursor: 'pointer', 
              border: provider === 'openai' ? '2px solid #64ffda' : '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
            }}
          >
            <Globe size={24} color={provider === 'openai' ? '#64ffda' : '#8892b0'} />
            <span style={{ fontWeight: 600 }}>OpenAI</span>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#64ffda' }}>
            <Key size={18} /> Google Gemini API Key
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AI Key for Gemini..."
            style={{ marginBottom: '1rem' }}
          />
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#64ffda' }}>
            <Key size={18} /> OpenAI API Key
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="AI Key for OpenAI..."
          />
        </div>

        <button 
          onClick={handleSave} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}
        >
          <Save size={18} /> Save AI Configuration
        </button>

        {isSaved && (
          <div style={{ marginTop: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <ShieldCheck size={18} /> Configuration persistent!
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
