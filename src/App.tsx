import React, { useState } from 'react';
import { Database, Settings as SettingsIcon, LayoutDashboard, DatabaseZap } from 'lucide-react';
import Settings from './components/Settings';
import SchemaExplorer from './components/SchemaExplorer';
import Dashboard from './components/Dashboard';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; path?: string }>({ connected: false });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & AI', icon: LayoutDashboard },
    { id: 'explorer', label: 'Schema Explorer', icon: Database },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleConnectionChange = (connected: boolean, path?: string) => {
    setDbStatus({ connected, path });
  };

  return (
    <div style={{ display: 'flex', width: '100vw' }}>
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
          <DatabaseZap size={32} color="var(--accent)" />
          <h2 style={{ fontSize: '1.2rem', margin: 0 }} className="nexus-gold">Nexus RDBMS Agent</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <span style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: dbStatus.connected ? 'var(--success)' : 'var(--danger)' 
            }} />
            {dbStatus.connected ? 'Active DB' : 'Disconnected'}
          </div>
          {dbStatus.path && (
            <div style={{ fontSize: '0.65rem', marginTop: '5px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dbStatus.path.split('/').pop()}
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <div className="fade-in">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onConnectionChange={handleConnectionChange} 
              externalConnected={dbStatus.connected}
            />
          )}
          {activeTab === 'explorer' && <SchemaExplorer />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
};

export default App;
