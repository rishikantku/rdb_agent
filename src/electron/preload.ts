import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  dbConnect: (connectionString?: string) => ipcRenderer.invoke('db:connect', connectionString),
  dbQuery: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
  dbGetSchema: () => ipcRenderer.invoke('db:get-schema'),
  dbSelectFile: () => ipcRenderer.invoke('db:select-file'),
  
  // New Multi-DB IPC
  dbSaveConfig: (config: any) => ipcRenderer.invoke('db:save-config', config),
  dbGetConfigs: () => ipcRenderer.invoke('db:get-configs'),
  dbDeleteConfig: (id: string) => ipcRenderer.invoke('db:delete-config', id),
  dbConnectConfig: (id: string) => ipcRenderer.invoke('db:connect-config', id),
  dbTestConnection: (config: any) => ipcRenderer.invoke('db:test-connection', config),

  settingsGet: (key: string) => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
});
