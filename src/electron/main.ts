import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';
import { Client as PGClient } from 'pg';
import mysql from 'mysql2/promise';
import mssql from 'mssql';
import oracledb from 'oracledb';
import fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ---------------------------------------------------------------------------
// AI Pipeline Services (lazy-initialized)
// ---------------------------------------------------------------------------
let aiServices: any = null;
let aiInitPromise: Promise<void> | null = null;

async function initAIServices(): Promise<void> {
  if (aiServices) return;
  if (aiInitPromise) { await aiInitPromise; return; }

  aiInitPromise = (async () => {
    try {
      // Dynamic import to avoid blocking app startup
      const { initializeBackend } = await import('../backend/init.js');
      const databaseDir = path.join(app.getAppPath(), 'database');
      // Fallback to workspace root if not in packaged app
      const resolvedDir = fs.existsSync(databaseDir)
        ? databaseDir
        : path.join(process.cwd(), 'database');

      aiServices = await initializeBackend({
        databaseDir: resolvedDir,
        auditDir: path.join(app.getPath('userData'), 'audit_logs'),
      });
      console.log('[AI] Pipeline initialized successfully');
    } catch (err: any) {
      console.error('[AI] Pipeline init failed:', err.message);
      // Don't throw — the app should still work for direct SQL
    }
  })();

  await aiInitPromise;
}

let mainWindow: BrowserWindow | null = null;
try { oracledb.initOracleClient(); } catch (e) { oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT; }

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings_v2.json');
const connectionsPath = path.join(userDataPath, 'connections.json');
const sampleDbPath = path.join(userDataPath, 'nexus_poc_v5.db'); 

let activeConnection: { type: string, instance: any } | null = null;
if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

function ensureSampleDatabase() {
  if (fs.existsSync(sampleDbPath)) return;
  try {
    const seedDb = new Database(sampleDbPath);
    seedDb.exec(`
      CREATE TABLE Departments (id INTEGER PRIMARY KEY, name TEXT, head TEXT);
      CREATE TABLE Branches (id INTEGER PRIMARY KEY, branch_name TEXT, ifsc_code TEXT UNIQUE, city TEXT, address TEXT);
      CREATE TABLE Customers (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT UNIQUE, phone TEXT, risk_score INTEGER DEFAULT 50, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE Accounts (id INTEGER PRIMARY KEY, customer_id INTEGER, branch_id INTEGER, account_number TEXT UNIQUE, balance REAL DEFAULT 0, status TEXT DEFAULT 'Active', FOREIGN KEY (customer_id) REFERENCES Customers(id));
      CREATE TABLE Transactions (id INTEGER PRIMARY KEY, account_id INTEGER, transaction_type TEXT, amount REAL, description TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (account_id) REFERENCES Accounts(id));
      CREATE TABLE Loans (id INTEGER PRIMARY KEY, customer_id INTEGER, loan_type TEXT, amount REAL, interest_rate REAL, status TEXT DEFAULT 'Active', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES Customers(id));
      CREATE TABLE AuditLogs (id INTEGER PRIMARY KEY, action TEXT, table_name TEXT, record_id INTEGER, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);

      INSERT INTO Departments (name, head) VALUES ('Operations', 'Rajesh K.'), ('Lending', 'Suman V.');
      INSERT INTO Branches (branch_name, ifsc_code, city) VALUES ('Nexus Main', 'NEXS001', 'Mumbai'), ('Nexus Central', 'NEXS002', 'Delhi');
    `);

    const insertCustomer = seedDb.prepare('INSERT INTO Customers (first_name, last_name, email) VALUES (?, ?, ?)');
    const insertAccount = seedDb.prepare('INSERT INTO Accounts (customer_id, branch_id, account_number, balance) VALUES (?, ?, ?, ?)');
    const insertTrans = seedDb.prepare('INSERT INTO Transactions (account_id, transaction_type, amount, description, timestamp) VALUES (?, ?, ?, ?, ?)');
    const insertLoan = seedDb.prepare('INSERT INTO Loans (customer_id, loan_type, amount, interest_rate, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
    const insertAudit = seedDb.prepare('INSERT INTO AuditLogs (action, table_name, record_id, timestamp) VALUES (?, ?, ?, ?)');

    const today = new Date().toISOString().split('T')[0];

    for (let i = 1; i <= 100; i++) {
        const cRes = insertCustomer.run(`Nexus_Agent`, `${i}`, `user${i}@nexus-data.com`);
        const cResId = cRes.lastInsertRowid;
        const aRes = insertAccount.run(cResId, (i % 2) + 1, `NEX-ACC-100${i}`, 1500000);
        const aResId = aRes.lastInsertRowid;

        // SEED VIP DATA
        if (i <= 5) {
          for (let j = 0; j < 12; j++) {
            const amount = 350000 + (j * 10000);
            const tRes = insertTrans.run(aResId, 'credit', amount, `VIP Transaction ${j}`, today + ' 10:00:00');
            insertAudit.run('INSERT', 'Transactions', tRes.lastInsertRowid, today + ' 10:00:00');
          }
          // ADD LOANS for top customers (Query requirement)
          insertLoan.run(cResId, 'Home Loan', 1500000 + (i * 100000), 8.5, 'Active', today + ' 09:00:00');
        } else {
          const tRes = insertTrans.run(aResId, 'credit', 2000, 'Initial Deposit', today + ' 11:00:00');
          insertAudit.run('INSERT', 'Transactions', tRes.lastInsertRowid, today + ' 11:00:00');
          // Add small loans for others
          insertLoan.run(cResId, 'Personal Loan', 50000, 12.0, 'Active', today + ' 12:00:00');
        }
    }
    seedDb.close(); console.log('[Seed] SUCCESS: Nexus V5 (With Loans) Complete.');
  } catch (err) { console.error('[Seed] FAILED Nexus V5:', err); }
}

const getConnections = () => { try { if (fs.existsSync(connectionsPath)) return JSON.parse(fs.readFileSync(connectionsPath, 'utf-8')); } catch (e) { return []; } };
const saveConnections = (conns: any[]) => fs.writeFileSync(connectionsPath, JSON.stringify(conns, null, 2), 'utf-8');

const closeActiveConnection = async () => {
  if (!activeConnection) return;
  try {
    if (activeConnection.type === 'sqlite') activeConnection.instance.close();
    else if (activeConnection.type === 'mssql') await activeConnection.instance.close();
    else await activeConnection.instance.close() || await activeConnection.instance.end?.();
  } catch (e) { console.error('[DB] Close error:', e); }
  activeConnection = null;
};

// ---------------------------------------------------------------------------
// AI Pipeline IPC Handlers
// ---------------------------------------------------------------------------

// Main AI query handler — Full NL → SQL pipeline
ipcMain.handle('ai:query', async (_, question: string, sessionId?: string) => {
  try {
    await initAIServices();
    if (!aiServices?.orchestrator) {
      return { success: false, error: 'AI pipeline not initialized. Check LLM_BASE_URL in .env.' };
    }

    const result = await aiServices.orchestrator.processQuery({
      question,
      sessionId: sessionId || 'default',
      userId: 'electron-user',
    });

    return result;
  } catch (err: any) {
    return { success: false, error: `AI query failed: ${err.message}` };
  }
});

// AI health check
ipcMain.handle('ai:health', async () => {
  try {
    await initAIServices();
    if (!aiServices) {
      return { initialized: false, error: 'AI services not available' };
    }

    const { healthCheck } = await import('../backend/init.js');
    const health = await healthCheck(aiServices);
    return { initialized: true, ...health };
  } catch (err: any) {
    return { initialized: false, error: err.message };
  }
});

// AI audit log retrieval
ipcMain.handle('ai:audit', async (_, limit?: number) => {
  if (!aiServices?.auditLogger) return { entries: [], metrics: {} };
  return {
    entries: aiServices.auditLogger.getRecent(limit || 50),
    metrics: aiServices.auditLogger.getMetrics(),
  };
});

// Schema retrieval preview (debug tool)
ipcMain.handle('ai:schema-preview', async (_, question: string) => {
  try {
    await initAIServices();
    if (!aiServices?.schemaRetriever) return { error: 'Not initialized' };

    const retrieval = aiServices.schemaRetriever.retrieve(question);
    return {
      tables: retrieval.retrievedTableNames,
      terms: retrieval.semanticResolution.resolvedTerms.map((t: any) => ({
        term: t.originalTerm,
        definition: t.businessTerm.description,
      })),
      rules: retrieval.semanticResolution.businessRules,
      ambiguous: retrieval.semanticResolution.ambiguousTerms,
      schemaPrompt: retrieval.schemaPrompt.substring(0, 2000), // Truncated for display
    };
  } catch (err: any) {
    return { error: err.message };
  }
});

// ---------------------------------------------------------------------------
// Existing IPC Handlers (unchanged)
// ---------------------------------------------------------------------------

ipcMain.handle('db:get-configs', async () => getConnections());
ipcMain.handle('db:save-config', async (_, config: any) => {
  const conns = getConnections();
  const existingIndex = conns.findIndex((c: any) => c.id === config.id);
  if (existingIndex >= 0) conns[existingIndex] = config; else conns.push({ ...config, id: Date.now().toString() });
  saveConnections(conns ?? []);
  return { success: true };
});

ipcMain.handle('db:delete-config', async (_, id: string) => {
  const conns = getConnections().filter((c: any) => c.id !== id);
  saveConnections(conns); return { success: true };
});

ipcMain.handle('db:connect-config', async (_, id: string) => {
  const conns = getConnections();
  const config = conns.find((c: any) => c.id === id);
  if (!config) throw new Error('Config not found.');
  await closeActiveConnection();
  try {
    if (config.type === 'sqlite') { activeConnection = { type: 'sqlite', instance: new Database(config.details.path, { timeout: 2000 }) }; } 
    else if (config.type === 'postgres') { const client = new PGClient({ host: config.details.host, port: config.details.port || 5432, user: config.details.user, password: config.details.password, database: config.details.database }); await client.connect(); activeConnection = { type: 'postgres', instance: client }; } 
    else if (config.type === 'mysql') { activeConnection = { type: 'mysql', instance: await mysql.createConnection({ host: config.details.host, port: 3306, user: config.details.user, password: config.details.password, database: config.details.database }) }; } 
    else if (config.type === 'mssql') { activeConnection = { type: 'mssql', instance: await mssql.connect({ server: config.details.host, port: config.details.port || 1433, user: config.details.user, password: config.details.password, database: config.details.database, options: { encrypt: false, trustServerCertificate: true } }) }; } 
    else if (config.type === 'oracle') { activeConnection = { type: 'oracle', instance: await oracledb.getConnection({ user: config.details.user, password: config.details.password, connectionString: `${config.details.host}:${config.details.port || 1521}/${config.details.database}` }) }; }
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('db:test-connection', async (_, config: any) => {
  try {
    if (config.type === 'sqlite') { const testDb = new Database(config.details.path); testDb.close(); }
    else if (config.type === 'postgres') { const client = new PGClient({ host: config.details.host, port: config.details.port || 5432, user: config.details.user, password: config.details.password, database: config.details.database, connectionTimeoutMillis: 5000 }); await client.connect(); await client.end(); }
    else if (config.type === 'mysql') { const conn = await mysql.createConnection({ host: config.details.host, port: 3306, user: config.details.user, password: config.details.password, database: config.details.database }); await conn.end(); }
    else if (config.type === 'mssql') { const pool = await mssql.connect({ server: config.details.host, port: 1433, user: config.details.user, password: config.details.password, database: config.details.database, options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 5000 }); await pool.close(); }
    else if (config.type === 'oracle') { const conn = await oracledb.getConnection({ user: config.details.user, password: config.details.password, connectionString: `${config.details.host}:${config.details.port || 1521}/${config.details.database}` }); await conn.close(); }
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('db:query', async (_, sql: string, params: any[] = []) => {
  if (!activeConnection) return { success: false, error: 'Not connected' };
  try {
    if (activeConnection.type === 'sqlite') return { success: true, data: activeConnection.instance.prepare(sql).all(...params) };
    else if (activeConnection.type === 'postgres') { const res = await activeConnection.instance.query(sql, params); return { success: true, data: res.rows }; }
    else if (activeConnection.type === 'mysql') { const [rows] = await activeConnection.instance.execute(sql, params); return { success: true, data: rows }; }
    else if (activeConnection.type === 'mssql') { const request = activeConnection.instance.request(); if (params) params.forEach((v, i) => request.input(`p${i}`, v)); const res = await request.query(sql); return { success: true, data: res.recordset }; }
    else if (activeConnection.type === 'oracle') { const res = await activeConnection.instance.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT }); return { success: true, data: res.rows }; }
    return { success: false, error: 'Unsupported' };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('db:get-schema', async () => {
  if (!activeConnection) return { success: false, error: 'Not connected' };
  try {
    const schema: any = { tables: [], views: [] };
    if (activeConnection.type === 'sqlite') {
      const objects = activeConnection.instance.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')").all();
      for (const obj of objects as any) { const columns = activeConnection.instance.prepare(`PRAGMA table_info(${obj.name})`).all(); if (obj.type === 'table') schema.tables.push({ name: obj.name, columns }); else schema.views.push({ name: obj.name, columns }); }
    } else if (activeConnection.type === 'postgres') {
      const res = await activeConnection.instance.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      for (const row of res.rows) { const cols = await activeConnection.instance.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${row.table_name}'`); schema.tables.push({ name: row.table_name, columns: cols.rows }); }
    } else if (activeConnection.type === 'mysql') {
      const [tables] = await activeConnection.instance.execute("SHOW TABLES");
      for (const tRow of tables as any[]) { const tName = Object.values(tRow)[0] as string; const [cols] = await activeConnection.instance.execute(`DESCRIBE ${tName}`); schema.tables.push({ name: tName, columns: cols }); }
    } else if (activeConnection.type === 'mssql') {
      const tables = await activeConnection.instance.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
      for (const row of tables.recordset) { const cols = await activeConnection.instance.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${row.TABLE_NAME}'`); schema.tables.push({ name: row.TABLE_NAME, columns: cols.recordset }); }
    } else if (activeConnection.type === 'oracle') {
        const tables = await activeConnection.instance.execute("SELECT table_name FROM user_tables");
        for (const row of tables.rows) { const cols = await activeConnection.instance.execute(`SELECT column_name, data_type FROM user_tab_columns WHERE table_name = '${row.TABLE_NAME || row.table_name}'`); schema.tables.push({ name: row.TABLE_NAME || row.table_name, columns: cols.rows }); }
    }
    return { success: true, data: schema };
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('db:connect', async (_, connectionString?: string) => {
  try { 
    ensureSampleDatabase();
    const dbPath = connectionString || sampleDbPath; await closeActiveConnection(); activeConnection = { type: 'sqlite', instance: new Database(dbPath, { timeout: 2000 }) }; return { success: true }; 
  } catch (err: any) { return { success: false, error: err.message }; }
});

ipcMain.handle('db:select-file', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQLite', extensions: ['db', 'sqlite'] }] }); return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('settings:get', (_, key: string) => { try { return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))[key]; } catch (e) { return null; } });
ipcMain.handle('settings:get-all', () => { try { return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch (e) { return {}; } });
ipcMain.handle('settings:set', (_, key: string, value: any) => {
  try { const s = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) : {}; s[key] = value; fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2)); return true; } catch (e) { return false; }
});

ipcMain.handle('voice:transcribe', async (_, audioBuffer: ArrayBuffer) => {
  try {
    const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) : {};
    const apiKey = settings['openaiAPIKey'];
    if (!apiKey) throw new Error('OpenAI API Key not found in settings.');

    const formData = new FormData();
    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || response.statusText);
    }
    const data = await response.json();
    return { success: true, text: data.text };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1200, height: 800, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true }, titleBarStyle: 'hiddenInset' });
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL); else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  ensureSampleDatabase();
  createWindow();

  // Initialize AI services in background (non-blocking)
  if (process.env.LLM_BASE_URL && process.env.DATABASE_URL) {
    initAIServices().catch(err => console.warn('[AI] Background init failed:', err.message));
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

