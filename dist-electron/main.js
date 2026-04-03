//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
path = __toESM(path);
let better_sqlite3 = require("better-sqlite3");
better_sqlite3 = __toESM(better_sqlite3);
let electron_store = require("electron-store");
electron_store = __toESM(electron_store);
//#region src/electron/main.ts
var store = new electron_store.default();
var mainWindow = null;
var db = null;
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.default.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true
		},
		titleBarStyle: "hiddenInset"
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(path.default.join(__dirname, "../dist/index.html"));
}
electron.app.whenReady().then(() => {
	createWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("db:connect", async (_, connectionString) => {
	try {
		db = new better_sqlite3.default(connectionString || path.default.join(electron.app.getPath("userData"), "banking_poc.db"));
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
});
electron.ipcMain.handle("db:query", async (_, sql, params = []) => {
	if (!db) return {
		success: false,
		error: "Database not connected"
	};
	try {
		return {
			success: true,
			data: db.prepare(sql).all(...params)
		};
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
});
electron.ipcMain.handle("db:get-schema", async (_) => {
	if (!db) return {
		success: false,
		error: "Database not connected"
	};
	try {
		const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
		const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
		const schema = {
			tables: [],
			views: []
		};
		for (const table of tables) {
			const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
			schema.tables.push({
				name: table.name,
				columns
			});
		}
		for (const view of views) {
			const columns = db.prepare(`PRAGMA table_info(${view.name})`).all();
			schema.views.push({
				name: view.name,
				columns
			});
		}
		return {
			success: true,
			data: schema
		};
	} catch (error) {
		return {
			success: false,
			error: error.message
		};
	}
});
electron.ipcMain.handle("settings:get", (_, key) => store.get(key));
electron.ipcMain.handle("settings:set", (_, key, value) => store.set(key, value));
//#endregion
