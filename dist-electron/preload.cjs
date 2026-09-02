let electron = require("electron");
//#region src/electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	dbConnect: (connectionString) => electron.ipcRenderer.invoke("db:connect", connectionString),
	dbQuery: (sql, params) => electron.ipcRenderer.invoke("db:query", sql, params),
	dbGetSchema: () => electron.ipcRenderer.invoke("db:get-schema"),
	dbSelectFile: () => electron.ipcRenderer.invoke("db:select-file"),
	dbSaveConfig: (config) => electron.ipcRenderer.invoke("db:save-config", config),
	dbGetConfigs: () => electron.ipcRenderer.invoke("db:get-configs"),
	dbDeleteConfig: (id) => electron.ipcRenderer.invoke("db:delete-config", id),
	dbConnectConfig: (id) => electron.ipcRenderer.invoke("db:connect-config", id),
	dbTestConnection: (config) => electron.ipcRenderer.invoke("db:test-connection", config),
	settingsGet: (key) => electron.ipcRenderer.invoke("settings:get", key),
	settingsGetAll: () => electron.ipcRenderer.invoke("settings:get-all"),
	settingsSet: (key, value) => electron.ipcRenderer.invoke("settings:set", key, value),
	voiceTranscribe: (audioBuffer) => electron.ipcRenderer.invoke("voice:transcribe", audioBuffer),
	aiQuery: (question, sessionId) => electron.ipcRenderer.invoke("ai:query", question, sessionId),
	aiHealth: () => electron.ipcRenderer.invoke("ai:health"),
	aiAudit: (limit) => electron.ipcRenderer.invoke("ai:audit", limit),
	aiSchemaPreview: (question) => electron.ipcRenderer.invoke("ai:schema-preview", question),
	aiDbSchema: () => electron.ipcRenderer.invoke("ai:db-schema"),
	aiDbPreview: (tableName, limit) => electron.ipcRenderer.invoke("ai:db-preview", tableName, limit),
	aiSqlRun: (sql) => electron.ipcRenderer.invoke("ai:sql-run", sql),
	onAiProgress: (cb) => {
		const handler = (_e, event) => cb(event);
		electron.ipcRenderer.on("ai:progress", handler);
		return () => electron.ipcRenderer.removeListener("ai:progress", handler);
	}
});
//#endregion
