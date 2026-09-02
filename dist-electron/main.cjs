const require_chunk = require("./chunk-Do9eywBl.cjs");
let electron = require("electron");
let path = require("path");
path = require_chunk.__toESM(path);
let better_sqlite3 = require("better-sqlite3");
better_sqlite3 = require_chunk.__toESM(better_sqlite3);
let pg = require("pg");
let mysql2_promise = require("mysql2/promise");
mysql2_promise = require_chunk.__toESM(mysql2_promise);
let mssql = require("mssql");
mssql = require_chunk.__toESM(mssql);
let oracledb = require("oracledb");
oracledb = require_chunk.__toESM(oracledb);
let fs = require("fs");
fs = require_chunk.__toESM(fs);
//#region node_modules/dotenv/lib/main.js
var require_main = /* @__PURE__ */ require_chunk.__commonJSMin(((exports, module) => {
	var fs$2 = require("fs");
	var path$2 = require("path");
	var os = require("os");
	var crypto = require("crypto");
	var TIPS = [
		"◈ encrypted .env [www.dotenvx.com]",
		"◈ secrets for agents [www.dotenvx.com]",
		"⌁ auth for agents [www.vestauth.com]",
		"⌘ custom filepath { path: '/custom/path/.env' }",
		"⌘ enable debugging { debug: true }",
		"⌘ override existing { override: true }",
		"⌘ suppress logs { quiet: true }",
		"⌘ multiple files { path: ['.env.local', '.env'] }"
	];
	function _getRandomTip() {
		return TIPS[Math.floor(Math.random() * TIPS.length)];
	}
	function parseBoolean(value) {
		if (typeof value === "string") return ![
			"false",
			"0",
			"no",
			"off",
			""
		].includes(value.toLowerCase());
		return Boolean(value);
	}
	function supportsAnsi() {
		return process.stdout.isTTY;
	}
	function dim(text) {
		return supportsAnsi() ? `\x1b[2m${text}\x1b[0m` : text;
	}
	var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;
	function parse(src) {
		const obj = {};
		let lines = src.toString();
		lines = lines.replace(/\r\n?/gm, "\n");
		let match;
		while ((match = LINE.exec(lines)) != null) {
			const key = match[1];
			let value = match[2] || "";
			value = value.trim();
			const maybeQuote = value[0];
			value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
			if (maybeQuote === "\"") {
				value = value.replace(/\\n/g, "\n");
				value = value.replace(/\\r/g, "\r");
			}
			obj[key] = value;
		}
		return obj;
	}
	function _parseVault(options) {
		options = options || {};
		const vaultPath = _vaultPath(options);
		options.path = vaultPath;
		const result = DotenvModule.configDotenv(options);
		if (!result.parsed) {
			const err = /* @__PURE__ */ new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
			err.code = "MISSING_DATA";
			throw err;
		}
		const keys = _dotenvKey(options).split(",");
		const length = keys.length;
		let decrypted;
		for (let i = 0; i < length; i++) try {
			const attrs = _instructions(result, keys[i].trim());
			decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
			break;
		} catch (error) {
			if (i + 1 >= length) throw error;
		}
		return DotenvModule.parse(decrypted);
	}
	function _warn(message) {
		console.error(`⚠ ${message}`);
	}
	function _debug(message) {
		console.log(`┆ ${message}`);
	}
	function _log(message) {
		console.log(`◇ ${message}`);
	}
	function _dotenvKey(options) {
		if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) return options.DOTENV_KEY;
		if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) return process.env.DOTENV_KEY;
		return "";
	}
	function _instructions(result, dotenvKey) {
		let uri;
		try {
			uri = new URL(dotenvKey);
		} catch (error) {
			if (error.code === "ERR_INVALID_URL") {
				const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
				err.code = "INVALID_DOTENV_KEY";
				throw err;
			}
			throw error;
		}
		const key = uri.password;
		if (!key) {
			const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Missing key part");
			err.code = "INVALID_DOTENV_KEY";
			throw err;
		}
		const environment = uri.searchParams.get("environment");
		if (!environment) {
			const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: Missing environment part");
			err.code = "INVALID_DOTENV_KEY";
			throw err;
		}
		const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
		const ciphertext = result.parsed[environmentKey];
		if (!ciphertext) {
			const err = /* @__PURE__ */ new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
			err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
			throw err;
		}
		return {
			ciphertext,
			key
		};
	}
	function _vaultPath(options) {
		let possibleVaultPath = null;
		if (options && options.path && options.path.length > 0) if (Array.isArray(options.path)) {
			for (const filepath of options.path) if (fs$2.existsSync(filepath)) possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
		} else possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
		else possibleVaultPath = path$2.resolve(process.cwd(), ".env.vault");
		if (fs$2.existsSync(possibleVaultPath)) return possibleVaultPath;
		return null;
	}
	function _resolveHome(envPath) {
		return envPath[0] === "~" ? path$2.join(os.homedir(), envPath.slice(1)) : envPath;
	}
	function _configVault(options) {
		const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
		const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
		if (debug || !quiet) _log("loading env from encrypted .env.vault");
		const parsed = DotenvModule._parseVault(options);
		let processEnv = process.env;
		if (options && options.processEnv != null) processEnv = options.processEnv;
		DotenvModule.populate(processEnv, parsed, options);
		return { parsed };
	}
	function configDotenv(options) {
		const dotenvPath = path$2.resolve(process.cwd(), ".env");
		let encoding = "utf8";
		let processEnv = process.env;
		if (options && options.processEnv != null) processEnv = options.processEnv;
		let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
		let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
		if (options && options.encoding) encoding = options.encoding;
		else if (debug) _debug("no encoding is specified (UTF-8 is used by default)");
		let optionPaths = [dotenvPath];
		if (options && options.path) if (!Array.isArray(options.path)) optionPaths = [_resolveHome(options.path)];
		else {
			optionPaths = [];
			for (const filepath of options.path) optionPaths.push(_resolveHome(filepath));
		}
		let lastError;
		const parsedAll = {};
		for (const path$3 of optionPaths) try {
			const parsed = DotenvModule.parse(fs$2.readFileSync(path$3, { encoding }));
			DotenvModule.populate(parsedAll, parsed, options);
		} catch (e) {
			if (debug) _debug(`failed to load ${path$3} ${e.message}`);
			lastError = e;
		}
		const populated = DotenvModule.populate(processEnv, parsedAll, options);
		debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
		quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
		if (debug || !quiet) {
			const keysCount = Object.keys(populated).length;
			const shortPaths = [];
			for (const filePath of optionPaths) try {
				const relative = path$2.relative(process.cwd(), filePath);
				shortPaths.push(relative);
			} catch (e) {
				if (debug) _debug(`failed to load ${filePath} ${e.message}`);
				lastError = e;
			}
			_log(`injected env (${keysCount}) from ${shortPaths.join(",")} ${dim(`// tip: ${_getRandomTip()}`)}`);
		}
		if (lastError) return {
			parsed: parsedAll,
			error: lastError
		};
		else return { parsed: parsedAll };
	}
	function config(options) {
		if (_dotenvKey(options).length === 0) return DotenvModule.configDotenv(options);
		const vaultPath = _vaultPath(options);
		if (!vaultPath) {
			_warn(`you set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}`);
			return DotenvModule.configDotenv(options);
		}
		return DotenvModule._configVault(options);
	}
	function decrypt(encrypted, keyStr) {
		const key = Buffer.from(keyStr.slice(-64), "hex");
		let ciphertext = Buffer.from(encrypted, "base64");
		const nonce = ciphertext.subarray(0, 12);
		const authTag = ciphertext.subarray(-16);
		ciphertext = ciphertext.subarray(12, -16);
		try {
			const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
			aesgcm.setAuthTag(authTag);
			return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
		} catch (error) {
			const isRange = error instanceof RangeError;
			const invalidKeyLength = error.message === "Invalid key length";
			const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
			if (isRange || invalidKeyLength) {
				const err = /* @__PURE__ */ new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
				err.code = "INVALID_DOTENV_KEY";
				throw err;
			} else if (decryptionFailed) {
				const err = /* @__PURE__ */ new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
				err.code = "DECRYPTION_FAILED";
				throw err;
			} else throw error;
		}
	}
	function populate(processEnv, parsed, options = {}) {
		const debug = Boolean(options && options.debug);
		const override = Boolean(options && options.override);
		const populated = {};
		if (typeof parsed !== "object") {
			const err = /* @__PURE__ */ new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
			err.code = "OBJECT_REQUIRED";
			throw err;
		}
		for (const key of Object.keys(parsed)) if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
			if (override === true) {
				processEnv[key] = parsed[key];
				populated[key] = parsed[key];
			}
			if (debug) if (override === true) _debug(`"${key}" is already defined and WAS overwritten`);
			else _debug(`"${key}" is already defined and was NOT overwritten`);
		} else {
			processEnv[key] = parsed[key];
			populated[key] = parsed[key];
		}
		return populated;
	}
	var DotenvModule = {
		configDotenv,
		_configVault,
		_parseVault,
		config,
		decrypt,
		parse,
		populate
	};
	module.exports.configDotenv = DotenvModule.configDotenv;
	module.exports._configVault = DotenvModule._configVault;
	module.exports._parseVault = DotenvModule._parseVault;
	module.exports.config = DotenvModule.config;
	module.exports.decrypt = DotenvModule.decrypt;
	module.exports.parse = DotenvModule.parse;
	module.exports.populate = DotenvModule.populate;
	module.exports = DotenvModule;
}));
(/* @__PURE__ */ require_chunk.__toESM(require_main(), 1)).config();
var aiServices = null;
var aiInitPromise = null;
async function initAIServices() {
	if (aiServices) return;
	if (aiInitPromise) {
		await aiInitPromise;
		return;
	}
	aiInitPromise = (async () => {
		try {
			const { initializeBackend } = await Promise.resolve().then(() => require("./init-C15LJbgD.cjs"));
			const databaseDir = path.default.join(electron.app.getAppPath(), "database");
			aiServices = await initializeBackend({
				databaseDir: fs.default.existsSync(databaseDir) ? databaseDir : path.default.join(process.cwd(), "database"),
				auditDir: path.default.join(electron.app.getPath("userData"), "audit_logs")
			});
			console.log("[AI] Pipeline initialized successfully");
		} catch (err) {
			console.error("[AI] Pipeline init failed:", err.message);
		}
	})();
	await aiInitPromise;
}
var mainWindow = null;
try {
	oracledb.default.initOracleClient();
} catch (e) {
	oracledb.default.outFormat = oracledb.default.OUT_FORMAT_OBJECT;
}
var userDataPath = electron.app.getPath("userData");
var settingsPath = path.default.join(userDataPath, "settings_v2.json");
var connectionsPath = path.default.join(userDataPath, "connections.json");
var sampleDbPath = path.default.join(userDataPath, "nexus_poc_v5.db");
var activeConnection = null;
if (!fs.default.existsSync(userDataPath)) fs.default.mkdirSync(userDataPath, { recursive: true });
function ensureSampleDatabase() {
	if (fs.default.existsSync(sampleDbPath)) return;
	try {
		const seedDb = new better_sqlite3.default(sampleDbPath);
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
		const insertCustomer = seedDb.prepare("INSERT INTO Customers (first_name, last_name, email) VALUES (?, ?, ?)");
		const insertAccount = seedDb.prepare("INSERT INTO Accounts (customer_id, branch_id, account_number, balance) VALUES (?, ?, ?, ?)");
		const insertTrans = seedDb.prepare("INSERT INTO Transactions (account_id, transaction_type, amount, description, timestamp) VALUES (?, ?, ?, ?, ?)");
		const insertLoan = seedDb.prepare("INSERT INTO Loans (customer_id, loan_type, amount, interest_rate, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
		const insertAudit = seedDb.prepare("INSERT INTO AuditLogs (action, table_name, record_id, timestamp) VALUES (?, ?, ?, ?)");
		const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
		for (let i = 1; i <= 100; i++) {
			const cResId = insertCustomer.run(`Nexus_Agent`, `${i}`, `user${i}@nexus-data.com`).lastInsertRowid;
			const aResId = insertAccount.run(cResId, i % 2 + 1, `NEX-ACC-100${i}`, 15e5).lastInsertRowid;
			if (i <= 5) {
				for (let j = 0; j < 12; j++) {
					const amount = 35e4 + j * 1e4;
					const tRes = insertTrans.run(aResId, "credit", amount, `VIP Transaction ${j}`, today + " 10:00:00");
					insertAudit.run("INSERT", "Transactions", tRes.lastInsertRowid, today + " 10:00:00");
				}
				insertLoan.run(cResId, "Home Loan", 15e5 + i * 1e5, 8.5, "Active", today + " 09:00:00");
			} else {
				const tRes = insertTrans.run(aResId, "credit", 2e3, "Initial Deposit", today + " 11:00:00");
				insertAudit.run("INSERT", "Transactions", tRes.lastInsertRowid, today + " 11:00:00");
				insertLoan.run(cResId, "Personal Loan", 5e4, 12, "Active", today + " 12:00:00");
			}
		}
		seedDb.close();
		console.log("[Seed] SUCCESS: Nexus V5 (With Loans) Complete.");
	} catch (err) {
		console.error("[Seed] FAILED Nexus V5:", err);
	}
}
var getConnections = () => {
	try {
		if (fs.default.existsSync(connectionsPath)) return JSON.parse(fs.default.readFileSync(connectionsPath, "utf-8"));
	} catch (e) {
		return [];
	}
};
var saveConnections = (conns) => fs.default.writeFileSync(connectionsPath, JSON.stringify(conns, null, 2), "utf-8");
var closeActiveConnection = async () => {
	if (!activeConnection) return;
	try {
		if (activeConnection.type === "sqlite") activeConnection.instance.close();
		else if (activeConnection.type === "mssql") await activeConnection.instance.close();
		else await activeConnection.instance.close() || await activeConnection.instance.end?.();
	} catch (e) {
		console.error("[DB] Close error:", e);
	}
	activeConnection = null;
};
electron.ipcMain.handle("ai:query", async (_, question, sessionId) => {
	try {
		await initAIServices();
		if (!aiServices?.orchestrator) return {
			success: false,
			error: "AI pipeline not initialized. Check LLM_BASE_URL in .env."
		};
		return await aiServices.orchestrator.processQuery({
			question,
			sessionId: sessionId || "default",
			userId: "electron-user"
		}, (event) => {
			if (!mainWindow || mainWindow.isDestroyed()) return;
			mainWindow.webContents.send("ai:progress", event);
		});
	} catch (err) {
		return {
			success: false,
			error: `AI query failed: ${err.message}`
		};
	}
});
electron.ipcMain.handle("ai:health", async () => {
	try {
		await initAIServices();
		if (!aiServices) return {
			initialized: false,
			error: "AI services not available"
		};
		const { healthCheck } = await Promise.resolve().then(() => require("./init-C15LJbgD.cjs"));
		return {
			initialized: true,
			...await healthCheck(aiServices)
		};
	} catch (err) {
		return {
			initialized: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("ai:audit", async (_, limit) => {
	if (!aiServices?.auditLogger) return {
		entries: [],
		metrics: {}
	};
	return {
		entries: aiServices.auditLogger.getRecent(limit || 50),
		metrics: aiServices.auditLogger.getMetrics()
	};
});
electron.ipcMain.handle("ai:db-schema", async () => {
	try {
		await initAIServices();
		if (!aiServices?.db) return {
			success: false,
			error: "Analysis database not connected."
		};
		const schema = await aiServices.db.introspectSchema();
		return {
			success: true,
			data: {
				tables: await Promise.all(schema.tables.map(async (t) => {
					try {
						const res = await aiServices.db.executeQuery(`SELECT COUNT(*)::int AS n FROM "${t.name}"`, [], 15e3);
						return {
							...t,
							rowCount: res.rows?.[0]?.n ?? 0
						};
					} catch {
						return {
							...t,
							rowCount: 0
						};
					}
				})),
				views: schema.views
			}
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("ai:db-preview", async (_, tableName, limit = 50) => {
	try {
		await initAIServices();
		if (!aiServices?.db) return {
			success: false,
			error: "Analysis database not connected."
		};
		const schema = await aiServices.db.introspectSchema();
		const known = [...schema.tables, ...schema.views].find((t) => t.name.toLowerCase() === String(tableName).toLowerCase());
		if (!known) return {
			success: false,
			error: `Unknown table "${tableName}".`
		};
		const rows = Math.min(Math.max(1, Number(limit) || 50), 200);
		const res = await aiServices.db.executeQuery(`SELECT * FROM "${known.name}" LIMIT ${rows}`, [], 15e3);
		return {
			success: true,
			data: res.rows,
			fields: res.fields
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("ai:sql-run", async (_, sql) => {
	try {
		await initAIServices();
		if (!aiServices?.db || !aiServices?.guardian) return {
			success: false,
			error: "Analysis database not connected."
		};
		if (!sql || !sql.trim()) return {
			success: false,
			error: "Enter a SQL statement to run."
		};
		const validation = aiServices.guardian.validate(sql);
		if (!validation.valid) return {
			success: false,
			error: validation.errors.map((e) => e.message).join(" "),
			blocked: true
		};
		const started = Date.now();
		const res = await aiServices.db.executeQuery(validation.modifiedSql || sql, [], 3e4);
		return {
			success: true,
			data: res.rows,
			fields: res.fields,
			rowCount: res.rowCount,
			elapsedMs: Date.now() - started,
			warnings: validation.warnings.map((w) => w.message)
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("ai:schema-preview", async (_, question) => {
	try {
		await initAIServices();
		if (!aiServices?.schemaRetriever) return { error: "Not initialized" };
		const retrieval = aiServices.schemaRetriever.retrieve(question);
		return {
			tables: retrieval.retrievedTableNames,
			terms: retrieval.semanticResolution.resolvedTerms.map((t) => ({
				term: t.originalTerm,
				definition: t.businessTerm.description
			})),
			rules: retrieval.semanticResolution.businessRules,
			ambiguous: retrieval.semanticResolution.ambiguousTerms,
			schemaPrompt: retrieval.schemaPrompt.substring(0, 2e3)
		};
	} catch (err) {
		return { error: err.message };
	}
});
electron.ipcMain.handle("db:get-configs", async () => getConnections());
electron.ipcMain.handle("db:save-config", async (_, config) => {
	const conns = getConnections();
	const existingIndex = conns.findIndex((c) => c.id === config.id);
	if (existingIndex >= 0) conns[existingIndex] = config;
	else conns.push({
		...config,
		id: Date.now().toString()
	});
	saveConnections(conns ?? []);
	return { success: true };
});
electron.ipcMain.handle("db:delete-config", async (_, id) => {
	saveConnections(getConnections().filter((c) => c.id !== id));
	return { success: true };
});
electron.ipcMain.handle("db:connect-config", async (_, id) => {
	const config = getConnections().find((c) => c.id === id);
	if (!config) throw new Error("Config not found.");
	await closeActiveConnection();
	try {
		if (config.type === "sqlite") activeConnection = {
			type: "sqlite",
			instance: new better_sqlite3.default(config.details.path, { timeout: 2e3 })
		};
		else if (config.type === "postgres") {
			const client = new pg.Client({
				host: config.details.host,
				port: config.details.port || 5432,
				user: config.details.user,
				password: config.details.password,
				database: config.details.database
			});
			await client.connect();
			activeConnection = {
				type: "postgres",
				instance: client
			};
		} else if (config.type === "mysql") activeConnection = {
			type: "mysql",
			instance: await mysql2_promise.default.createConnection({
				host: config.details.host,
				port: 3306,
				user: config.details.user,
				password: config.details.password,
				database: config.details.database
			})
		};
		else if (config.type === "mssql") activeConnection = {
			type: "mssql",
			instance: await mssql.default.connect({
				server: config.details.host,
				port: config.details.port || 1433,
				user: config.details.user,
				password: config.details.password,
				database: config.details.database,
				options: {
					encrypt: false,
					trustServerCertificate: true
				}
			})
		};
		else if (config.type === "oracle") activeConnection = {
			type: "oracle",
			instance: await oracledb.default.getConnection({
				user: config.details.user,
				password: config.details.password,
				connectionString: `${config.details.host}:${config.details.port || 1521}/${config.details.database}`
			})
		};
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("db:test-connection", async (_, config) => {
	try {
		if (config.type === "sqlite") new better_sqlite3.default(config.details.path).close();
		else if (config.type === "postgres") {
			const client = new pg.Client({
				host: config.details.host,
				port: config.details.port || 5432,
				user: config.details.user,
				password: config.details.password,
				database: config.details.database,
				connectionTimeoutMillis: 5e3
			});
			await client.connect();
			await client.end();
		} else if (config.type === "mysql") await (await mysql2_promise.default.createConnection({
			host: config.details.host,
			port: 3306,
			user: config.details.user,
			password: config.details.password,
			database: config.details.database
		})).end();
		else if (config.type === "mssql") await (await mssql.default.connect({
			server: config.details.host,
			port: 1433,
			user: config.details.user,
			password: config.details.password,
			database: config.details.database,
			options: {
				encrypt: false,
				trustServerCertificate: true
			},
			requestTimeout: 5e3
		})).close();
		else if (config.type === "oracle") await (await oracledb.default.getConnection({
			user: config.details.user,
			password: config.details.password,
			connectionString: `${config.details.host}:${config.details.port || 1521}/${config.details.database}`
		})).close();
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("db:query", async (_, sql, params = []) => {
	if (!activeConnection) return {
		success: false,
		error: "Not connected"
	};
	try {
		if (activeConnection.type === "sqlite") return {
			success: true,
			data: activeConnection.instance.prepare(sql).all(...params)
		};
		else if (activeConnection.type === "postgres") return {
			success: true,
			data: (await activeConnection.instance.query(sql, params)).rows
		};
		else if (activeConnection.type === "mysql") {
			const [rows] = await activeConnection.instance.execute(sql, params);
			return {
				success: true,
				data: rows
			};
		} else if (activeConnection.type === "mssql") {
			const request = activeConnection.instance.request();
			if (params) params.forEach((v, i) => request.input(`p${i}`, v));
			return {
				success: true,
				data: (await request.query(sql)).recordset
			};
		} else if (activeConnection.type === "oracle") return {
			success: true,
			data: (await activeConnection.instance.execute(sql, params, { outFormat: oracledb.default.OUT_FORMAT_OBJECT })).rows
		};
		return {
			success: false,
			error: "Unsupported"
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("db:get-schema", async () => {
	if (!activeConnection) return {
		success: false,
		error: "Not connected"
	};
	try {
		const schema = {
			tables: [],
			views: []
		};
		if (activeConnection.type === "sqlite") {
			const objects = activeConnection.instance.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')").all();
			for (const obj of objects) {
				const columns = activeConnection.instance.prepare(`PRAGMA table_info(${obj.name})`).all();
				if (obj.type === "table") schema.tables.push({
					name: obj.name,
					columns
				});
				else schema.views.push({
					name: obj.name,
					columns
				});
			}
		} else if (activeConnection.type === "postgres") {
			const res = await activeConnection.instance.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
			for (const row of res.rows) {
				const cols = await activeConnection.instance.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${row.table_name}'`);
				schema.tables.push({
					name: row.table_name,
					columns: cols.rows
				});
			}
		} else if (activeConnection.type === "mysql") {
			const [tables] = await activeConnection.instance.execute("SHOW TABLES");
			for (const tRow of tables) {
				const tName = Object.values(tRow)[0];
				const [cols] = await activeConnection.instance.execute(`DESCRIBE ${tName}`);
				schema.tables.push({
					name: tName,
					columns: cols
				});
			}
		} else if (activeConnection.type === "mssql") {
			const tables = await activeConnection.instance.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
			for (const row of tables.recordset) {
				const cols = await activeConnection.instance.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${row.TABLE_NAME}'`);
				schema.tables.push({
					name: row.TABLE_NAME,
					columns: cols.recordset
				});
			}
		} else if (activeConnection.type === "oracle") {
			const tables = await activeConnection.instance.execute("SELECT table_name FROM user_tables");
			for (const row of tables.rows) {
				const cols = await activeConnection.instance.execute(`SELECT column_name, data_type FROM user_tab_columns WHERE table_name = '${row.TABLE_NAME || row.table_name}'`);
				schema.tables.push({
					name: row.TABLE_NAME || row.table_name,
					columns: cols.rows
				});
			}
		}
		return {
			success: true,
			data: schema
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("db:connect", async (_, connectionString) => {
	try {
		ensureSampleDatabase();
		const dbPath = connectionString || sampleDbPath;
		await closeActiveConnection();
		activeConnection = {
			type: "sqlite",
			instance: new better_sqlite3.default(dbPath, { timeout: 2e3 })
		};
		return { success: true };
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
electron.ipcMain.handle("db:select-file", async () => {
	const result = await electron.dialog.showOpenDialog({
		properties: ["openFile"],
		filters: [{
			name: "SQLite",
			extensions: ["db", "sqlite"]
		}]
	});
	return result.canceled ? null : result.filePaths[0];
});
electron.ipcMain.handle("settings:get", (_, key) => {
	try {
		return JSON.parse(fs.default.readFileSync(settingsPath, "utf-8"))[key];
	} catch (e) {
		return null;
	}
});
electron.ipcMain.handle("settings:get-all", () => {
	try {
		return JSON.parse(fs.default.readFileSync(settingsPath, "utf-8"));
	} catch (e) {
		return {};
	}
});
electron.ipcMain.handle("settings:set", (_, key, value) => {
	try {
		const s = fs.default.existsSync(settingsPath) ? JSON.parse(fs.default.readFileSync(settingsPath, "utf-8")) : {};
		s[key] = value;
		fs.default.writeFileSync(settingsPath, JSON.stringify(s, null, 2));
		return true;
	} catch (e) {
		return false;
	}
});
electron.ipcMain.handle("voice:transcribe", async (_, audioBuffer) => {
	try {
		const apiKey = (fs.default.existsSync(settingsPath) ? JSON.parse(fs.default.readFileSync(settingsPath, "utf-8")) : {})["openaiAPIKey"];
		if (!apiKey) throw new Error("OpenAI API Key not found in settings.");
		const formData = new FormData();
		const file = new File([audioBuffer], "audio.webm", { type: "audio/webm" });
		formData.append("file", file);
		formData.append("model", "whisper-1");
		const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
			method: "POST",
			headers: { "Authorization": `Bearer ${apiKey}` },
			body: formData
		});
		if (!response.ok) {
			const err = await response.json();
			throw new Error(err.error?.message || response.statusText);
		}
		return {
			success: true,
			text: (await response.json()).text
		};
	} catch (err) {
		return {
			success: false,
			error: err.message
		};
	}
});
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.default.join(__dirname, "preload.cjs"),
			nodeIntegration: false,
			contextIsolation: true
		},
		titleBarStyle: "hiddenInset"
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(path.default.join(__dirname, "../dist/index.html"));
}
electron.app.whenReady().then(() => {
	ensureSampleDatabase();
	createWindow();
	if (process.env.LLM_BASE_URL && process.env.DATABASE_URL) initAIServices().catch((err) => console.warn("[AI] Background init failed:", err.message));
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
//#endregion
