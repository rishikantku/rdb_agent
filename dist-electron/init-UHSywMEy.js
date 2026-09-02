import path from "path";
import { Client, Pool } from "pg";
import fs from "fs";
import { randomUUID } from "crypto";
//#region src/backend/db/database-adapter.ts
var DatabaseAdapter = class {
	config;
	constructor(config) {
		this.config = config;
	}
	/** Get the SQL dialect for this adapter */
	get dialect() {
		return this.config.dialect;
	}
};
var PostgresDialectHelpers = class {
	limitClause(n) {
		return `LIMIT ${n}`;
	}
	currentTimestamp() {
		return "CURRENT_TIMESTAMP";
	}
	dateTrunc(part, column) {
		return `DATE_TRUNC('${part}', ${column})`;
	}
	dateDiffDays(from, to) {
		return `(${to}::date - ${from}::date)`;
	}
	coalesce(column, defaultValue) {
		return `COALESCE(${column}, ${defaultValue})`;
	}
	concat(...parts) {
		return parts.join(" || ");
	}
	booleanTrue() {
		return "TRUE";
	}
	booleanFalse() {
		return "FALSE";
	}
	fiscalYear(dateColumn) {
		return `CASE WHEN EXTRACT(MONTH FROM ${dateColumn}) >= 4 THEN EXTRACT(YEAR FROM ${dateColumn}) ELSE EXTRACT(YEAR FROM ${dateColumn}) - 1 END`;
	}
	fiscalYearFilter(dateColumn, fyYear) {
		return `${dateColumn} >= '${fyYear}-04-01' AND ${dateColumn} < '${fyYear + 1}-04-01'`;
	}
	paramPlaceholder(index) {
		return `$${index}`;
	}
};
//#endregion
//#region src/backend/db/postgres-adapter.ts
var PostgresAdapter = class extends DatabaseAdapter {
	pool = null;
	connected = false;
	dialectHelpers = new PostgresDialectHelpers();
	constructor(config) {
		super({
			...config,
			dialect: "postgresql"
		});
	}
	async connect() {
		if (this.pool) await this.disconnect();
		const poolConfig = {
			host: this.config.host || "localhost",
			port: this.config.port || 5432,
			user: this.config.user,
			password: this.config.password,
			database: this.config.database,
			max: this.config.maxConnections || 5,
			idleTimeoutMillis: this.config.idleTimeoutMs || 3e4,
			connectionTimeoutMillis: this.config.connectionTimeoutMs || 1e4
		};
		if (this.config.ssl) poolConfig.ssl = typeof this.config.ssl === "object" ? this.config.ssl : { rejectUnauthorized: false };
		this.pool = new Pool(poolConfig);
		(await this.pool.connect()).release();
		this.connected = true;
	}
	async disconnect() {
		if (this.pool) {
			await this.pool.end();
			this.pool = null;
		}
		this.connected = false;
	}
	async testConnection() {
		const start = performance.now();
		try {
			const clientConfig = {
				host: this.config.host || "localhost",
				port: this.config.port || 5432,
				user: this.config.user,
				password: this.config.password,
				database: this.config.database,
				connectionTimeoutMillis: 5e3
			};
			if (this.config.ssl) clientConfig.ssl = typeof this.config.ssl === "object" ? this.config.ssl : { rejectUnauthorized: false };
			const client = new Client(clientConfig);
			await client.connect();
			const versionRes = await client.query("SELECT version()");
			await client.end();
			return {
				success: true,
				latencyMs: Math.round(performance.now() - start),
				serverVersion: versionRes.rows[0]?.version
			};
		} catch (error) {
			return {
				success: false,
				latencyMs: Math.round(performance.now() - start),
				error: error.message
			};
		}
	}
	async executeQuery(sql, params = [], timeoutMs) {
		if (!this.pool) throw new Error("Database not connected. Call connect() first.");
		const effectiveTimeout = timeoutMs || this.config.statementTimeoutMs || 3e4;
		const start = performance.now();
		const client = await this.pool.connect();
		try {
			await client.query(`SET statement_timeout = ${effectiveTimeout}`);
			if (this.config.readOnly) await client.query("SET default_transaction_read_only = ON");
			const result = await client.query(sql, params);
			const executionTimeMs = Math.round(performance.now() - start);
			const fields = (result.fields || []).map((f) => ({
				name: f.name,
				dataType: this.pgTypeToString(f.dataTypeID)
			}));
			return {
				rows: result.rows,
				rowCount: result.rowCount ?? result.rows.length,
				fields,
				executionTimeMs
			};
		} finally {
			client.release();
		}
	}
	async introspectSchema() {
		if (!this.pool) throw new Error("Database not connected.");
		const tablesRes = await this.pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
		const tables = [];
		const views = [];
		for (const row of tablesRes.rows) {
			const columns = await this.introspectColumns(row.table_name);
			const entry = {
				name: row.table_name,
				schema: "public",
				columns
			};
			if (row.table_type === "VIEW") views.push(entry);
			else tables.push(entry);
		}
		return {
			tables,
			views
		};
	}
	async tableExists(tableName) {
		if (!this.pool) return false;
		return (await this.pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [tableName.toLowerCase()])).rowCount > 0;
	}
	async estimateRowCount(tableName) {
		if (!this.pool) return 0;
		const res = await this.pool.query(`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1`, [tableName.toLowerCase()]);
		if (res.rows.length > 0 && res.rows[0].estimate >= 0) return Number(res.rows[0].estimate);
		const countRes = await this.pool.query(`SELECT COUNT(*) AS count FROM "${tableName}"`);
		return Number(countRes.rows[0]?.count ?? 0);
	}
	isConnected() {
		return this.connected && this.pool !== null;
	}
	getDialectHelpers() {
		return this.dialectHelpers;
	}
	async introspectColumns(tableName) {
		const colsRes = await this.pool.query(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.udt_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = $1
      ORDER BY c.ordinal_position
    `, [tableName]);
		const pkRes = await this.pool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
    `, [tableName]);
		const pkColumns = new Set(pkRes.rows.map((r) => r.column_name));
		const fkRes = await this.pool.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [tableName]);
		const fkMap = /* @__PURE__ */ new Map();
		for (const fk of fkRes.rows) fkMap.set(fk.column_name, {
			table: fk.foreign_table,
			column: fk.foreign_column
		});
		return colsRes.rows.map((row) => ({
			name: row.column_name,
			dataType: row.data_type,
			nullable: row.is_nullable === "YES",
			isPrimaryKey: pkColumns.has(row.column_name),
			defaultValue: row.column_default || void 0,
			foreignKey: fkMap.get(row.column_name)
		}));
	}
	/**
	* Convert PostgreSQL OID type codes to human-readable type strings.
	* This is a simplified mapping for common types.
	*/
	pgTypeToString(oid) {
		return {
			16: "boolean",
			20: "bigint",
			21: "smallint",
			23: "integer",
			25: "text",
			700: "real",
			701: "double precision",
			1043: "varchar",
			1082: "date",
			1114: "timestamp",
			1184: "timestamptz",
			1700: "numeric",
			2950: "uuid"
		}[oid] || "unknown";
	}
};
//#endregion
//#region src/backend/schema/schema-intelligence.ts
var SchemaIntelligence = class {
	tables = /* @__PURE__ */ new Map();
	relationships = [];
	joinPatterns = [];
	relationshipGraph = /* @__PURE__ */ new Map();
	registerTable(table) {
		this.tables.set(table.name.toUpperCase(), table);
		if (!this.relationshipGraph.has(table.name.toUpperCase())) this.relationshipGraph.set(table.name.toUpperCase(), /* @__PURE__ */ new Set());
	}
	registerRelationship(rel) {
		this.relationships.push(rel);
		const fromKey = rel.fromTable.toUpperCase();
		const toKey = rel.toTable.toUpperCase();
		if (!this.relationshipGraph.has(fromKey)) this.relationshipGraph.set(fromKey, /* @__PURE__ */ new Set());
		if (!this.relationshipGraph.has(toKey)) this.relationshipGraph.set(toKey, /* @__PURE__ */ new Set());
		this.relationshipGraph.get(fromKey).add(toKey);
		this.relationshipGraph.get(toKey).add(fromKey);
	}
	registerJoinPattern(pattern) {
		this.joinPatterns.push(pattern);
	}
	getTable(name) {
		return this.tables.get(name.toUpperCase());
	}
	getAllTables() {
		return Array.from(this.tables.values());
	}
	getColumn(tableName, columnName) {
		const table = this.getTable(tableName);
		if (!table) return void 0;
		return table.columns.find((c) => c.name.toUpperCase() === columnName.toUpperCase());
	}
	getRelationshipsForTable(tableName) {
		const key = tableName.toUpperCase();
		return this.relationships.filter((r) => r.fromTable.toUpperCase() === key || r.toTable.toUpperCase() === key);
	}
	getRelatedTables(tableName) {
		const key = tableName.toUpperCase();
		return Array.from(this.relationshipGraph.get(key) ?? []);
	}
	getAllRelationships() {
		return [...this.relationships];
	}
	getJoinPatterns() {
		return [...this.joinPatterns];
	}
	/**
	* Given a set of keywords extracted from a user query, score and return
	* the most relevant tables. Uses keyword matching against table names,
	* column names, descriptions, business names, and tags.
	*/
	findRelevantTables(keywords, maxTables = 10) {
		const scores = /* @__PURE__ */ new Map();
		for (const [tableKey, table] of this.tables) {
			let score = 0;
			const tableNameLower = table.name.toLowerCase();
			const tableBusinessLower = (table.businessName ?? "").toLowerCase();
			const tableDescLower = (table.description ?? "").toLowerCase();
			const tableTags = (table.tags ?? []).map((t) => t.toLowerCase());
			for (const keyword of keywords) {
				const kw = keyword.toLowerCase();
				if (tableNameLower.includes(kw)) score += 10;
				if (tableNameLower === kw) score += 20;
				if (tableBusinessLower.includes(kw)) score += 15;
				if (tableDescLower.includes(kw)) score += 5;
				if (tableTags.some((tag) => tag.includes(kw))) score += 12;
				for (const col of table.columns) {
					const colNameLower = col.name.toLowerCase();
					const colBusinessLower = (col.businessName ?? "").toLowerCase();
					const colDescLower = (col.description ?? "").toLowerCase();
					if (colNameLower.includes(kw)) score += 5;
					if (colNameLower === kw) score += 10;
					if (colBusinessLower.includes(kw)) score += 8;
					if (colDescLower.includes(kw)) score += 3;
				}
			}
			if (score > 0) scores.set(tableKey, score);
		}
		return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxTables).map(([key]) => this.tables.get(key));
	}
	/**
	* Given a set of directly relevant tables, traverse the relationship graph
	* to include related tables that may be needed for joins.
	* Uses BFS with configurable depth.
	*/
	expandWithRelatedTables(tableNames, maxDepth = 1) {
		const visited = /* @__PURE__ */ new Set();
		const queue = [];
		for (const name of tableNames) {
			const key = name.toUpperCase();
			visited.add(key);
			queue.push({
				table: key,
				depth: 0
			});
		}
		while (queue.length > 0) {
			const { table, depth } = queue.shift();
			if (depth >= maxDepth) continue;
			const neighbors = this.relationshipGraph.get(table) ?? /* @__PURE__ */ new Set();
			for (const neighbor of neighbors) if (!visited.has(neighbor)) {
				visited.add(neighbor);
				queue.push({
					table: neighbor,
					depth: depth + 1
				});
			}
		}
		return Array.from(visited).map((key) => this.tables.get(key)).filter((t) => t !== void 0);
	}
	/**
	* Get the relationships that connect a specific set of tables.
	*/
	getRelationshipsBetween(tableNames) {
		const keys = new Set(tableNames.map((n) => n.toUpperCase()));
		return this.relationships.filter((r) => keys.has(r.fromTable.toUpperCase()) && keys.has(r.toTable.toUpperCase()));
	}
	/**
	* Get join patterns relevant to a set of tables.
	*/
	getRelevantJoinPatterns(tableNames) {
		const keys = new Set(tableNames.map((n) => n.toUpperCase()));
		return this.joinPatterns.filter((p) => p.tables.some((t) => keys.has(t.toUpperCase())));
	}
	/**
	* Build a focused schema context for the LLM, containing only the
	* relevant tables, their relationships, and applicable join patterns.
	*/
	buildSchemaContext(tableNames) {
		return {
			tables: tableNames.map((n) => this.getTable(n)).filter((t) => t !== void 0),
			relationships: this.getRelationshipsBetween(tableNames),
			joinPatterns: this.getRelevantJoinPatterns(tableNames)
		};
	}
	/**
	* Serialize schema context to a concise text format suitable for LLM prompts.
	* This is much more efficient than dumping raw JSON.
	*/
	serializeForPrompt(context) {
		const parts = [];
		parts.push("=== DATABASE SCHEMA ===\n");
		for (const table of context.tables) {
			const tableType = table.type === "view" ? "VIEW" : "TABLE";
			parts.push(`${tableType}: ${table.name}`);
			if (table.description) parts.push(`  Description: ${table.description}`);
			if (table.businessName) parts.push(`  Business Name: ${table.businessName}`);
			parts.push("  Columns:");
			for (const col of table.columns) {
				let colLine = `    - ${col.name} (${col.dataType})`;
				if (col.isPrimaryKey) colLine += " [PK]";
				if (col.isForeignKey && col.foreignKeyRef) colLine += ` [FK → ${col.foreignKeyRef.table}.${col.foreignKeyRef.column}]`;
				if (col.nullable === false) colLine += " NOT NULL";
				if (col.description) colLine += ` -- ${col.description}`;
				if (col.businessName) colLine += ` (Business: ${col.businessName})`;
				parts.push(colLine);
			}
			parts.push("");
		}
		if (context.relationships.length > 0) {
			parts.push("=== RELATIONSHIPS ===");
			for (const rel of context.relationships) {
				parts.push(`  ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn} (${rel.type})`);
				if (rel.description) parts.push(`    ${rel.description}`);
			}
			parts.push("");
		}
		if (context.joinPatterns.length > 0) {
			parts.push("=== COMMON JOIN PATTERNS ===");
			for (const pattern of context.joinPatterns) {
				parts.push(`  ${pattern.name}: ${pattern.description}`);
				parts.push(`    SQL: ${pattern.joinClause}`);
			}
			parts.push("");
		}
		return parts.join("\n");
	}
	tableExists(name) {
		return this.tables.has(name.toUpperCase());
	}
	columnExists(tableName, columnName) {
		return this.getColumn(tableName, columnName) !== void 0;
	}
	isTableRestricted(name) {
		return this.getTable(name)?.restricted === true;
	}
	isSensitiveColumn(tableName, columnName) {
		return this.getColumn(tableName, columnName)?.sensitive === true;
	}
};
//#endregion
//#region src/backend/schema/semantic-layer.ts
var SemanticLayer = class {
	terms = /* @__PURE__ */ new Map();
	ambiguousTerms = /* @__PURE__ */ new Map();
	globalRules = [];
	registerTerm(term) {
		const key = term.term.toLowerCase();
		this.terms.set(key, term);
		for (const alias of term.aliases) this.terms.set(alias.toLowerCase(), term);
	}
	registerAmbiguousTerm(term) {
		this.ambiguousTerms.set(term.term.toLowerCase(), term);
	}
	registerGlobalRule(rule) {
		this.globalRules.push(rule);
	}
	/**
	* Given a list of detected terms from the user query, resolve them
	* against the business glossary. Returns resolved terms, any ambiguities
	* that need user clarification, and derived business rules.
	*/
	resolveTerms(detectedTerms) {
		const resolved = [];
		const ambiguous = [];
		const additionalTables = /* @__PURE__ */ new Set();
		const businessRules = new Set(this.globalRules);
		for (const term of detectedTerms) {
			const key = term.toLowerCase();
			const ambiguousTerm = this.ambiguousTerms.get(key);
			if (ambiguousTerm) {
				ambiguous.push(ambiguousTerm);
				continue;
			}
			const businessTerm = this.terms.get(key);
			if (businessTerm) {
				resolved.push({
					originalTerm: term,
					businessTerm
				});
				switch (businessTerm.mapping.type) {
					case "table":
						additionalTables.add(businessTerm.mapping.table);
						break;
					case "column":
					case "filter":
						additionalTables.add(businessTerm.mapping.table);
						break;
					case "concept":
						for (const t of businessTerm.mapping.relatedTables) additionalTables.add(t);
						for (const rule of businessTerm.mapping.rules) businessRules.add(rule);
						break;
				}
			}
		}
		return {
			resolvedTerms: resolved,
			ambiguousTerms: ambiguous,
			additionalTables: Array.from(additionalTables),
			businessRules: Array.from(businessRules)
		};
	}
	/**
	* Extract potential business terms from a natural language query
	* using keyword matching against the glossary.
	*/
	extractTerms(query) {
		const queryLower = query.toLowerCase();
		const found = [];
		const allTerms = /* @__PURE__ */ new Set();
		for (const [key] of this.terms) allTerms.add(key);
		for (const [key] of this.ambiguousTerms) allTerms.add(key);
		for (const term of allTerms) {
			const index = queryLower.indexOf(term);
			if (index !== -1) {
				const before = index > 0 ? queryLower[index - 1] : " ";
				const after = index + term.length < queryLower.length ? queryLower[index + term.length] : " ";
				if (/[\s,.]/.test(before) || index === 0) {
					if (/[\s,.]/.test(after) || index + term.length === queryLower.length) found.push({
						term,
						index
					});
				}
			}
		}
		found.sort((a, b) => a.index - b.index);
		return [...new Set(found.map((f) => f.term))];
	}
	/**
	* Generate business context for the LLM prompt based on resolved terms.
	*/
	serializeForPrompt(resolution) {
		const parts = [];
		parts.push("=== BUSINESS DEFINITIONS ===\n");
		if (resolution.resolvedTerms.length > 0) {
			parts.push("Resolved Business Terms:");
			for (const { originalTerm, businessTerm } of resolution.resolvedTerms) {
				parts.push(`  "${originalTerm}":`);
				parts.push(`    Definition: ${businessTerm.description}`);
				switch (businessTerm.mapping.type) {
					case "table":
						parts.push(`    Maps to table: ${businessTerm.mapping.table}`);
						break;
					case "column":
						parts.push(`    Maps to: ${businessTerm.mapping.table}.${businessTerm.mapping.column}`);
						break;
					case "filter":
						parts.push(`    Filter: ${businessTerm.mapping.table} WHERE ${businessTerm.mapping.condition}`);
						break;
					case "calculated":
						parts.push(`    Expression: ${businessTerm.mapping.expression}`);
						break;
					case "concept":
						parts.push(`    Concept: ${businessTerm.mapping.definition}`);
						if (businessTerm.mapping.rules.length > 0) {
							parts.push("    Rules:");
							for (const rule of businessTerm.mapping.rules) parts.push(`      - ${rule}`);
						}
						break;
				}
			}
			parts.push("");
		}
		if (resolution.businessRules.length > 0) {
			parts.push("Business Rules (MUST follow):");
			for (const rule of resolution.businessRules) parts.push(`  - ${rule}`);
			parts.push("");
		}
		return parts.join("\n");
	}
	getAllTerms() {
		const seen = /* @__PURE__ */ new Set();
		const result = [];
		for (const term of this.terms.values()) if (!seen.has(term.term)) {
			seen.add(term.term);
			result.push(term);
		}
		return result;
	}
	getTermCount() {
		return this.getAllTerms().length;
	}
};
//#endregion
//#region src/backend/schema/schema-retriever.ts
var SchemaRetriever = class {
	constructor(schemaIntelligence, semanticLayer) {
		this.schemaIntelligence = schemaIntelligence;
		this.semanticLayer = semanticLayer;
	}
	/**
	* Given a user query, retrieve the relevant schema context and
	* business definitions for the LLM prompt.
	*/
	retrieve(userQuery) {
		const detectedTerms = this.semanticLayer.extractTerms(userQuery);
		const semanticResolution = this.semanticLayer.resolveTerms(detectedTerms);
		const keywords = this.extractKeywords(userQuery);
		const relevantTables = this.schemaIntelligence.findRelevantTables(keywords, 8);
		const relevantTableNames = new Set(relevantTables.map((t) => t.name));
		for (const tableName of semanticResolution.additionalTables) relevantTableNames.add(tableName);
		const finalTableNames = this.schemaIntelligence.expandWithRelatedTables(Array.from(relevantTableNames), 1).map((t) => t.name);
		const schemaContext = this.schemaIntelligence.buildSchemaContext(finalTableNames);
		return {
			schemaContext,
			semanticResolution,
			schemaPrompt: this.schemaIntelligence.serializeForPrompt(schemaContext),
			semanticPrompt: this.semanticLayer.serializeForPrompt(semanticResolution),
			retrievedTableNames: finalTableNames,
			hasAmbiguity: semanticResolution.ambiguousTerms.length > 0
		};
	}
	/**
	* Extract meaningful keywords from a natural language query.
	* Removes stop words and short tokens.
	*/
	extractKeywords(query) {
		const stopWords = new Set([
			"show",
			"me",
			"the",
			"a",
			"an",
			"in",
			"of",
			"for",
			"and",
			"or",
			"by",
			"with",
			"from",
			"to",
			"is",
			"are",
			"was",
			"were",
			"be",
			"been",
			"being",
			"have",
			"has",
			"had",
			"do",
			"does",
			"did",
			"will",
			"would",
			"could",
			"should",
			"may",
			"might",
			"shall",
			"can",
			"need",
			"dare",
			"ought",
			"used",
			"get",
			"got",
			"give",
			"gave",
			"find",
			"list",
			"display",
			"what",
			"which",
			"who",
			"whom",
			"how",
			"where",
			"when",
			"why",
			"all",
			"each",
			"every",
			"both",
			"few",
			"more",
			"most",
			"other",
			"some",
			"any",
			"no",
			"not",
			"only",
			"own",
			"same",
			"so",
			"than",
			"too",
			"very",
			"just",
			"also",
			"but",
			"if",
			"then",
			"else",
			"their",
			"them",
			"they",
			"this",
			"that",
			"these",
			"those",
			"i",
			"my",
			"we",
			"our",
			"you",
			"your",
			"he",
			"she",
			"it",
			"its",
			"between",
			"after",
			"before",
			"above",
			"below",
			"up",
			"down",
			"out",
			"off",
			"over",
			"under",
			"again",
			"further",
			"tell",
			"please",
			"want",
			"like",
			"know",
			"think",
			"see",
			"result",
			"results",
			"data",
			"information",
			"details",
			"compare",
			"comparison",
			"excluding",
			"including"
		]);
		return query.toLowerCase().replace(/[^\w\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word));
	}
};
//#endregion
//#region src/backend/schema/schema-config-loader.ts
var SchemaConfigLoader = class {
	basePath;
	constructor(databaseDir) {
		this.basePath = databaseDir;
	}
	/**
	* Load all config and register into the provided instances.
	*/
	load(schemaIntelligence, semanticLayer) {
		let tableCount = 0;
		let viewCount = 0;
		let termCount = 0;
		let ruleCount = 0;
		let relationshipCount = 0;
		const catalogPath = path.join(this.basePath, "schema_catalog.json");
		if (fs.existsSync(catalogPath)) {
			const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
			for (const [tableName, tableDef] of Object.entries(catalog.tables)) {
				const columns = [];
				for (const [colName, colDef] of Object.entries(tableDef.columns)) {
					const fkRef = colDef.fk ? this.parseForeignKey(colDef.fk) : void 0;
					columns.push({
						name: colName,
						dataType: colDef.type,
						nullable: colDef.nullable !== false,
						isPrimaryKey: colDef.pk === true,
						isForeignKey: !!colDef.fk,
						foreignKeyRef: fkRef,
						description: colDef.note || colDef.check,
						sensitive: this.isSensitiveColumn(colName)
					});
				}
				const table = {
					name: tableName,
					type: "table",
					schema: catalog.schema || "public",
					description: tableDef.description,
					columns,
					primaryKey: columns.filter((c) => c.isPrimaryKey).map((c) => c.name),
					tags: this.generateTags(tableName, tableDef.description)
				};
				schemaIntelligence.registerTable(table);
				tableCount++;
			}
			if (catalog.views) for (const viewName of catalog.views) {
				schemaIntelligence.registerTable({
					name: viewName,
					type: "view",
					schema: catalog.schema || "public",
					description: `Analytical view: ${viewName}`,
					columns: [],
					tags: this.generateTags(viewName, "")
				});
				viewCount++;
			}
			if (catalog.join_paths) for (const [name, pathStr] of Object.entries(catalog.join_paths)) {
				const tables = pathStr.split(" → ").map((t) => t.trim());
				schemaIntelligence.registerJoinPattern({
					name,
					description: `Join path: ${pathStr}`,
					tables,
					joinClause: this.buildJoinClause(name, tables),
					useCases: [name.replace(/_/g, " ")]
				});
			}
			console.log(`[ConfigLoader] Loaded ${tableCount} tables, ${viewCount} views from schema catalog`);
		}
		const relPath = path.join(this.basePath, "semantic", "relationships.json");
		if (fs.existsSync(relPath)) {
			const data = JSON.parse(fs.readFileSync(relPath, "utf-8"));
			const relationships = data.relationships || data;
			for (const rel of relationships) {
				schemaIntelligence.registerRelationship({
					fromTable: rel.from_table,
					fromColumn: rel.from_column,
					toTable: rel.to_table,
					toColumn: rel.to_column,
					type: rel.type || "many-to-one",
					description: rel.description
				});
				relationshipCount++;
			}
			console.log(`[ConfigLoader] Loaded ${relationshipCount} relationships`);
		}
		const glossaryPath = path.join(this.basePath, "semantic", "business_glossary.json");
		if (fs.existsSync(glossaryPath)) {
			const data = JSON.parse(fs.readFileSync(glossaryPath, "utf-8"));
			const glossary = data.glossary || data;
			for (const [key, entry] of Object.entries(glossary)) {
				const term = this.glossaryEntryToBusinessTerm(key, entry);
				semanticLayer.registerTerm(term);
				termCount++;
			}
			console.log(`[ConfigLoader] Loaded ${termCount} business terms`);
		}
		const rulesPath = path.join(this.basePath, "semantic", "business_rules.json");
		if (fs.existsSync(rulesPath)) {
			const data = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
			const rules = data.rules || data;
			for (const rule of rules) {
				semanticLayer.registerGlobalRule(`[${rule.id}] ${rule.name}: ${rule.description}`);
				ruleCount++;
			}
			console.log(`[ConfigLoader] Loaded ${ruleCount} business rules`);
		}
		const entitiesPath = path.join(this.basePath, "semantic", "entities.json");
		if (fs.existsSync(entitiesPath)) {
			const data = JSON.parse(fs.readFileSync(entitiesPath, "utf-8"));
			const entities = data.entities || data;
			for (const [entityName, entity] of Object.entries(entities)) if (entity.join_paths) for (const [jpName, jpClause] of Object.entries(entity.join_paths)) schemaIntelligence.registerJoinPattern({
				name: `${entityName}_${jpName}`,
				description: `Join ${entityName} to ${jpName}`,
				tables: [entity.primary_table, ...entity.related_tables || []],
				joinClause: jpClause,
				useCases: [`${entityName} ${jpName}`]
			});
			console.log(`[ConfigLoader] Loaded entity join patterns`);
		}
		const metricsPath = path.join(this.basePath, "semantic", "metrics.json");
		if (fs.existsSync(metricsPath)) {
			const data = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
			const metrics = data.metrics || data;
			for (const [metricKey, metric] of Object.entries(metrics)) {
				const aliases = this.generateMetricAliases(metricKey, metric.name);
				semanticLayer.registerTerm({
					term: metric.name.toLowerCase(),
					aliases,
					description: `${metric.name}: ${metric.expression}${metric.filter ? ` WHERE ${metric.filter}` : ""}`,
					mapping: {
						type: "calculated",
						expression: metric.expression,
						description: `${metric.name} (${metric.aggregation})`
					}
				});
				termCount++;
			}
			console.log(`[ConfigLoader] Loaded ${Object.keys(metrics).length} metric definitions`);
		}
		return {
			tableCount,
			viewCount,
			termCount,
			ruleCount,
			relationshipCount
		};
	}
	parseForeignKey(fkStr) {
		const parts = fkStr.split(".");
		if (parts.length === 2) return {
			table: parts[0],
			column: parts[1]
		};
	}
	isSensitiveColumn(name) {
		return [
			"salary",
			"income",
			"balance",
			"amount",
			"phone",
			"email",
			"date_of_birth",
			"dob",
			"password",
			"ssn",
			"pan",
			"aadhaar"
		].some((p) => name.toLowerCase().includes(p));
	}
	generateTags(name, description) {
		const tags = [];
		const lower = name.toLowerCase();
		if (lower.includes("employee") || lower.includes("dept") || lower.includes("department") || lower.includes("attendance") || lower.includes("performance")) tags.push("employee", "hr");
		if (lower.includes("customer") || lower.includes("segment")) tags.push("customer");
		if (lower.includes("account") || lower.includes("balance") || lower.includes("holder")) tags.push("account", "deposit");
		if (lower.includes("transaction") || lower.includes("txn")) tags.push("transaction");
		if (lower.includes("loan") || lower.includes("payment")) tags.push("loan", "lending");
		if (lower.includes("branch") || lower.includes("zone") || lower.includes("region") || lower.includes("state")) tags.push("geography", "organization");
		if (lower.includes("product")) tags.push("product");
		if (lower.includes("complaint") || lower.includes("interaction")) tags.push("service", "complaint");
		if (lower.includes("salary") || lower.includes("payroll")) tags.push("payroll");
		return [...new Set(tags)];
	}
	buildJoinClause(name, tables) {
		return tables.map((t, i) => {
			if (i === 0) return t;
			return `JOIN ${t} ON ...`;
		}).join(" ");
	}
	glossaryEntryToBusinessTerm(key, entry) {
		const aliases = this.generateTermAliases(key, entry.term);
		if (entry.sql_condition && entry.related_tables?.length === 1) return {
			term: entry.term.toLowerCase(),
			aliases,
			description: entry.definition,
			mapping: {
				type: "filter",
				table: entry.related_tables[0],
				condition: entry.sql_condition.replace(/^[a-z_]+\./, "")
			}
		};
		if (entry.sql_expression && !entry.related_tables) return {
			term: entry.term.toLowerCase(),
			aliases,
			description: entry.definition,
			mapping: {
				type: "calculated",
				expression: entry.sql_expression,
				description: entry.definition
			}
		};
		return {
			term: entry.term.toLowerCase(),
			aliases,
			description: entry.definition,
			mapping: {
				type: "concept",
				definition: entry.definition,
				relatedTables: entry.related_tables || [],
				relatedColumns: [],
				rules: entry.sql_condition ? [`Use condition: ${entry.sql_condition}`] : []
			}
		};
	}
	generateTermAliases(key, term) {
		const aliases = /* @__PURE__ */ new Set();
		aliases.add(key.replace(/_/g, " "));
		if (term.toLowerCase() !== key.replace(/_/g, " ")) aliases.add(term.toLowerCase());
		for (const a of {
			"active_employee": ["active staff", "current employees"],
			"contractual_employee": [
				"contract staff",
				"contract employee",
				"contractual staff"
			],
			"permanent_employee": ["regular employee", "permanent staff"],
			"employee_strength": [
				"headcount",
				"staff count",
				"employee count",
				"manpower"
			],
			"high_value_customer": [
				"hni customer",
				"premium customer",
				"high net worth"
			],
			"loan_portfolio": [
				"loan book",
				"outstanding loans",
				"advances"
			],
			"loan_growth": ["advance growth", "lending growth"],
			"npa": [
				"non performing asset",
				"bad loan",
				"non-performing"
			],
			"npa_ratio": ["npa percentage", "gross npa"],
			"financial_year": ["fiscal year", "fy"],
			"attrition": [
				"employee turnover",
				"staff leaving",
				"resignation"
			],
			"salary_cost": [
				"salary expense",
				"payroll cost",
				"staff cost"
			],
			"average_salary": ["mean salary", "avg salary"],
			"transaction_frequency": ["txn frequency", "transaction count"],
			"employee_productivity": ["productivity", "staff productivity"],
			"employee_performance": ["performance", "staff performance"]
		}[key] || []) aliases.add(a);
		return Array.from(aliases);
	}
	generateMetricAliases(key, name) {
		const aliases = /* @__PURE__ */ new Set();
		aliases.add(key.replace(/_/g, " "));
		aliases.add(name.toLowerCase());
		return Array.from(aliases);
	}
};
//#endregion
//#region src/backend/llm/llm-provider.ts
var LLMProvider = class {
	config;
	constructor(config) {
		this.config = {
			temperature: .1,
			maxTokens: 4096,
			timeoutMs: 6e4,
			maxRetries: 2,
			...config
		};
	}
	/** Get the current configuration (without secrets) */
	getConfig() {
		const { apiKey, ...safe } = this.config;
		return safe;
	}
	/** Generate a unique request ID for tracing */
	generateRequestId() {
		return `req_${randomUUID().replace(/-/g, "").substring(0, 16)}`;
	}
	/** Measure execution time of an async function */
	async withLatency(fn) {
		const start = performance.now();
		return {
			result: await fn(),
			latencyMs: Math.round(performance.now() - start)
		};
	}
};
//#endregion
//#region src/backend/llm/self-hosted-provider.ts
var SelfHostedLLMProvider = class extends LLMProvider {
	providerName;
	constructor(config, providerName = "self_hosted") {
		super(config);
		this.providerName = providerName;
	}
	async generate(options) {
		const requestId = this.generateRequestId();
		const messages = [];
		if (options.systemPrompt) messages.push({
			role: "system",
			content: options.systemPrompt
		});
		messages.push({
			role: "user",
			content: options.userPrompt
		});
		const body = {
			model: this.config.model,
			messages,
			temperature: options.temperature ?? this.config.temperature,
			max_tokens: options.maxTokens ?? this.config.maxTokens,
			stream: false
		};
		if (options.stopSequences && options.stopSequences.length > 0) body.stop = options.stopSequences;
		if (options.jsonMode) body.response_format = { type: "json_object" };
		const { result: response, latencyMs } = await this.withLatency(() => this.callWithRetry(body, requestId));
		const choice = response.choices[0];
		return {
			requestId,
			content: choice.message.content,
			model: response.model || this.config.model,
			usage: {
				promptTokens: response.usage?.prompt_tokens ?? 0,
				completionTokens: response.usage?.completion_tokens ?? 0,
				totalTokens: response.usage?.total_tokens ?? 0
			},
			latencyMs,
			finishReason: choice.finish_reason
		};
	}
	async generateStructured(options) {
		const response = await this.generate({
			...options,
			jsonMode: true
		});
		const parsed = this.parseJSON(response.content);
		return {
			...response,
			parsed
		};
	}
	async healthCheck() {
		try {
			const { result: response, latencyMs } = await this.withLatency(async () => {
				const url = `${this.config.baseUrl}/models`;
				const headers = { "Content-Type": "application/json" };
				if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
				const res = await fetch(url, {
					method: "GET",
					headers,
					signal: AbortSignal.timeout(1e4)
				});
				if (!res.ok) throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
				return res.json();
			});
			return {
				healthy: true,
				latencyMs,
				model: this.config.model
			};
		} catch (error) {
			return {
				healthy: false,
				latencyMs: 0,
				model: this.config.model,
				error: error.message
			};
		}
	}
	async getModelInfo() {
		const health = await this.healthCheck();
		return {
			model: this.config.model,
			provider: this.providerName,
			baseUrl: this.config.baseUrl,
			status: health.healthy ? "healthy" : "unavailable",
			metadata: {
				healthLatencyMs: health.latencyMs,
				configuredTemperature: this.config.temperature,
				configuredMaxTokens: this.config.maxTokens,
				configuredTimeoutMs: this.config.timeoutMs
			}
		};
	}
	async callWithRetry(body, requestId, attempt = 0) {
		const url = `${this.config.baseUrl}/chat/completions`;
		const headers = {
			"Content-Type": "application/json",
			"X-Request-ID": requestId
		};
		if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
		try {
			const res = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.config.timeoutMs)
			});
			if (!res.ok) {
				const errorBody = await res.text().catch(() => "");
				const error = /* @__PURE__ */ new Error(`LLM API error ${res.status}: ${res.statusText}. ${errorBody}`);
				error.status = res.status;
				throw error;
			}
			return await res.json();
		} catch (error) {
			if ((error.status >= 500 || error.name === "TimeoutError" || error.code === "ECONNREFUSED" || error.code === "ECONNRESET") && attempt < (this.config.maxRetries ?? 2)) {
				const backoffMs = Math.min(1e3 * Math.pow(2, attempt), 8e3);
				console.warn(`[LLM] Request ${requestId} failed (attempt ${attempt + 1}), retrying in ${backoffMs}ms: ${error.message}`);
				await new Promise((resolve) => setTimeout(resolve, backoffMs));
				return this.callWithRetry(body, requestId, attempt + 1);
			}
			throw error;
		}
	}
	parseJSON(text) {
		try {
			return JSON.parse(text.trim());
		} catch (_) {}
		const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		if (codeBlockMatch) try {
			return JSON.parse(codeBlockMatch[1].trim());
		} catch (_) {}
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start !== -1 && end > start) try {
			return JSON.parse(text.substring(start, end + 1));
		} catch (_) {}
		const arrStart = text.indexOf("[");
		const arrEnd = text.lastIndexOf("]");
		if (arrStart !== -1 && arrEnd > arrStart) try {
			return JSON.parse(text.substring(arrStart, arrEnd + 1));
		} catch (_) {}
		throw new Error(`Failed to parse LLM response as JSON. Raw content: ${text.substring(0, 200)}...`);
	}
};
//#endregion
//#region src/backend/pipeline/sql-guardian.ts
var SQLGuardian = class SQLGuardian {
	schema;
	config;
	constructor(schema, config = {}) {
		this.schema = schema;
		this.config = {
			maxResultRows: config.maxResultRows ?? 1e3,
			maxJoins: config.maxJoins ?? 10,
			maxSubqueryDepth: config.maxSubqueryDepth ?? 5,
			dialect: config.dialect ?? "postgresql",
			allowedSchemas: config.allowedSchemas,
			restrictedTables: config.restrictedTables ?? []
		};
	}
	/**
	* Validate a SQL statement. Returns validation result with errors,
	* warnings, and complexity score.
	*/
	validate(sql) {
		const errors = [];
		const warnings = [];
		const sqlUpper = sql.toUpperCase().trim();
		const sqlNormalized = this.removeComments(sql).trim();
		const destructiveCheck = this.checkDestructiveStatements(sqlUpper);
		if (destructiveCheck) errors.push(destructiveCheck);
		const dangerousChecks = this.checkDangerousConstructs(sqlUpper);
		errors.push(...dangerousChecks);
		if (!sqlUpper.startsWith("SELECT") && !sqlUpper.startsWith("WITH")) errors.push({
			code: "NOT_SELECT",
			message: "Only SELECT queries are permitted. The query must start with SELECT or WITH.",
			severity: "critical"
		});
		const referencedTables = this.extractTableReferences(sqlNormalized);
		for (const tableName of referencedTables) {
			if (!this.schema.tableExists(tableName)) errors.push({
				code: "TABLE_NOT_FOUND",
				message: `Table "${tableName}" does not exist in the known schema.`,
				severity: "error"
			});
			if (this.config.restrictedTables?.includes(tableName.toUpperCase())) errors.push({
				code: "RESTRICTED_TABLE",
				message: `Access to table "${tableName}" is restricted.`,
				severity: "critical"
			});
			if (this.schema.isTableRestricted(tableName)) errors.push({
				code: "RESTRICTED_TABLE",
				message: `Table "${tableName}" requires additional authorization.`,
				severity: "critical"
			});
		}
		for (const problem of this.detectDegenerateAggregates(sqlNormalized)) errors.push({
			code: "DEGENERATE_AGGREGATE",
			message: problem,
			severity: "error"
		});
		const complexity = this.analyzeComplexity(sqlUpper);
		if (complexity.joinCount > this.config.maxJoins) warnings.push({
			code: "HIGH_JOIN_COUNT",
			message: `Query has ${complexity.joinCount} joins (max recommended: ${this.config.maxJoins}).`
		});
		if (complexity.subqueryDepth > this.config.maxSubqueryDepth) warnings.push({
			code: "DEEP_SUBQUERY",
			message: `Query has subquery nesting depth of ${complexity.subqueryDepth} (max: ${this.config.maxSubqueryDepth}).`
		});
		if (this.detectCartesianJoin(sqlUpper, referencedTables.length)) warnings.push({
			code: "POSSIBLE_CARTESIAN",
			message: "Query may produce a Cartesian product. Verify that all tables have proper join conditions."
		});
		let modifiedSql = sql;
		const topLevel = this.stripParenGroups(sql);
		const topLevelLimit = /\bLIMIT\s+(\d+)/i.exec(topLevel);
		if (!this.hasResultLimit(topLevel.toUpperCase())) {
			modifiedSql = this.applyResultLimit(sql);
			warnings.push({
				code: "LIMIT_APPLIED",
				message: `Result limit of ${this.config.maxResultRows} rows applied for safety.`
			});
		} else if (topLevelLimit && parseInt(topLevelLimit[1], 10) > this.config.maxResultRows) {
			const idx = sql.toUpperCase().lastIndexOf("LIMIT");
			modifiedSql = sql.slice(0, idx) + sql.slice(idx).replace(/\bLIMIT\s+\d+/i, `LIMIT ${this.config.maxResultRows}`);
			warnings.push({
				code: "LIMIT_REDUCED",
				message: `Result limit reduced from ${topLevelLimit[1]} to ${this.config.maxResultRows} rows.`
			});
		}
		return {
			valid: errors.length === 0,
			errors,
			warnings,
			complexity,
			modifiedSql: errors.length === 0 ? modifiedSql : void 0
		};
	}
	checkDestructiveStatements(sqlUpper) {
		for (const { pattern, name } of [
			{
				pattern: /\bINSERT\s+INTO\b/,
				name: "INSERT"
			},
			{
				pattern: /\bUPDATE\s+\w/,
				name: "UPDATE"
			},
			{
				pattern: /\bDELETE\s+FROM\b/,
				name: "DELETE"
			},
			{
				pattern: /\bDROP\s+(TABLE|VIEW|INDEX|SCHEMA|DATABASE|SEQUENCE|FUNCTION|PROCEDURE|TRIGGER)\b/,
				name: "DROP"
			},
			{
				pattern: /\bALTER\s+(TABLE|VIEW|INDEX|SCHEMA|DATABASE|SEQUENCE)\b/,
				name: "ALTER"
			},
			{
				pattern: /\bTRUNCATE\s/,
				name: "TRUNCATE"
			},
			{
				pattern: /\bCREATE\s+(TABLE|VIEW|INDEX|SCHEMA|DATABASE|SEQUENCE|FUNCTION|PROCEDURE|TRIGGER)\b/,
				name: "CREATE"
			},
			{
				pattern: /\bGRANT\s/,
				name: "GRANT"
			},
			{
				pattern: /\bREVOKE\s/,
				name: "REVOKE"
			},
			{
				pattern: /\bMERGE\s+INTO\b/,
				name: "MERGE"
			},
			{
				pattern: /\bEXEC(UTE)?\s/,
				name: "EXECUTE"
			},
			{
				pattern: /\bCALL\s/,
				name: "CALL"
			}
		]) if (pattern.test(sqlUpper)) return {
			code: "DESTRUCTIVE_OPERATION",
			message: `${name} operations are not permitted. Only SELECT queries are allowed.`,
			severity: "critical"
		};
		return null;
	}
	checkDangerousConstructs(sqlUpper) {
		const errors = [];
		for (const { pattern, description } of [
			{
				pattern: /;\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)/,
				description: "Multiple statements with destructive operations"
			},
			{
				pattern: /--\s*$/,
				description: "SQL comment at end of query (potential injection)"
			},
			{
				pattern: /\/\*[\s\S]*\*\/\s*(INSERT|UPDATE|DELETE|DROP)/,
				description: "Block comment followed by destructive operation"
			},
			{
				pattern: /\bXP_CMDSHELL\b/,
				description: "System command execution attempt"
			},
			{
				pattern: /\bDBMS_/,
				description: "Oracle DBMS package call"
			},
			{
				pattern: /\bUTL_/,
				description: "Oracle UTL package call"
			},
			{
				pattern: /\bPG_SLEEP\b/,
				description: "PostgreSQL sleep function (timing attack)"
			},
			{
				pattern: /\bBENCHMARK\s*\(/,
				description: "MySQL benchmark function (timing attack)"
			},
			{
				pattern: /\bLOAD_FILE\b/,
				description: "File access attempt"
			},
			{
				pattern: /\bINTO\s+OUTFILE\b/,
				description: "File write attempt"
			},
			{
				pattern: /\bINTO\s+DUMPFILE\b/,
				description: "File dump attempt"
			}
		]) if (pattern.test(sqlUpper)) errors.push({
			code: "DANGEROUS_CONSTRUCT",
			message: `Dangerous SQL construct detected: ${description}`,
			severity: "critical"
		});
		if (sqlUpper.replace(/;\s*$/, "").includes(";")) errors.push({
			code: "MULTIPLE_STATEMENTS",
			message: "Multiple SQL statements are not permitted.",
			severity: "critical"
		});
		return errors;
	}
	analyzeComplexity(sqlUpper) {
		const joinMatches = sqlUpper.match(/\bJOIN\b/g);
		const joinCount = joinMatches ? joinMatches.length : 0;
		const cteMatches = sqlUpper.match(/\bWITH\b/g);
		const cteCount = cteMatches ? cteMatches.length : 0;
		const subqueryDepth = this.measureSubqueryDepth(sqlUpper);
		const aggFunctions = [
			"COUNT",
			"SUM",
			"AVG",
			"MIN",
			"MAX",
			"GROUP_CONCAT",
			"STRING_AGG",
			"ARRAY_AGG"
		];
		let aggregationCount = 0;
		for (const fn of aggFunctions) {
			const regex = new RegExp(`\\b${fn}\\s*\\(`, "g");
			const matches = sqlUpper.match(regex);
			aggregationCount += matches ? matches.length : 0;
		}
		const windowMatches = sqlUpper.match(/\bOVER\s*\(/g);
		const windowFunctionCount = windowMatches ? windowMatches.length : 0;
		let estimatedComplexity;
		const score = joinCount * 2 + subqueryDepth * 3 + cteCount * 2 + aggregationCount + windowFunctionCount * 2;
		if (score <= 3) estimatedComplexity = "low";
		else if (score <= 8) estimatedComplexity = "medium";
		else if (score <= 15) estimatedComplexity = "high";
		else estimatedComplexity = "very_high";
		return {
			joinCount,
			subqueryDepth,
			cteCount,
			aggregationCount,
			windowFunctionCount,
			estimatedComplexity
		};
	}
	measureSubqueryDepth(sql) {
		let maxDepth = 0;
		let currentDepth = 0;
		let inString = false;
		let stringChar = "";
		for (let i = 0; i < sql.length; i++) {
			const char = sql[i];
			if ((char === "'" || char === "\"") && !inString) {
				inString = true;
				stringChar = char;
			} else if (char === stringChar && inString) inString = false;
			if (!inString) {
				if (char === "(") {
					currentDepth++;
					maxDepth = Math.max(maxDepth, currentDepth);
				} else if (char === ")") currentDepth = Math.max(0, currentDepth - 1);
			}
		}
		return maxDepth;
	}
	/**
	* Functions where FROM is part of the call syntax rather than a table
	* reference, e.g. EXTRACT(YEAR FROM col) or TRIM(BOTH ' ' FROM col).
	*/
	static FROM_ARG_FUNCTIONS = [
		"EXTRACT",
		"SUBSTRING",
		"TRIM",
		"POSITION",
		"OVERLAY"
	];
	/**
	* Blank out the interior of FROM_ARG_FUNCTIONS calls so their internal
	* FROM keyword is not mistaken for a table reference. Paren-balanced, so
	* nested calls are handled correctly.
	*/
	maskFromArgFunctions(sql) {
		let out = sql;
		for (const fn of SQLGuardian.FROM_ARG_FUNCTIONS) {
			const re = new RegExp(`\\b${fn}\\s*\\(`, "gi");
			let match;
			while ((match = re.exec(out)) !== null) {
				const open = match.index + match[0].length - 1;
				let depth = 0;
				let i = open;
				for (; i < out.length; i++) if (out[i] === "(") depth++;
				else if (out[i] === ")") {
					depth--;
					if (depth === 0) break;
				}
				const close = Math.min(i, out.length);
				out = out.slice(0, open + 1) + " ".repeat(close - open - 1) + out.slice(close);
				re.lastIndex = close;
			}
		}
		return out;
	}
	/**
	* Collect names defined by WITH ... AS (...) so CTE references are not
	* validated against the physical schema.
	*/
	extractCteNames(sql) {
		const names = /* @__PURE__ */ new Set();
		const re = /(?:\bWITH\b|,)\s*(?:RECURSIVE\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*(?:(?:NOT\s+)?MATERIALIZED\s*)?\(/gi;
		let match;
		while ((match = re.exec(sql)) !== null) names.add(match[1].toLowerCase());
		return names;
	}
	/**
	* An aggregate over a column that also appears in the same SELECT's GROUP BY
	* is degenerate: each group holds one distinct value of that column, so
	* AVG/MEDIAN of it equals the row's own value. Comparing a row against such a
	* "group statistic" is never true, and the query silently returns zero rows.
	* Models produce this repeatedly when asked for "above their department
	* average"; prompt rules did not stop it, so it is caught here.
	*/
	detectDegenerateAggregates(sql) {
		const problems = [];
		const bare = (c) => c.trim().split(".").pop().toLowerCase();
		const groupByRe = /\bGROUP\s+BY\b([\s\S]*?)(?=\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bWINDOW\b|\bUNION\b|\bSELECT\b|\)|$)/gi;
		let m;
		while ((m = groupByRe.exec(sql)) !== null) {
			const groupCols = new Set(m[1].split(",").map((c) => bare(c)).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c)));
			if (groupCols.size === 0) continue;
			const before = sql.slice(0, m.index);
			const selectStart = before.toUpperCase().lastIndexOf("SELECT");
			if (selectStart === -1) continue;
			const selectList = before.slice(selectStart);
			const aggregated = /* @__PURE__ */ new Set();
			for (const re of [/\b(?:AVG|SUM|MIN|MAX)\s*\(\s*(?:DISTINCT\s+)?([a-zA-Z_][\w.]*)\s*\)/gi, /\bPERCENTILE_(?:CONT|DISC)\s*\([^)]*\)\s*WITHIN\s+GROUP\s*\(\s*ORDER\s+BY\s+([a-zA-Z_][\w.]*)/gi]) {
				let a;
				while ((a = re.exec(selectList)) !== null) aggregated.add(bare(a[1]));
			}
			for (const col of aggregated) if (groupCols.has(col)) problems.push(`"${col}" is aggregated and also listed in GROUP BY, so each group contains a single value and the aggregate equals that row's own value. Group only by the grouping key (e.g. department_id) and join the result back.`);
		}
		return Array.from(new Set(problems));
	}
	extractTableReferences(sql) {
		const tables = /* @__PURE__ */ new Set();
		const masked = this.maskFromArgFunctions(sql);
		const cteNames = this.extractCteNames(masked);
		for (const pattern of [/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi, /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi]) {
			let match;
			while ((match = pattern.exec(masked)) !== null) {
				const tableName = match[2] || match[1];
				if (new Set([
					"SELECT",
					"WHERE",
					"GROUP",
					"ORDER",
					"HAVING",
					"LIMIT",
					"OFFSET",
					"UNION",
					"INTERSECT",
					"EXCEPT",
					"LATERAL",
					"UNNEST",
					"DUAL"
				]).has(tableName.toUpperCase())) continue;
				if (cteNames.has(tableName.toLowerCase())) continue;
				tables.add(tableName);
			}
		}
		return Array.from(tables);
	}
	detectCartesianJoin(sqlUpper, tableCount) {
		if (tableCount > 1) {
			/\bJOIN\b/.test(sqlUpper);
			const hasWhere = /\bWHERE\b/.test(sqlUpper);
			if (/\bFROM\s+\w+\s*,\s*\w+/.test(sqlUpper) && !hasWhere) return true;
		}
		return false;
	}
	/**
	* Remove balanced parenthesised spans, leaving only top-level text. A LIMIT
	* inside a CTE or subquery does not bound the statement's result, so counting
	* one lets an unbounded query through.
	*/
	stripParenGroups(sql) {
		let out = "";
		let depth = 0;
		for (const ch of sql) {
			if (ch === "(") {
				depth++;
				continue;
			}
			if (ch === ")") {
				if (depth > 0) depth--;
				continue;
			}
			if (depth === 0) out += ch;
		}
		return out;
	}
	hasResultLimit(sqlUpper) {
		return /\bLIMIT\s+\d+/i.test(sqlUpper) || /\bFETCH\s+(FIRST|NEXT)\s+\d+\s+ROW/i.test(sqlUpper) || /\bROWNUM\s*<=/i.test(sqlUpper) || /\bTOP\s+\d+/i.test(sqlUpper);
	}
	applyResultLimit(sql) {
		const trimmed = sql.replace(/;\s*$/, "").trim();
		if (this.config.dialect === "postgresql" || this.config.dialect === "sqlite") return `${trimmed}\nLIMIT ${this.config.maxResultRows}`;
		else if (this.config.dialect === "oracle") return `${trimmed}\nFETCH FIRST ${this.config.maxResultRows} ROWS ONLY`;
		return `${trimmed}\nLIMIT ${this.config.maxResultRows}`;
	}
	removeComments(sql) {
		let result = sql.replace(/--.*$/gm, "");
		result = result.replace(/\/\*[\s\S]*?\*\//g, "");
		return result;
	}
};
//#endregion
//#region src/backend/audit/audit-logger.ts
var AuditLogger = class {
	logDir;
	logFile;
	inMemoryLog = [];
	constructor(logDir) {
		this.logDir = logDir || path.join(process.cwd(), "audit_logs");
		this.logFile = path.join(this.logDir, `audit_${this.getDateStamp()}.jsonl`);
		try {
			if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
		} catch (error) {
			console.warn("[Audit] Could not create log directory:", error);
		}
	}
	/**
	* Log an audit entry. Writes to both file (JSONL) and in-memory store.
	*/
	log(entry) {
		const sanitized = this.sanitize(entry);
		this.inMemoryLog.push(sanitized);
		if (this.inMemoryLog.length > 1e3) this.inMemoryLog = this.inMemoryLog.slice(-500);
		try {
			fs.appendFileSync(this.logFile, JSON.stringify(sanitized) + "\n", "utf-8");
		} catch (error) {
			console.warn("[Audit] Could not write log:", error);
		}
	}
	/**
	* Get recent audit entries (for admin dashboard).
	*/
	getRecent(limit = 50) {
		return this.inMemoryLog.slice(-limit).reverse();
	}
	/**
	* Get aggregate metrics.
	*/
	getMetrics() {
		const entries = this.inMemoryLog;
		if (entries.length === 0) return {
			totalQueries: 0,
			successRate: 0,
			avgExecutionTimeMs: 0,
			avgRepairAttempts: 0,
			topTables: [],
			queriesLast24h: 0
		};
		const successful = entries.filter((e) => e.executionStatus === "success").length;
		const avgTime = entries.reduce((sum, e) => sum + e.executionTimeMs, 0) / entries.length;
		const avgRepairs = entries.reduce((sum, e) => sum + e.repairAttempts, 0) / entries.length;
		const tableCounts = /* @__PURE__ */ new Map();
		for (const entry of entries) for (const table of entry.retrievedTables) tableCounts.set(table, (tableCounts.get(table) || 0) + 1);
		const topTables = Array.from(tableCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([table, count]) => ({
			table,
			count
		}));
		const now = Date.now();
		const last24h = entries.filter((e) => now - new Date(e.timestamp).getTime() < 864e5).length;
		return {
			totalQueries: entries.length,
			successRate: successful / entries.length * 100,
			avgExecutionTimeMs: Math.round(avgTime),
			avgRepairAttempts: Math.round(avgRepairs * 100) / 100,
			topTables,
			queriesLast24h: last24h
		};
	}
	sanitize(entry) {
		return {
			...entry,
			generatedSql: entry.generatedSql.replace(/password\s*=\s*'[^']*'/gi, "password='***'")
		};
	}
	getDateStamp() {
		return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
	}
};
//#endregion
//#region src/backend/pipeline/query-orchestrator.ts
var QueryOrchestrator = class {
	llm;
	schemaRetriever;
	guardian;
	db;
	auditLogger;
	config;
	conversations = /* @__PURE__ */ new Map();
	/** Lazily loaded once per process: actual date span of every date column */
	dataCoverage = null;
	constructor(llm, schemaRetriever, guardian, db, auditLogger, config = {}) {
		this.llm = llm;
		this.schemaRetriever = schemaRetriever;
		this.guardian = guardian;
		this.db = db;
		this.auditLogger = auditLogger;
		this.config = {
			fastMode: config.fastMode ?? true,
			maxRepairAttempts: config.maxRepairAttempts ?? 3,
			maxResultRows: config.maxResultRows ?? 1e3,
			sqlTimeoutMs: config.sqlTimeoutMs ?? 3e4,
			llmTimeoutMs: config.llmTimeoutMs ?? 6e4,
			dialect: config.dialect ?? "postgresql"
		};
	}
	/**
	* Process a natural language query through the full pipeline.
	*/
	async processQuery(request) {
		const requestId = `req_${randomUUID().replace(/-/g, "").substring(0, 16)}`;
		const pipelineStart = performance.now();
		const stages = [];
		let totalLlmLatency = 0;
		let repairAttempts = 0;
		try {
			const retrievalStart = performance.now();
			const retrieval = this.schemaRetriever.retrieve(request.question);
			stages.push({
				name: "Schema & Semantic Retrieval",
				status: "success",
				durationMs: Math.round(performance.now() - retrievalStart),
				details: `Retrieved ${retrieval.retrievedTableNames.length} tables`
			});
			if (retrieval.hasAmbiguity) {
				const ambiguousTerm = retrieval.semanticResolution.ambiguousTerms[0];
				const options = ambiguousTerm.possibleMeanings.map((m) => ({
					label: m.label,
					description: m.description,
					value: m.label
				}));
				return {
					requestId,
					success: false,
					errorType: "ambiguity",
					error: `The term "${ambiguousTerm.term}" has multiple business meanings. Please clarify which one you mean.`,
					clarificationOptions: options,
					debug: this.buildDebugMetadata(requestId, "", [], [], "", "ambiguity", 0, 0, 0, 0, stages)
				};
			}
			const planStart = performance.now();
			const conversationContext = this.getConversationContext(request);
			let plan;
			if (this.config.fastMode && !this.shouldPlan(request.question)) plan = this.buildInlinePlan(request.question, retrieval, conversationContext);
			else {
				plan = await this.generateSQLPlan(request.question, retrieval, conversationContext);
				const planLatency = Math.round(performance.now() - planStart);
				totalLlmLatency += planLatency;
				stages.push({
					name: "SQL Planning",
					status: "success",
					durationMs: planLatency,
					details: `Intent: ${plan.intent}`
				});
			}
			const genStart = performance.now();
			let sql = await this.generateSQL(plan, retrieval);
			const genLatency = Math.round(performance.now() - genStart);
			totalLlmLatency += genLatency;
			stages.push({
				name: "SQL Generation",
				status: "success",
				durationMs: genLatency,
				details: `Generated ${sql.length} chars`
			});
			const valStart = performance.now();
			let validation = this.guardian.validate(sql);
			stages.push({
				name: "SQL Validation",
				status: validation.valid ? "success" : "error",
				durationMs: Math.round(performance.now() - valStart),
				details: validation.valid ? `Passed (${validation.warnings.length} warnings)` : `Failed: ${validation.errors.map((e) => e.message).join("; ")}`
			});
			if (!validation.valid) {
				const repairResult = await this.repairSQL(sql, validation, retrieval, plan);
				repairAttempts = repairResult.attempts;
				totalLlmLatency += repairResult.llmLatencyMs;
				if (repairResult.success) {
					sql = repairResult.sql;
					validation = repairResult.validation;
					stages.push({
						name: "SQL Repair",
						status: "success",
						durationMs: repairResult.totalMs,
						details: `Fixed after ${repairResult.attempts} attempt(s)`
					});
				} else return {
					requestId,
					success: false,
					sql,
					sqlPlan: plan,
					validationResult: validation,
					error: `Generated SQL failed validation: ${validation.errors.map((e) => e.message).join(". ")}`,
					errorType: "validation",
					debug: this.buildDebugMetadata(requestId, "", retrieval.retrievedTableNames, this.getBusinessDefs(retrieval), sql, "validation_failed", 0, totalLlmLatency, 0, repairAttempts, stages)
				};
			}
			const executableSql = validation.modifiedSql || sql;
			const execStart = performance.now();
			try {
				const result = await this.db.executeQuery(executableSql, [], this.config.sqlTimeoutMs);
				const execMs = Math.round(performance.now() - execStart);
				stages.push({
					name: "SQL Execution",
					status: "success",
					durationMs: execMs,
					details: `${result.rowCount} rows in ${result.executionTimeMs}ms`
				});
				const summaryStart = performance.now();
				const truncated = result.rowCount >= this.config.maxResultRows;
				let emptyDiagnosis;
				let summary;
				if (result.rowCount === 0) {
					const diagnosis = await this.diagnoseEmptyResult(request.question, executableSql, retrieval);
					emptyDiagnosis = diagnosis.probes.length > 0 ? diagnosis.probes : void 0;
					summary = {
						summary: diagnosis.summary,
						filters: plan.filters
					};
				} else summary = await this.generateSummary(request.question, plan, result.rows, result.rowCount, truncated);
				const summaryLatency = Math.round(performance.now() - summaryStart);
				totalLlmLatency += summaryLatency;
				stages.push({
					name: "Result Summary",
					status: "success",
					durationMs: summaryLatency
				});
				this.updateConversationContext(request, sql, plan, retrieval.retrievedTableNames);
				const totalMs = Math.round(performance.now() - pipelineStart);
				this.auditLogger.log({
					requestId,
					userId: request.userId || "anonymous",
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					userQuestion: request.question,
					model: this.llm.getConfig().model,
					retrievedTables: retrieval.retrievedTableNames,
					retrievedBusinessRules: this.getBusinessDefs(retrieval),
					generatedSql: sql,
					validationResult: validation.valid ? "passed" : "failed",
					executionStatus: "success",
					executionTimeMs: totalMs,
					rowCount: result.rowCount,
					repairAttempts
				});
				return {
					requestId,
					success: true,
					data: result.rows,
					rowCount: result.rowCount,
					fields: result.fields,
					truncated,
					emptyResultDiagnosis: emptyDiagnosis,
					summary: summary.summary,
					filtersApplied: summary.filters,
					executionTimeMs: totalMs,
					sql,
					sqlPlan: plan,
					validationResult: validation,
					debug: this.buildDebugMetadata(requestId, plan.intent, retrieval.retrievedTableNames, this.getBusinessDefs(retrieval), sql, "success", totalMs, totalLlmLatency, result.rowCount, repairAttempts, stages)
				};
			} catch (execError) {
				stages.push({
					name: "SQL Execution",
					status: "error",
					durationMs: Math.round(performance.now() - execStart),
					details: execError.message
				});
				const repairResult = await this.repairSQLFromError(sql, execError.message, retrieval, plan);
				repairAttempts += repairResult.attempts;
				totalLlmLatency += repairResult.llmLatencyMs;
				if (repairResult.success) {
					const reExecStart = performance.now();
					const reResult = await this.db.executeQuery(repairResult.validation.modifiedSql || repairResult.sql, [], this.config.sqlTimeoutMs);
					stages.push({
						name: "SQL Repair + Re-execution",
						status: "success",
						durationMs: Math.round(performance.now() - reExecStart),
						details: `Fixed and got ${reResult.rowCount} rows`
					});
					const reTruncated = reResult.rowCount >= this.config.maxResultRows;
					const summary = await this.generateSummary(request.question, plan, reResult.rows, reResult.rowCount, reTruncated);
					totalLlmLatency += 500;
					const totalMs = Math.round(performance.now() - pipelineStart);
					this.updateConversationContext(request, repairResult.sql, plan, retrieval.retrievedTableNames);
					this.auditLogger.log({
						requestId,
						userId: request.userId || "anonymous",
						timestamp: (/* @__PURE__ */ new Date()).toISOString(),
						userQuestion: request.question,
						model: this.llm.getConfig().model,
						retrievedTables: retrieval.retrievedTableNames,
						retrievedBusinessRules: this.getBusinessDefs(retrieval),
						generatedSql: repairResult.sql,
						validationResult: "passed_after_repair",
						executionStatus: "success",
						executionTimeMs: totalMs,
						rowCount: reResult.rowCount,
						repairAttempts
					});
					return {
						requestId,
						success: true,
						data: reResult.rows,
						rowCount: reResult.rowCount,
						fields: reResult.fields,
						truncated: reTruncated,
						summary: summary.summary,
						filtersApplied: summary.filters,
						executionTimeMs: totalMs,
						sql: repairResult.sql,
						sqlPlan: plan,
						validationResult: repairResult.validation,
						debug: this.buildDebugMetadata(requestId, plan.intent, retrieval.retrievedTableNames, this.getBusinessDefs(retrieval), repairResult.sql, "success_after_repair", totalMs, totalLlmLatency, reResult.rowCount, repairAttempts, stages)
					};
				}
				const totalMs = Math.round(performance.now() - pipelineStart);
				return {
					requestId,
					success: false,
					sql,
					error: `I was unable to generate a correct query for this request. The database returned: ${execError.message}`,
					errorType: "execution",
					sqlPlan: plan,
					validationResult: validation,
					executionTimeMs: totalMs,
					debug: this.buildDebugMetadata(requestId, plan.intent, retrieval.retrievedTableNames, this.getBusinessDefs(retrieval), sql, "execution_failed", totalMs, totalLlmLatency, 0, repairAttempts, stages)
				};
			}
		} catch (error) {
			const totalMs = Math.round(performance.now() - pipelineStart);
			const errorType = error.message?.includes("LLM") ? "llm" : "system";
			return {
				requestId,
				success: false,
				error: `An internal error occurred: ${error.message}`,
				errorType,
				executionTimeMs: totalMs,
				debug: this.buildDebugMetadata(requestId, "", [], [], "", `error_${errorType}`, totalMs, totalLlmLatency, 0, repairAttempts, stages)
			};
		}
	}
	/**
	* The dataset does not necessarily end today, and the model cannot guess its
	* span. Without this, relative time windows get hardcoded to plausible-looking
	* calendar years that miss the data entirely and silently return zero rows.
	* Computed once per process and cached.
	*/
	async getDataCoverage() {
		if (this.dataCoverage !== null) return this.dataCoverage;
		try {
			const cols = await this.db.executeQuery(`SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')
          ORDER BY table_name, column_name`, [], this.config.sqlTimeoutMs);
			if (cols.rowCount === 0) {
				this.dataCoverage = "";
				return this.dataCoverage;
			}
			const parts = cols.rows.map((c) => `SELECT '${c.table_name}.${c.column_name}' AS col, MIN(${c.column_name})::text AS lo, MAX(${c.column_name})::text AS hi FROM ${c.table_name}`);
			const lines = (await this.db.executeQuery(parts.join(" UNION ALL "), [], this.config.sqlTimeoutMs)).rows.filter((r) => r.lo && r.hi).map((r) => `  ${r.col}: ${String(r.lo).slice(0, 10)} to ${String(r.hi).slice(0, 10)}`);
			const periodCols = await this.db.executeQuery(`SELECT table_name, column_name, data_type
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND (
                 (data_type IN ('integer','bigint','smallint','numeric')
                   AND (column_name ~* '(financial|fiscal)_year' OR column_name ~* '(^|_)year$'))
              OR (data_type IN ('character varying','text','character')
                   AND column_name ~* '(quarter|period)')
            )
          ORDER BY table_name, column_name`, [], this.config.sqlTimeoutMs);
			for (const c of periodCols.rows) try {
				if (String(c.data_type).startsWith("char") || c.data_type === "text") {
					const list = (await this.db.executeQuery(`SELECT DISTINCT ${c.column_name} AS v FROM ${c.table_name}
                WHERE ${c.column_name} IS NOT NULL ORDER BY 1 LIMIT 12`, [], this.config.sqlTimeoutMs)).rows.map((r) => r.v).join(", ");
					if (list) lines.push(`  ${c.table_name}.${c.column_name}: ${list}`);
				} else {
					const r = (await this.db.executeQuery(`SELECT MIN(${c.column_name})::text lo, MAX(${c.column_name})::text hi FROM ${c.table_name}`, [], this.config.sqlTimeoutMs)).rows[0];
					if (r?.lo && r?.hi) lines.push(`  ${c.table_name}.${c.column_name}: ${r.lo} to ${r.hi}`);
				}
			} catch {}
			try {
				const unions = (await this.db.executeQuery(`SELECT table_name, column_name
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND data_type IN ('character varying','text','character')
              AND column_name ~* '(status|type_name|category|priority|risk|segment|gender|_name$)'
              AND table_name NOT LIKE 'vw_%'
            ORDER BY table_name, column_name`, [], this.config.sqlTimeoutMs)).rows.map((c) => `SELECT '${c.table_name}.${c.column_name}' AS col, v::text AS val FROM (SELECT DISTINCT ${c.column_name} AS v FROM ${c.table_name}  WHERE ${c.column_name} IS NOT NULL LIMIT 26) s_${c.table_name}_${c.column_name}`);
				if (unions.length > 0) {
					const vals = await this.db.executeQuery(unions.join(" UNION ALL "), [], this.config.sqlTimeoutMs);
					const byCol = /* @__PURE__ */ new Map();
					for (const r of vals.rows) {
						if (!byCol.has(r.col)) byCol.set(r.col, []);
						byCol.get(r.col).push(r.val);
					}
					const catLines = [];
					for (const [col, values] of byCol) {
						if (values.length === 0 || values.length > 25) continue;
						catLines.push(`  ${col}: ${values.sort().join(" | ")}`);
					}
					if (catLines.length > 0) {
						lines.push("");
						lines.push("EXACT VALUES stored in categorical columns — filter using these");
						lines.push("strings verbatim. Never invent or abbreviate a value:");
						lines.push(...catLines);
					}
				}
			} catch (err) {
				console.warn(`[Orchestrator] Could not profile categorical values: ${err.message}`);
			}
			this.dataCoverage = lines.length ? `\n=== ACTUAL DATA COVERAGE (today is ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}) ===\nThese are the real ranges present. Any period you filter on must fall inside them.\nTables do not all cover the same span — when a question spans two tables, use the\noverlap of their ranges, never a period that only one of them has.\n` + lines.join("\n") + "\n" : "";
		} catch (err) {
			console.warn(`[Orchestrator] Could not determine data coverage: ${err.message}`);
			this.dataCoverage = "";
		}
		return this.dataCoverage;
	}
	/**
	* Questions whose SQL needs a plan first. Dropping planning on these produced
	* wrong or invalid SQL in testing (multi-condition and trend questions
	* especially), so they keep the extra round trip. Everything else skips it.
	*/
	shouldPlan(question) {
		const q = question.toLowerCase();
		if ([
			"consecutive",
			"year over year",
			"year-over-year",
			"yoy",
			"quarter over quarter",
			"quarter-over-quarter",
			"compare",
			"comparison",
			"versus",
			" vs ",
			"while",
			"despite",
			"whereas",
			"trend",
			"growth",
			"declin",
			"increas",
			"decreas",
			"percentile",
			"median",
			"top 5%",
			"top 10%",
			"bottom",
			"average",
			"median",
			"above",
			"below",
			"exceeds",
			"faster than",
			"slower than",
			"in each",
			"for every",
			"within each",
			"per region",
			"per department",
			"before and after",
			"unresolved",
			"attrition",
			"opposite",
			" but "
		].some((sig) => q.includes(sig))) return true;
		return question.trim().split(/\s+/).length > 14;
	}
	/**
	* A plan built without an LLM round trip. Carries the question and retrieved
	* context so generation, repair and audit keep the same shape as full mode.
	*/
	buildInlinePlan(question, retrieval, conversationContext) {
		return {
			intent: question,
			entities: retrieval.retrievedTableNames,
			filters: [],
			metrics: [],
			groupBy: [],
			orderBy: [],
			reasoning: conversationContext ? `${conversationContext}\n\nAnswer this question: ${question}` : question
		};
	}
	async generateSQLPlan(question, retrieval, conversationContext) {
		const coverage = await this.getDataCoverage();
		const systemPrompt = `You are an expert SQL query planner for a banking database (${this.config.dialect} dialect).
Your task is to analyze a natural language question and produce a structured query plan.

${retrieval.schemaPrompt}
${retrieval.semanticPrompt}
${coverage}
Any period you choose MUST lie within the data coverage above. Never plan a window
outside it — that returns zero rows. For "recent"/"last N periods", use the latest
periods that actually exist in the data.

${conversationContext ? `\n=== CONVERSATION CONTEXT ===\n${conversationContext}\n` : ""}

You MUST respond with a valid JSON object containing:
{
  "intent": "brief description of the query intent",
  "entities": ["list of database entities/tables needed"],
  "filters": ["list of filter conditions in natural language"],
  "metrics": ["list of metrics/aggregations needed"],
  "groupBy": ["columns to group by"],
  "orderBy": ["columns to order by with direction"],
  "ranking": { "metric": "...", "direction": "ASC|DESC", "limit": N } or null,
  "timeComparison": { "type": "year-over-year|quarter-over-quarter|...", "periods": ["..."] } or null,
  "reasoning": "step-by-step explanation of how to construct the query"
}

Be precise. Use actual table and column names from the schema provided.
If the question is ambiguous, still produce the best possible plan and note the ambiguity in reasoning.`;
		return (await this.llm.generateStructured({
			systemPrompt,
			userPrompt: question,
			temperature: 0,
			maxTokens: 2e3,
			jsonMode: true
		})).parsed;
	}
	async generateSQL(plan, retrieval) {
		const dialectInstructions = this.getDialectInstructions();
		const coverage = await this.getDataCoverage();
		const systemPrompt = `You are an expert SQL developer. Generate a ${this.config.dialect.toUpperCase()} SQL query based on the structured plan and schema below.

${retrieval.schemaPrompt}
${retrieval.semanticPrompt}
${coverage}

=== SQL DIALECT RULES ===
${dialectInstructions}

=== WHAT TO ANSWER ===
${this.config.fastMode ? plan.reasoning : JSON.stringify(plan, null, 2)}

RULES:
1. Generate ONLY a single SELECT query (or WITH...SELECT for CTEs).
2. Use proper ${this.config.dialect.toUpperCase()} syntax.
3. Handle NULL values appropriately with COALESCE.
4. Use meaningful column aliases.
5. Include proper JOIN conditions — never produce Cartesian products.
6. Follow the business definitions strictly. Do not invent business logic.
7. For fiscal year calculations, Indian fiscal year runs April 1 to March 31.
8. Apply EVERY condition in the question. Conditions joined by "while", "but",
   "despite" or "and" must ALL constrain the final result — never drop one.
9. "Top N%" means the single best N% slice. Use
   PERCENT_RANK() OVER (PARTITION BY ... ORDER BY metric DESC) <= N/100.
   With NTILE(k) you must set k = 100/N and select ONLY tile = 1; NTILE(20) with
   "tile <= 5" is the top 25%, not the top 5%.
10. "Declined/increased for N consecutive periods" needs N strict comparisons
   between adjacent periods via LAG, not a first-vs-last comparison.
11. Rank within a group by PARTITION BY that group — never rank globally.
12. Every column you reference must exist on the table or CTE you qualify it with.
   Do not assume a column exists on one table because it exists on another.
   Reference a CTE's derived value by the exact alias that CTE defines.
13. Derive a period arithmetically from its date column, e.g.
   EXTRACT(YEAR FROM d) + CASE WHEN EXTRACT(MONTH FROM d) >= 4 THEN 1 ELSE 0 END.
   Never bucket periods with a CASE of overlapping cutoffs (WHEN d <= '2023-03-31'
   ... WHEN d <= '2022-03-31' ...) — CASE stops at the first true branch, so all
   rows collapse into one period and the comparison returns nothing.
14. With SELECT DISTINCT, every ORDER BY expression must also appear in the select
   list. If you need to order by something else, drop DISTINCT and use GROUP BY.
15. Prefer explicit column lists over SELECT *.
17. Comparing a row against its GROUP's statistic (its department's average, its
    region's median, its branch's percentile) — compute that statistic in a CTE
    grouped ONLY by the group key, then join back on that key:
      WITH dept_median AS (
        SELECT department_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS m
        FROM employees WHERE status='ACTIVE' GROUP BY department_id
      )
      SELECT ... FROM employees e JOIN dept_median d USING (department_id)
       WHERE e.salary < d.m
    Never put the row's own identifier in that GROUP BY. Grouping by employee_id
    makes every group a single row, so the "median" equals that row's own value
    and the comparison is never true — the query returns zero rows.
18. "Improved/declined for N consecutive periods" is N strict adjacent comparisons
    via LAG, not COUNT(*) >= 1 of any improvement anywhere in the history.
16. Relative time windows ("last six months", "recent quarters", "year over year")
    must be anchored to the DATA, never to hardcoded calendar years. The dataset
    does not necessarily end today. Anchor to the table's own latest date, e.g.
      WHERE t.transaction_date >= (SELECT MAX(transaction_date) FROM transactions)
                                  - INTERVAL '6 months'
    Hardcoding a window such as '2022-04-01' to '2024-03-31' will silently match
    zero rows if the data lies outside it. Today's date is ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.

Respond with ONLY the SQL query. No explanations, no markdown, no code blocks,
no commentary before or after. Do not restate the question. Start with SELECT or WITH.`;
		let sql = (await this.llm.generate({
			systemPrompt,
			userPrompt: `Generate the SQL query for: ${plan.reasoning}`,
			temperature: 0,
			maxTokens: 3e3
		})).content.trim();
		sql = sql.replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
		return sql;
	}
	/**
	* A bare "no records matched" is indistinguishable from a broken query. When a
	* result is empty, measure each condition of the question on its own so we can
	* report WHICH one eliminated everything — an answer, rather than a blank grid.
	*/
	async diagnoseEmptyResult(question, sql, retrieval) {
		const fallback = "No records matched the specified criteria.";
		try {
			const coverage = await this.getDataCoverage();
			const response = await this.llm.generateStructured({
				systemPrompt: `A ${this.config.dialect.toUpperCase()} query returned zero rows. Determine why.

${retrieval.schemaPrompt}
${coverage}

The user asked: "${question}"

The query that returned nothing:
${sql}

Break the question into its individual conditions. For EACH condition, write a
standalone COUNT query measuring how many rows satisfy THAT CONDITION ALONE,
ignoring the others. This isolates which condition eliminated every row.

Respond with JSON:
{"probes": [{"condition": "plain English description", "sql": "SELECT COUNT(*) AS n FROM ..."}]}

Rules: at most 4 probes. Each sql must be a single SELECT returning one column named n.
No CTEs unless necessary. Never reference a column that does not exist.`,
				userPrompt: "Produce the diagnostic probes.",
				temperature: 0,
				maxTokens: 1500,
				jsonMode: true
			});
			const probes = await Promise.all((response.parsed.probes ?? []).filter((probe) => probe?.sql && probe?.condition).slice(0, 4).map(async (probe) => {
				const validation = this.guardian.validate(probe.sql);
				if (!validation.valid) return {
					condition: probe.condition,
					matchCount: null,
					error: "probe failed validation"
				};
				try {
					const res = await this.db.executeQuery(validation.modifiedSql || probe.sql, [], 8e3);
					const n = Number(res.rows?.[0]?.n ?? res.rows?.[0]?.count);
					return {
						condition: probe.condition,
						matchCount: Number.isFinite(n) ? n : null
					};
				} catch (err) {
					return {
						condition: probe.condition,
						matchCount: null,
						error: err.message
					};
				}
			}));
			const measured = probes.filter((p) => p.matchCount !== null);
			if (measured.length === 0) return {
				summary: fallback,
				probes
			};
			const empty = measured.filter((p) => p.matchCount === 0);
			if (empty.length > 0) {
				const list = empty.map((p) => `"${p.condition}"`).join(" and ");
				return {
					summary: `No records matched. The reason is ${empty.length > 1 ? "these conditions match" : "this condition matches"} no rows at all in the current data: ${list}. Other conditions do have matching data, so the result is empty because of ${empty.length > 1 ? "those" : "that"}.`,
					probes
				};
			}
			return {
				summary: `No records matched. Each condition has matching data on its own (${measured.map((p) => `${p.condition}: ${p.matchCount.toLocaleString("en-IN")} rows`).join("; ")}), but no record satisfies all of them at the same time.`,
				probes
			};
		} catch (err) {
			console.warn(`[Orchestrator] Empty-result diagnosis failed: ${err.message}`);
			return {
				summary: fallback,
				probes: []
			};
		}
	}
	async generateSummary(question, plan, rows, rowCount, truncated = false) {
		if (rowCount === 0) return {
			summary: "No records matched the specified criteria.",
			filters: plan.filters
		};
		const sampleRows = rows.slice(0, 5);
		const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
		const systemPrompt = `You are a banking data analyst writing an executive summary.
Given a user question and query results, write a brief, clear summary. Two sentences maximum.

Question: "${question}"
Total rows returned: ${rowCount}${truncated ? ` (TRUNCATED — the row cap was reached, so the full result set is LARGER than ${rowCount}. Say the list is truncated and never present ${rowCount} as a complete total.)` : ""}
Columns: ${columns.join(", ")}
Sample data (first ${sampleRows.length} rows): ${JSON.stringify(sampleRows)}

Respond with a JSON object:
{
  "summary": "Executive summary of the results",
  "filters": ["list of filters that were applied"]
}

Write the summary as if speaking to a senior bank manager. Be factual and concise.
Use Indian number formatting where appropriate (lakhs, crores).

CRITICAL — this summary is read by bank executives as fact:
- Use ONLY figures shown above. Never calculate, estimate, extrapolate or infer a number.
- In particular, never derive population totals or percentages from the row count.
- Describe only what the sample rows and the row count actually show.
- If the question implies a check the data cannot confirm, say so plainly rather than implying it was verified.`;
		try {
			return (await this.llm.generateStructured({
				systemPrompt,
				userPrompt: "Generate the executive summary.",
				temperature: .1,
				maxTokens: 220,
				jsonMode: true
			})).parsed;
		} catch {
			return {
				summary: `Retrieved ${rowCount} record(s) for your query about ${plan.intent}.`,
				filters: plan.filters
			};
		}
	}
	async repairSQL(originalSql, validation, retrieval, plan) {
		let sql = originalSql;
		let currentValidation = validation;
		let attempts = 0;
		let totalLlmMs = 0;
		const start = performance.now();
		while (attempts < this.config.maxRepairAttempts && !currentValidation.valid) {
			attempts++;
			const errorMessages = currentValidation.errors.map((e) => e.message).join("\n");
			const repairPrompt = `The following ${this.config.dialect.toUpperCase()} SQL query has validation errors:

SQL:
${sql}

Errors:
${errorMessages}

Schema context:
${retrieval.schemaPrompt}

Fix the SQL to resolve these errors. Respond with ONLY the corrected SQL query.
Do not include explanations, markdown, or code blocks.`;
			const repairStart = performance.now();
			const response = await this.llm.generate({
				systemPrompt: `You are a SQL debugging expert. Fix the SQL query to resolve the reported errors. Use ${this.config.dialect.toUpperCase()} syntax.`,
				userPrompt: repairPrompt,
				temperature: 0,
				maxTokens: 3e3
			});
			totalLlmMs += Math.round(performance.now() - repairStart);
			sql = response.content.trim().replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
			currentValidation = this.guardian.validate(sql);
		}
		return {
			success: currentValidation.valid,
			sql,
			validation: currentValidation,
			attempts,
			totalMs: Math.round(performance.now() - start),
			llmLatencyMs: totalLlmMs
		};
	}
	/**
	* Prescriptive fixes for database errors whose remedy is mechanical.
	*/
	getErrorHint(dbError) {
		for (const [pattern, hint] of [
			[/SELECT DISTINCT, ORDER BY expressions must appear in select list/i, "Fix: remove DISTINCT and de-duplicate with GROUP BY over the selected columns, or add every ORDER BY expression to the select list. Do not keep DISTINCT as-is."],
			[/must appear in the GROUP BY clause or be used in an aggregate function/i, "Fix: add that column to GROUP BY, or wrap it in an aggregate such as MAX()/AVG()."],
			[/function pg_catalog\.extract\(unknown, integer\) does not exist/i, "Fix: EXTRACT was applied to an integer, not a date. That value is already a number — use it directly instead of calling EXTRACT on it."],
			[/operator does not exist: /i, "Fix: the operand types do not match. Cast explicitly, e.g. value::numeric or value::date."],
			[/division by zero/i, "Fix: guard the denominator with NULLIF(denominator, 0)."]
		]) if (pattern.test(dbError)) return `\n\nKnown fix for this error: ${hint}`;
		return "";
	}
	async repairSQLFromError(originalSql, dbError, retrieval, plan) {
		let sql = originalSql;
		let attempts = 0;
		let totalLlmMs = 0;
		while (attempts < this.config.maxRepairAttempts) {
			attempts++;
			const errorHint = this.getErrorHint(dbError);
			const columnIndex = /column\s+"?[\w.]+"?\s+does not exist/i.test(dbError) ? "\n\nColumns that actually exist (table: columns):\n" + retrieval.schemaContext.tables.map((t) => `${t.name}: ${t.columns.map((c) => c.name).join(", ")}`).join("\n") : "";
			const repairPrompt = `The following ${this.config.dialect.toUpperCase()} SQL query failed during execution:

SQL:
${sql}

Database error:
${dbError}${errorHint}${columnIndex}

Schema context:
${retrieval.schemaPrompt}

Original query plan:
${JSON.stringify(plan, null, 2)}

Fix the SQL to resolve this error.

Checklist before answering:
- If the error names a missing column, that column does not exist. Do NOT re-use it.
  Find the correct column in the schema above, or derive it — and if it came from a
  CTE, make the reference match the alias that CTE actually defines.
- Verify every column you reference exists on the table/CTE you qualify it with.
- Preserve the original query intent and ALL of its conditions.

Respond with ONLY the corrected SQL query.`;
			const repairStart = performance.now();
			const response = await this.llm.generate({
				systemPrompt: `You are a ${this.config.dialect.toUpperCase()} SQL debugging expert. Analyze the database error and fix the query.`,
				userPrompt: repairPrompt,
				temperature: .05,
				maxTokens: 3e3
			});
			totalLlmMs += Math.round(performance.now() - repairStart);
			sql = response.content.trim().replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
			const validation = this.guardian.validate(sql);
			if (!validation.valid) continue;
			try {
				await this.db.executeQuery(validation.modifiedSql || sql, [], this.config.sqlTimeoutMs);
				return {
					success: true,
					sql,
					validation,
					attempts,
					llmLatencyMs: totalLlmMs
				};
			} catch (err) {
				dbError = err.message;
			}
		}
		return {
			success: false,
			sql,
			validation: this.guardian.validate(sql),
			attempts,
			llmLatencyMs: totalLlmMs
		};
	}
	getConversationContext(request) {
		if (!request.sessionId || !request.isFollowUp) return void 0;
		const ctx = this.conversations.get(request.sessionId);
		if (!ctx || ctx.history.length === 0) return void 0;
		return `The user is asking a follow-up question. Previous conversation:\n${ctx.history.slice(-3).map((h, i) => `Turn ${i + 1}: "${h.question}" → Tables: [${h.tables.join(", ")}]\nSQL: ${h.sql}`).join("\n\n")}\n\nThe new question should be interpreted in the context of this conversation. Carry forward relevant filters and context.`;
	}
	updateConversationContext(request, sql, plan, tables) {
		const sessionId = request.sessionId || "default";
		if (!this.conversations.has(sessionId)) this.conversations.set(sessionId, {
			sessionId,
			history: []
		});
		const ctx = this.conversations.get(sessionId);
		ctx.history.push({
			question: request.question,
			sql,
			plan,
			tables
		});
		if (ctx.history.length > 10) ctx.history = ctx.history.slice(-10);
	}
	getDialectInstructions() {
		switch (this.config.dialect) {
			case "postgresql": return `
- Use PostgreSQL syntax.
- Use LIMIT for result limiting (not ROWNUM or TOP).
- Use DATE_TRUNC for date truncation.
- Use EXTRACT(MONTH FROM date) or EXTRACT(YEAR FROM date) for date parts.
- Use COALESCE for null handling.
- Use || for string concatenation.
- Use CURRENT_DATE and CURRENT_TIMESTAMP.
- Use GENERATE_SERIES for sequences if needed.
- Use FILTER (WHERE ...) clause with aggregates if appropriate.
- CTEs use WITH ... AS (...).
- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() OVER (...).
- Boolean values: TRUE/FALSE.
- Case-sensitive identifiers: use double quotes if needed for mixed-case names.
- For Indian fiscal year: FY starts April 1. FY 2023-24 means April 1 2023 to March 31 2024.`;
			case "oracle": return `
- Use Oracle SQL syntax.
- Use FETCH FIRST N ROWS ONLY for result limiting (not LIMIT).
- Use TRUNC(date, 'MM') for date truncation.
- Use EXTRACT(MONTH FROM date) for date parts.
- Use NVL or COALESCE for null handling.
- Use || for string concatenation.
- Use SYSDATE and SYSTIMESTAMP.
- Use DUAL for SELECT without a table.
- CTEs use WITH ... AS (...).
- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() OVER (...).
- No boolean type; use 'Y'/'N' or 1/0.
- For Indian fiscal year: FY starts April 1. FY 2023-24 means April 1 2023 to March 31 2024.`;
			default: return `Use standard SQL syntax.`;
		}
	}
	getBusinessDefs(retrieval) {
		return retrieval.semanticResolution.resolvedTerms.map((t) => `${t.originalTerm}: ${t.businessTerm.description}`);
	}
	buildDebugMetadata(requestId, intent, tables, businessDefs, sql, status, totalMs, llmMs, rows, repairs, stages) {
		return {
			requestId,
			model: this.llm.getConfig().model,
			interpretedIntent: intent,
			tablesSelected: tables,
			businessDefinitionsUsed: businessDefs,
			sqlGenerated: sql,
			validationStatus: status,
			executionTimeMs: totalMs,
			llmLatencyMs: llmMs,
			rowsReturned: rows,
			repairAttempts: repairs,
			pipelineStages: stages
		};
	}
};
//#endregion
//#region src/backend/init.ts
async function initializeBackend(config) {
	console.log("[Init] Starting backend initialization...");
	const db = new PostgresAdapter(buildDatabaseConfig());
	await db.connect();
	console.log("[Init] ✅ Database connected");
	const llmConfig = buildLLMConfig();
	const llm = new SelfHostedLLMProvider(llmConfig, "qwen_runpod");
	console.log(`[Init] ✅ LLM configured: ${llmConfig.model} at ${llmConfig.baseUrl}`);
	const schemaIntelligence = new SchemaIntelligence();
	const semanticLayer = new SemanticLayer();
	const loadResult = new SchemaConfigLoader(config.databaseDir).load(schemaIntelligence, semanticLayer);
	console.log(`[Init] ✅ Schema loaded: ${loadResult.tableCount} tables, ${loadResult.viewCount} views, ${loadResult.termCount} terms, ${loadResult.ruleCount} rules, ${loadResult.relationshipCount} relationships`);
	const schemaRetriever = new SchemaRetriever(schemaIntelligence, semanticLayer);
	const guardian = new SQLGuardian(schemaIntelligence, {
		maxResultRows: parseInt(process.env.SQL_MAX_ROWS || "1000", 10),
		maxJoins: parseInt(process.env.SQL_MAX_JOINS || "10", 10),
		maxSubqueryDepth: parseInt(process.env.SQL_MAX_SUBQUERY_DEPTH || "5", 10),
		dialect: "postgresql"
	});
	const auditLogger = new AuditLogger(config.auditDir);
	const orchestrator = new QueryOrchestrator(llm, schemaRetriever, guardian, db, auditLogger, {
		maxRepairAttempts: parseInt(process.env.MAX_REPAIR_ATTEMPTS || "3", 10),
		maxResultRows: parseInt(process.env.SQL_MAX_ROWS || "1000", 10),
		sqlTimeoutMs: parseInt(process.env.SQL_TIMEOUT_MS || "30000", 10),
		llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10),
		dialect: "postgresql"
	});
	console.log("[Init] ✅ Backend fully initialized");
	return {
		db,
		llm,
		schemaIntelligence,
		semanticLayer,
		schemaRetriever,
		guardian,
		auditLogger,
		orchestrator
	};
}
function buildDatabaseConfig() {
	const databaseUrl = process.env.DATABASE_URL;
	if (databaseUrl) {
		const url = new URL(databaseUrl);
		return {
			host: url.hostname,
			port: parseInt(url.port || "5432", 10),
			user: url.username,
			password: url.password,
			database: url.pathname.replace(/^\//, ""),
			dialect: "postgresql",
			readOnly: process.env.DB_READ_ONLY !== "false",
			maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "5", 10),
			idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10),
			connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "10000", 10),
			statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "30000", 10),
			ssl: databaseUrl.includes("sslmode=require") || databaseUrl.includes("neon.tech")
		};
	}
	return {
		host: process.env.DB_HOST || "localhost",
		port: parseInt(process.env.DB_PORT || "5432", 10),
		user: process.env.DB_USER || "postgres",
		password: process.env.DB_PASSWORD || "",
		database: process.env.DB_NAME || "neondb",
		dialect: "postgresql",
		readOnly: process.env.DB_READ_ONLY !== "false",
		maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "5", 10),
		idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10),
		connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "10000", 10),
		statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "30000", 10)
	};
}
function buildLLMConfig() {
	const baseUrl = process.env.LLM_BASE_URL;
	if (!baseUrl) throw new Error("LLM_BASE_URL environment variable is required. Set it to your RunPod vLLM endpoint, e.g. https://<pod-id>-8000.proxy.runpod.net/v1");
	return {
		baseUrl,
		model: process.env.LLM_MODEL || "Qwen/Qwen3-Coder-Next",
		apiKey: process.env.LLM_API_KEY || process.env.RUNPOD_API_KEY,
		temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.05"),
		maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "4096", 10),
		timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10),
		maxRetries: parseInt(process.env.LLM_MAX_RETRIES || "2", 10)
	};
}
async function healthCheck(services) {
	const dbTest = await services.db.testConnection();
	const llmHealth = await services.llm.healthCheck();
	return {
		database: {
			connected: dbTest.success,
			latencyMs: dbTest.latencyMs
		},
		llm: {
			healthy: llmHealth.healthy,
			model: llmHealth.model,
			latencyMs: llmHealth.latencyMs,
			error: llmHealth.error
		},
		schema: {
			tables: services.schemaIntelligence.getAllTables().length,
			terms: services.semanticLayer.getTermCount()
		}
	};
}
//#endregion
export { healthCheck, initializeBackend };
