let electron = require("electron");
//#region src/electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	dbConnect: (connectionString) => electron.ipcRenderer.invoke("db:connect", connectionString),
	dbQuery: (sql, params) => electron.ipcRenderer.invoke("db:query", sql, params),
	dbGetSchema: () => electron.ipcRenderer.invoke("db:get-schema"),
	dbSelectFile: () => electron.ipcRenderer.invoke("db:select-file"),
	settingsGet: (key) => electron.ipcRenderer.invoke("settings:get", key),
	settingsSet: (key, value) => electron.ipcRenderer.invoke("settings:set", key, value)
});
//#endregion
