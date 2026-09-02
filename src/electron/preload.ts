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
  settingsGetAll: () => ipcRenderer.invoke('settings:get-all'),
  settingsSet: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),

  // Voice Pro (Whisper)
  voiceTranscribe: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('voice:transcribe', audioBuffer),

  // ---------------------------------------------------------------------------
  // AI Pipeline — Natural Language → SQL
  // ---------------------------------------------------------------------------
  // Full NL → SQL pipeline: semantic resolution → schema retrieval → Qwen → SQL validation → DB → result
  aiQuery: (question: string, sessionId?: string) => ipcRenderer.invoke('ai:query', question, sessionId),
  // Health check: database + LLM + schema status
  aiHealth: () => ipcRenderer.invoke('ai:health'),
  // Audit log retrieval
  aiAudit: (limit?: number) => ipcRenderer.invoke('ai:audit', limit),
  // Schema preview for debug panel
  aiSchemaPreview: (question: string) => ipcRenderer.invoke('ai:schema-preview', question),
});
