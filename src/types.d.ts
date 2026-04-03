export interface ElectronAPI {
  dbConnect: (connectionString?: string) => Promise<{ success: boolean; error?: string }>;
  dbQuery: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  dbGetSchema: () => Promise<{ success: boolean; data?: any; error?: string }>;
  dbSelectFile: () => Promise<string | null>;
  
  dbSaveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  dbGetConfigs: () => Promise<any[]>;
  dbDeleteConfig: (id: string) => Promise<{ success: boolean; error?: string }>;
  dbConnectConfig: (id: string) => Promise<{ success: boolean; error?: string }>;
  dbTestConnection: (config: any) => Promise<{ success: boolean; error?: string }>;

  settingsGet: (key: string) => Promise<any>;
  settingsSet: (key: string, value: any) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
