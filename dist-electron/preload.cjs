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
	settingsSet: (key, value) => electron.ipcRenderer.invoke("settings:set", key, value),
	voiceTranscribe: (audioBuffer) => electron.ipcRenderer.invoke("voice:transcribe", audioBuffer)
});
//#endregion
