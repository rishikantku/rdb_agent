import e from "path";
import { Client as t, Pool as n } from "pg";
import r from "fs";
import { randomUUID as i } from "crypto";
//#region src/backend/db/database-adapter.ts
var a = class {
	config;
	constructor(e) {
		this.config = e;
	}
	get dialect() {
		return this.config.dialect;
	}
}, o = class {
	limitClause(e) {
		return `LIMIT ${e}`;
	}
	currentTimestamp() {
		return "CURRENT_TIMESTAMP";
	}
	dateTrunc(e, t) {
		return `DATE_TRUNC('${e}', ${t})`;
	}
	dateDiffDays(e, t) {
		return `(${t}::date - ${e}::date)`;
	}
	coalesce(e, t) {
		return `COALESCE(${e}, ${t})`;
	}
	concat(...e) {
		return e.join(" || ");
	}
	booleanTrue() {
		return "TRUE";
	}
	booleanFalse() {
		return "FALSE";
	}
	fiscalYear(e) {
		return `CASE WHEN EXTRACT(MONTH FROM ${e}) >= 4 THEN EXTRACT(YEAR FROM ${e}) ELSE EXTRACT(YEAR FROM ${e}) - 1 END`;
	}
	fiscalYearFilter(e, t) {
		return `${e} >= '${t}-04-01' AND ${e} < '${t + 1}-04-01'`;
	}
	paramPlaceholder(e) {
		return `$${e}`;
	}
}, s = class extends a {
	pool = null;
	connected = !1;
	dialectHelpers = new o();
	constructor(e) {
		super({
			...e,
			dialect: "postgresql"
		});
	}
	async connect() {
		this.pool && await this.disconnect();
		let e = {
			host: this.config.host || "localhost",
			port: this.config.port || 5432,
			user: this.config.user,
			password: this.config.password,
			database: this.config.database,
			max: this.config.maxConnections || 5,
			idleTimeoutMillis: this.config.idleTimeoutMs || 3e4,
			connectionTimeoutMillis: this.config.connectionTimeoutMs || 1e4
		};
		this.config.ssl && (e.ssl = typeof this.config.ssl == "object" ? this.config.ssl : { rejectUnauthorized: !1 }), this.pool = new n(e), (await this.pool.connect()).release(), this.connected = !0;
	}
	async disconnect() {
		this.pool &&= (await this.pool.end(), null), this.connected = !1;
	}
	async testConnection() {
		let e = performance.now();
		try {
			let n = {
				host: this.config.host || "localhost",
				port: this.config.port || 5432,
				user: this.config.user,
				password: this.config.password,
				database: this.config.database,
				connectionTimeoutMillis: 5e3
			};
			this.config.ssl && (n.ssl = typeof this.config.ssl == "object" ? this.config.ssl : { rejectUnauthorized: !1 });
			let r = new t(n);
			await r.connect();
			let i = await r.query("SELECT version()");
			return await r.end(), {
				success: !0,
				latencyMs: Math.round(performance.now() - e),
				serverVersion: i.rows[0]?.version
			};
		} catch (t) {
			return {
				success: !1,
				latencyMs: Math.round(performance.now() - e),
				error: t.message
			};
		}
	}
	async executeQuery(e, t = [], n) {
		if (!this.pool) throw Error("Database not connected. Call connect() first.");
		let r = n || this.config.statementTimeoutMs || 3e4, i = performance.now(), a = await this.pool.connect();
		try {
			await a.query(`SET statement_timeout = ${r}`), this.config.readOnly && await a.query("SET default_transaction_read_only = ON");
			let n = await a.query(e, t), o = Math.round(performance.now() - i), s = (n.fields || []).map((e) => ({
				name: e.name,
				dataType: this.pgTypeToString(e.dataTypeID)
			}));
			return {
				rows: n.rows,
				rowCount: n.rowCount ?? n.rows.length,
				fields: s,
				executionTimeMs: o
			};
		} finally {
			a.release();
		}
	}
	async introspectSchema() {
		if (!this.pool) throw Error("Database not connected.");
		let e = await this.pool.query("\n      SELECT table_name, table_type\n      FROM information_schema.tables\n      WHERE table_schema = 'public'\n      ORDER BY table_name\n    "), t = [], n = [];
		for (let r of e.rows) {
			let e = await this.introspectColumns(r.table_name), i = {
				name: r.table_name,
				schema: "public",
				columns: e
			};
			r.table_type === "VIEW" ? n.push(i) : t.push(i);
		}
		return {
			tables: t,
			views: n
		};
	}
	async tableExists(e) {
		return this.pool ? (await this.pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1", [e.toLowerCase()])).rowCount > 0 : !1;
	}
	async estimateRowCount(e) {
		if (!this.pool) return 0;
		let t = await this.pool.query("SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1", [e.toLowerCase()]);
		if (t.rows.length > 0 && t.rows[0].estimate >= 0) return Number(t.rows[0].estimate);
		let n = await this.pool.query(`SELECT COUNT(*) AS count FROM "${e}"`);
		return Number(n.rows[0]?.count ?? 0);
	}
	isConnected() {
		return this.connected && this.pool !== null;
	}
	getDialectHelpers() {
		return this.dialectHelpers;
	}
	async introspectColumns(e) {
		let t = await this.pool.query("\n      SELECT\n        c.column_name,\n        c.data_type,\n        c.is_nullable,\n        c.column_default,\n        c.udt_name\n      FROM information_schema.columns c\n      WHERE c.table_schema = 'public'\n        AND c.table_name = $1\n      ORDER BY c.ordinal_position\n    ", [e]), n = await this.pool.query("\n      SELECT kcu.column_name\n      FROM information_schema.table_constraints tc\n      JOIN information_schema.key_column_usage kcu\n        ON tc.constraint_name = kcu.constraint_name\n        AND tc.table_schema = kcu.table_schema\n      WHERE tc.table_schema = 'public'\n        AND tc.table_name = $1\n        AND tc.constraint_type = 'PRIMARY KEY'\n    ", [e]), r = new Set(n.rows.map((e) => e.column_name)), i = await this.pool.query("\n      SELECT\n        kcu.column_name,\n        ccu.table_name AS foreign_table,\n        ccu.column_name AS foreign_column\n      FROM information_schema.table_constraints tc\n      JOIN information_schema.key_column_usage kcu\n        ON tc.constraint_name = kcu.constraint_name\n        AND tc.table_schema = kcu.table_schema\n      JOIN information_schema.constraint_column_usage ccu\n        ON ccu.constraint_name = tc.constraint_name\n        AND ccu.table_schema = tc.table_schema\n      WHERE tc.table_schema = 'public'\n        AND tc.table_name = $1\n        AND tc.constraint_type = 'FOREIGN KEY'\n    ", [e]), a = /* @__PURE__ */ new Map();
		for (let e of i.rows) a.set(e.column_name, {
			table: e.foreign_table,
			column: e.foreign_column
		});
		return t.rows.map((e) => ({
			name: e.column_name,
			dataType: e.data_type,
			nullable: e.is_nullable === "YES",
			isPrimaryKey: r.has(e.column_name),
			defaultValue: e.column_default || void 0,
			foreignKey: a.get(e.column_name)
		}));
	}
	pgTypeToString(e) {
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
		}[e] || "unknown";
	}
}, c = class {
	tables = /* @__PURE__ */ new Map();
	relationships = [];
	joinPatterns = [];
	relationshipGraph = /* @__PURE__ */ new Map();
	registerTable(e) {
		this.tables.set(e.name.toUpperCase(), e), this.relationshipGraph.has(e.name.toUpperCase()) || this.relationshipGraph.set(e.name.toUpperCase(), /* @__PURE__ */ new Set());
	}
	registerRelationship(e) {
		this.relationships.push(e);
		let t = e.fromTable.toUpperCase(), n = e.toTable.toUpperCase();
		this.relationshipGraph.has(t) || this.relationshipGraph.set(t, /* @__PURE__ */ new Set()), this.relationshipGraph.has(n) || this.relationshipGraph.set(n, /* @__PURE__ */ new Set()), this.relationshipGraph.get(t).add(n), this.relationshipGraph.get(n).add(t);
	}
	registerJoinPattern(e) {
		this.joinPatterns.push(e);
	}
	getTable(e) {
		return this.tables.get(e.toUpperCase());
	}
	getAllTables() {
		return Array.from(this.tables.values());
	}
	getColumn(e, t) {
		let n = this.getTable(e);
		if (n) return n.columns.find((e) => e.name.toUpperCase() === t.toUpperCase());
	}
	getRelationshipsForTable(e) {
		let t = e.toUpperCase();
		return this.relationships.filter((e) => e.fromTable.toUpperCase() === t || e.toTable.toUpperCase() === t);
	}
	getRelatedTables(e) {
		let t = e.toUpperCase();
		return Array.from(this.relationshipGraph.get(t) ?? []);
	}
	getAllRelationships() {
		return [...this.relationships];
	}
	getJoinPatterns() {
		return [...this.joinPatterns];
	}
	findRelevantTables(e, t = 10) {
		let n = /* @__PURE__ */ new Map();
		for (let [t, r] of this.tables) {
			let i = 0, a = r.name.toLowerCase(), o = (r.businessName ?? "").toLowerCase(), s = (r.description ?? "").toLowerCase(), c = (r.tags ?? []).map((e) => e.toLowerCase());
			for (let t of e) {
				let e = t.toLowerCase();
				a.includes(e) && (i += 10), a === e && (i += 20), o.includes(e) && (i += 15), s.includes(e) && (i += 5), c.some((t) => t.includes(e)) && (i += 12);
				for (let t of r.columns) {
					let n = t.name.toLowerCase(), r = (t.businessName ?? "").toLowerCase(), a = (t.description ?? "").toLowerCase();
					n.includes(e) && (i += 5), n === e && (i += 10), r.includes(e) && (i += 8), a.includes(e) && (i += 3);
				}
			}
			i > 0 && n.set(t, i);
		}
		return Array.from(n.entries()).sort((e, t) => t[1] - e[1]).slice(0, t).map(([e]) => this.tables.get(e));
	}
	expandWithRelatedTables(e, t = 1) {
		let n = /* @__PURE__ */ new Set(), r = [];
		for (let t of e) {
			let e = t.toUpperCase();
			n.add(e), r.push({
				table: e,
				depth: 0
			});
		}
		for (; r.length > 0;) {
			let { table: e, depth: i } = r.shift();
			if (i >= t) continue;
			let a = this.relationshipGraph.get(e) ?? /* @__PURE__ */ new Set();
			for (let e of a) n.has(e) || (n.add(e), r.push({
				table: e,
				depth: i + 1
			}));
		}
		return Array.from(n).map((e) => this.tables.get(e)).filter((e) => e !== void 0);
	}
	getRelationshipsBetween(e) {
		let t = new Set(e.map((e) => e.toUpperCase()));
		return this.relationships.filter((e) => t.has(e.fromTable.toUpperCase()) && t.has(e.toTable.toUpperCase()));
	}
	getRelevantJoinPatterns(e) {
		let t = new Set(e.map((e) => e.toUpperCase()));
		return this.joinPatterns.filter((e) => e.tables.some((e) => t.has(e.toUpperCase())));
	}
	buildSchemaContext(e) {
		return {
			tables: e.map((e) => this.getTable(e)).filter((e) => e !== void 0),
			relationships: this.getRelationshipsBetween(e),
			joinPatterns: this.getRelevantJoinPatterns(e)
		};
	}
	serializeForPrompt(e) {
		let t = [];
		t.push("=== DATABASE SCHEMA ===\n");
		for (let n of e.tables) {
			let e = n.type === "view" ? "VIEW" : "TABLE";
			t.push(`${e}: ${n.name}`), n.description && t.push(`  Description: ${n.description}`), n.businessName && t.push(`  Business Name: ${n.businessName}`), t.push("  Columns:");
			for (let e of n.columns) {
				let n = `    - ${e.name} (${e.dataType})`;
				e.isPrimaryKey && (n += " [PK]"), e.isForeignKey && e.foreignKeyRef && (n += ` [FK → ${e.foreignKeyRef.table}.${e.foreignKeyRef.column}]`), e.nullable === !1 && (n += " NOT NULL"), e.description && (n += ` -- ${e.description}`), e.businessName && (n += ` (Business: ${e.businessName})`), t.push(n);
			}
			t.push("");
		}
		if (e.relationships.length > 0) {
			t.push("=== RELATIONSHIPS ===");
			for (let n of e.relationships) t.push(`  ${n.fromTable}.${n.fromColumn} → ${n.toTable}.${n.toColumn} (${n.type})`), n.description && t.push(`    ${n.description}`);
			t.push("");
		}
		if (e.joinPatterns.length > 0) {
			t.push("=== COMMON JOIN PATTERNS ===");
			for (let n of e.joinPatterns) t.push(`  ${n.name}: ${n.description}`), t.push(`    SQL: ${n.joinClause}`);
			t.push("");
		}
		return t.join("\n");
	}
	tableExists(e) {
		return this.tables.has(e.toUpperCase());
	}
	columnExists(e, t) {
		return this.getColumn(e, t) !== void 0;
	}
	isTableRestricted(e) {
		return this.getTable(e)?.restricted === !0;
	}
	isSensitiveColumn(e, t) {
		return this.getColumn(e, t)?.sensitive === !0;
	}
}, l = class {
	terms = /* @__PURE__ */ new Map();
	ambiguousTerms = /* @__PURE__ */ new Map();
	globalRules = [];
	registerTerm(e) {
		let t = e.term.toLowerCase();
		this.terms.set(t, e);
		for (let t of e.aliases) this.terms.set(t.toLowerCase(), e);
	}
	registerAmbiguousTerm(e) {
		this.ambiguousTerms.set(e.term.toLowerCase(), e);
	}
	registerGlobalRule(e) {
		this.globalRules.push(e);
	}
	resolveTerms(e) {
		let t = [], n = [], r = /* @__PURE__ */ new Set(), i = new Set(this.globalRules);
		for (let a of e) {
			let e = a.toLowerCase(), o = this.ambiguousTerms.get(e);
			if (o) {
				n.push(o);
				continue;
			}
			let s = this.terms.get(e);
			if (s) switch (t.push({
				originalTerm: a,
				businessTerm: s
			}), s.mapping.type) {
				case "table":
					r.add(s.mapping.table);
					break;
				case "column":
				case "filter":
					r.add(s.mapping.table);
					break;
				case "concept":
					for (let e of s.mapping.relatedTables) r.add(e);
					for (let e of s.mapping.rules) i.add(e);
					break;
			}
		}
		return {
			resolvedTerms: t,
			ambiguousTerms: n,
			additionalTables: Array.from(r),
			businessRules: Array.from(i)
		};
	}
	extractTerms(e) {
		let t = e.toLowerCase(), n = [], r = /* @__PURE__ */ new Set();
		for (let [e] of this.terms) r.add(e);
		for (let [e] of this.ambiguousTerms) r.add(e);
		for (let e of r) {
			let r = t.indexOf(e);
			if (r !== -1) {
				let i = r > 0 ? t[r - 1] : " ", a = r + e.length < t.length ? t[r + e.length] : " ";
				(/[\s,.]/.test(i) || r === 0) && (/[\s,.]/.test(a) || r + e.length === t.length) && n.push({
					term: e,
					index: r
				});
			}
		}
		return n.sort((e, t) => e.index - t.index), [...new Set(n.map((e) => e.term))];
	}
	serializeForPrompt(e) {
		let t = [];
		if (t.push("=== BUSINESS DEFINITIONS ===\n"), e.resolvedTerms.length > 0) {
			t.push("Resolved Business Terms:");
			for (let { originalTerm: n, businessTerm: r } of e.resolvedTerms) switch (t.push(`  "${n}":`), t.push(`    Definition: ${r.description}`), r.mapping.type) {
				case "table":
					t.push(`    Maps to table: ${r.mapping.table}`);
					break;
				case "column":
					t.push(`    Maps to: ${r.mapping.table}.${r.mapping.column}`);
					break;
				case "filter":
					t.push(`    Filter: ${r.mapping.table} WHERE ${r.mapping.condition}`);
					break;
				case "calculated":
					t.push(`    Expression: ${r.mapping.expression}`);
					break;
				case "concept":
					if (t.push(`    Concept: ${r.mapping.definition}`), r.mapping.rules.length > 0) {
						t.push("    Rules:");
						for (let e of r.mapping.rules) t.push(`      - ${e}`);
					}
					break;
			}
			t.push("");
		}
		if (e.businessRules.length > 0) {
			t.push("Business Rules (MUST follow):");
			for (let n of e.businessRules) t.push(`  - ${n}`);
			t.push("");
		}
		return t.join("\n");
	}
	getAllTerms() {
		let e = /* @__PURE__ */ new Set(), t = [];
		for (let n of this.terms.values()) e.has(n.term) || (e.add(n.term), t.push(n));
		return t;
	}
	getTermCount() {
		return this.getAllTerms().length;
	}
}, u = class {
	constructor(e, t) {
		this.schemaIntelligence = e, this.semanticLayer = t;
	}
	retrieve(e) {
		let t = this.semanticLayer.extractTerms(e), n = this.semanticLayer.resolveTerms(t), r = this.extractKeywords(e), i = this.schemaIntelligence.findRelevantTables(r, 8), a = new Set(i.map((e) => e.name));
		for (let e of n.additionalTables) a.add(e);
		let o = this.schemaIntelligence.expandWithRelatedTables(Array.from(a), 1).map((e) => e.name), s = this.schemaIntelligence.buildSchemaContext(o);
		return {
			schemaContext: s,
			semanticResolution: n,
			schemaPrompt: this.schemaIntelligence.serializeForPrompt(s),
			semanticPrompt: this.semanticLayer.serializeForPrompt(n),
			retrievedTableNames: o,
			hasAmbiguity: n.ambiguousTerms.length > 0
		};
	}
	extractKeywords(e) {
		let t = new Set(/* @__PURE__ */ "show.me.the.a.an.in.of.for.and.or.by.with.from.to.is.are.was.were.be.been.being.have.has.had.do.does.did.will.would.could.should.may.might.shall.can.need.dare.ought.used.get.got.give.gave.find.list.display.what.which.who.whom.how.where.when.why.all.each.every.both.few.more.most.other.some.any.no.not.only.own.same.so.than.too.very.just.also.but.if.then.else.their.them.they.this.that.these.those.i.my.we.our.you.your.he.she.it.its.between.after.before.above.below.up.down.out.off.over.under.again.further.tell.please.want.like.know.think.see.result.results.data.information.details.compare.comparison.excluding.including".split("."));
		return e.toLowerCase().replace(/[^\w\s-]/g, " ").split(/\s+/).filter((e) => e.length > 2 && !t.has(e));
	}
}, d = class {
	basePath;
	constructor(e) {
		this.basePath = e;
	}
	load(t, n) {
		let i = 0, a = 0, o = 0, s = 0, c = 0, l = e.join(this.basePath, "schema_catalog.json");
		if (r.existsSync(l)) {
			let e = JSON.parse(r.readFileSync(l, "utf-8"));
			for (let [n, r] of Object.entries(e.tables)) {
				let a = [];
				for (let [e, t] of Object.entries(r.columns)) {
					let n = t.fk ? this.parseForeignKey(t.fk) : void 0;
					a.push({
						name: e,
						dataType: t.type,
						nullable: t.nullable !== !1,
						isPrimaryKey: t.pk === !0,
						isForeignKey: !!t.fk,
						foreignKeyRef: n,
						description: t.note || t.check,
						sensitive: this.isSensitiveColumn(e)
					});
				}
				let o = {
					name: n,
					type: "table",
					schema: e.schema || "public",
					description: r.description,
					columns: a,
					primaryKey: a.filter((e) => e.isPrimaryKey).map((e) => e.name),
					tags: this.generateTags(n, r.description)
				};
				t.registerTable(o), i++;
			}
			if (e.views) for (let n of e.views) t.registerTable({
				name: n,
				type: "view",
				schema: e.schema || "public",
				description: `Analytical view: ${n}`,
				columns: [],
				tags: this.generateTags(n, "")
			}), a++;
			if (e.join_paths) for (let [n, r] of Object.entries(e.join_paths)) {
				let e = r.split(" → ").map((e) => e.trim());
				t.registerJoinPattern({
					name: n,
					description: `Join path: ${r}`,
					tables: e,
					joinClause: this.buildJoinClause(n, e),
					useCases: [n.replace(/_/g, " ")]
				});
			}
			console.log(`[ConfigLoader] Loaded ${i} tables, ${a} views from schema catalog`);
		}
		let u = e.join(this.basePath, "semantic", "relationships.json");
		if (r.existsSync(u)) {
			let e = JSON.parse(r.readFileSync(u, "utf-8")), n = e.relationships || e;
			for (let e of n) t.registerRelationship({
				fromTable: e.from_table,
				fromColumn: e.from_column,
				toTable: e.to_table,
				toColumn: e.to_column,
				type: e.type || "many-to-one",
				description: e.description
			}), c++;
			console.log(`[ConfigLoader] Loaded ${c} relationships`);
		}
		let d = e.join(this.basePath, "semantic", "business_glossary.json");
		if (r.existsSync(d)) {
			let e = JSON.parse(r.readFileSync(d, "utf-8")), t = e.glossary || e;
			for (let [e, r] of Object.entries(t)) {
				let t = this.glossaryEntryToBusinessTerm(e, r);
				n.registerTerm(t), o++;
			}
			console.log(`[ConfigLoader] Loaded ${o} business terms`);
		}
		let f = e.join(this.basePath, "semantic", "business_rules.json");
		if (r.existsSync(f)) {
			let e = JSON.parse(r.readFileSync(f, "utf-8")), t = e.rules || e;
			for (let e of t) n.registerGlobalRule(`[${e.id}] ${e.name}: ${e.description}`), s++;
			console.log(`[ConfigLoader] Loaded ${s} business rules`);
		}
		let p = e.join(this.basePath, "semantic", "entities.json");
		if (r.existsSync(p)) {
			let e = JSON.parse(r.readFileSync(p, "utf-8")), n = e.entities || e;
			for (let [e, r] of Object.entries(n)) if (r.join_paths) for (let [n, i] of Object.entries(r.join_paths)) t.registerJoinPattern({
				name: `${e}_${n}`,
				description: `Join ${e} to ${n}`,
				tables: [r.primary_table, ...r.related_tables || []],
				joinClause: i,
				useCases: [`${e} ${n}`]
			});
			console.log("[ConfigLoader] Loaded entity join patterns");
		}
		let m = e.join(this.basePath, "semantic", "metrics.json");
		if (r.existsSync(m)) {
			let e = JSON.parse(r.readFileSync(m, "utf-8")), t = e.metrics || e;
			for (let [e, r] of Object.entries(t)) {
				let t = this.generateMetricAliases(e, r.name);
				n.registerTerm({
					term: r.name.toLowerCase(),
					aliases: t,
					description: `${r.name}: ${r.expression}${r.filter ? ` WHERE ${r.filter}` : ""}`,
					mapping: {
						type: "calculated",
						expression: r.expression,
						description: `${r.name} (${r.aggregation})`
					}
				}), o++;
			}
			console.log(`[ConfigLoader] Loaded ${Object.keys(t).length} metric definitions`);
		}
		return {
			tableCount: i,
			viewCount: a,
			termCount: o,
			ruleCount: s,
			relationshipCount: c
		};
	}
	parseForeignKey(e) {
		let t = e.split(".");
		if (t.length === 2) return {
			table: t[0],
			column: t[1]
		};
	}
	isSensitiveColumn(e) {
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
		].some((t) => e.toLowerCase().includes(t));
	}
	generateTags(e, t) {
		let n = [], r = e.toLowerCase();
		return (r.includes("employee") || r.includes("dept") || r.includes("department") || r.includes("attendance") || r.includes("performance")) && n.push("employee", "hr"), (r.includes("customer") || r.includes("segment")) && n.push("customer"), (r.includes("account") || r.includes("balance") || r.includes("holder")) && n.push("account", "deposit"), (r.includes("transaction") || r.includes("txn")) && n.push("transaction"), (r.includes("loan") || r.includes("payment")) && n.push("loan", "lending"), (r.includes("branch") || r.includes("zone") || r.includes("region") || r.includes("state")) && n.push("geography", "organization"), r.includes("product") && n.push("product"), (r.includes("complaint") || r.includes("interaction")) && n.push("service", "complaint"), (r.includes("salary") || r.includes("payroll")) && n.push("payroll"), [...new Set(n)];
	}
	buildJoinClause(e, t) {
		return t.map((e, t) => t === 0 ? e : `JOIN ${e} ON ...`).join(" ");
	}
	glossaryEntryToBusinessTerm(e, t) {
		let n = this.generateTermAliases(e, t.term);
		return t.sql_condition && t.related_tables?.length === 1 ? {
			term: t.term.toLowerCase(),
			aliases: n,
			description: t.definition,
			mapping: {
				type: "filter",
				table: t.related_tables[0],
				condition: t.sql_condition.replace(/^[a-z_]+\./, "")
			}
		} : t.sql_expression && !t.related_tables ? {
			term: t.term.toLowerCase(),
			aliases: n,
			description: t.definition,
			mapping: {
				type: "calculated",
				expression: t.sql_expression,
				description: t.definition
			}
		} : {
			term: t.term.toLowerCase(),
			aliases: n,
			description: t.definition,
			mapping: {
				type: "concept",
				definition: t.definition,
				relatedTables: t.related_tables || [],
				relatedColumns: [],
				rules: t.sql_condition ? [`Use condition: ${t.sql_condition}`] : []
			}
		};
	}
	generateTermAliases(e, t) {
		let n = /* @__PURE__ */ new Set();
		n.add(e.replace(/_/g, " ")), t.toLowerCase() !== e.replace(/_/g, " ") && n.add(t.toLowerCase());
		for (let t of {
			active_employee: ["active staff", "current employees"],
			contractual_employee: [
				"contract staff",
				"contract employee",
				"contractual staff"
			],
			permanent_employee: ["regular employee", "permanent staff"],
			employee_strength: [
				"headcount",
				"staff count",
				"employee count",
				"manpower"
			],
			high_value_customer: [
				"hni customer",
				"premium customer",
				"high net worth"
			],
			loan_portfolio: [
				"loan book",
				"outstanding loans",
				"advances"
			],
			loan_growth: ["advance growth", "lending growth"],
			npa: [
				"non performing asset",
				"bad loan",
				"non-performing"
			],
			npa_ratio: ["npa percentage", "gross npa"],
			financial_year: ["fiscal year", "fy"],
			attrition: [
				"employee turnover",
				"staff leaving",
				"resignation"
			],
			salary_cost: [
				"salary expense",
				"payroll cost",
				"staff cost"
			],
			average_salary: ["mean salary", "avg salary"],
			transaction_frequency: ["txn frequency", "transaction count"],
			employee_productivity: ["productivity", "staff productivity"],
			employee_performance: ["performance", "staff performance"]
		}[e] || []) n.add(t);
		return Array.from(n);
	}
	generateMetricAliases(e, t) {
		let n = /* @__PURE__ */ new Set();
		return n.add(e.replace(/_/g, " ")), n.add(t.toLowerCase()), Array.from(n);
	}
}, f = class {
	config;
	constructor(e) {
		this.config = {
			temperature: .1,
			maxTokens: 4096,
			timeoutMs: 6e4,
			maxRetries: 2,
			...e
		};
	}
	getConfig() {
		let { apiKey: e, ...t } = this.config;
		return t;
	}
	generateRequestId() {
		return `req_${i().replace(/-/g, "").substring(0, 16)}`;
	}
	async withLatency(e) {
		let t = performance.now();
		return {
			result: await e(),
			latencyMs: Math.round(performance.now() - t)
		};
	}
}, p = class extends f {
	providerName;
	constructor(e, t = "self_hosted") {
		super(e), this.providerName = t;
	}
	async generate(e) {
		let t = this.generateRequestId(), n = [];
		e.systemPrompt && n.push({
			role: "system",
			content: e.systemPrompt
		}), n.push({
			role: "user",
			content: e.userPrompt
		});
		let r = {
			model: this.config.model,
			messages: n,
			temperature: e.temperature ?? this.config.temperature,
			max_tokens: e.maxTokens ?? this.config.maxTokens,
			stream: !1
		};
		e.stopSequences && e.stopSequences.length > 0 && (r.stop = e.stopSequences), e.jsonMode && (r.response_format = { type: "json_object" });
		let { result: i, latencyMs: a } = await this.withLatency(() => this.callWithRetry(r, t)), o = i.choices[0];
		return {
			requestId: t,
			content: o.message.content,
			model: i.model || this.config.model,
			usage: {
				promptTokens: i.usage?.prompt_tokens ?? 0,
				completionTokens: i.usage?.completion_tokens ?? 0,
				totalTokens: i.usage?.total_tokens ?? 0
			},
			latencyMs: a,
			finishReason: o.finish_reason
		};
	}
	async generateStructured(e) {
		let t = await this.generate({
			...e,
			jsonMode: !0
		}), n = this.parseJSON(t.content);
		return {
			...t,
			parsed: n
		};
	}
	async healthCheck() {
		try {
			let { result: e, latencyMs: t } = await this.withLatency(async () => {
				let e = `${this.config.baseUrl}/models`, t = { "Content-Type": "application/json" };
				this.config.apiKey && (t.Authorization = `Bearer ${this.config.apiKey}`);
				let n = await fetch(e, {
					method: "GET",
					headers: t,
					signal: AbortSignal.timeout(1e4)
				});
				if (!n.ok) throw Error(`Health check failed: ${n.status} ${n.statusText}`);
				return n.json();
			});
			return {
				healthy: !0,
				latencyMs: t,
				model: this.config.model
			};
		} catch (e) {
			return {
				healthy: !1,
				latencyMs: 0,
				model: this.config.model,
				error: e.message
			};
		}
	}
	async getModelInfo() {
		let e = await this.healthCheck();
		return {
			model: this.config.model,
			provider: this.providerName,
			baseUrl: this.config.baseUrl,
			status: e.healthy ? "healthy" : "unavailable",
			metadata: {
				healthLatencyMs: e.latencyMs,
				configuredTemperature: this.config.temperature,
				configuredMaxTokens: this.config.maxTokens,
				configuredTimeoutMs: this.config.timeoutMs
			}
		};
	}
	async callWithRetry(e, t, n = 0) {
		let r = `${this.config.baseUrl}/chat/completions`, i = {
			"Content-Type": "application/json",
			"X-Request-ID": t
		};
		this.config.apiKey && (i.Authorization = `Bearer ${this.config.apiKey}`);
		try {
			let t = await fetch(r, {
				method: "POST",
				headers: i,
				body: JSON.stringify(e),
				signal: AbortSignal.timeout(this.config.timeoutMs)
			});
			if (!t.ok) {
				let e = await t.text().catch(() => ""), n = /* @__PURE__ */ Error(`LLM API error ${t.status}: ${t.statusText}. ${e}`);
				throw n.status = t.status, n;
			}
			return await t.json();
		} catch (r) {
			if ((r.status >= 500 || r.name === "TimeoutError" || r.code === "ECONNREFUSED" || r.code === "ECONNRESET") && n < (this.config.maxRetries ?? 2)) {
				let i = Math.min(1e3 * 2 ** n, 8e3);
				return console.warn(`[LLM] Request ${t} failed (attempt ${n + 1}), retrying in ${i}ms: ${r.message}`), await new Promise((e) => setTimeout(e, i)), this.callWithRetry(e, t, n + 1);
			}
			throw r;
		}
	}
	parseJSON(e) {
		try {
			return JSON.parse(e.trim());
		} catch {}
		let t = e.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		if (t) try {
			return JSON.parse(t[1].trim());
		} catch {}
		let n = e.indexOf("{"), r = e.lastIndexOf("}");
		if (n !== -1 && r > n) try {
			return JSON.parse(e.substring(n, r + 1));
		} catch {}
		let i = e.indexOf("["), a = e.lastIndexOf("]");
		if (i !== -1 && a > i) try {
			return JSON.parse(e.substring(i, a + 1));
		} catch {}
		throw Error(`Failed to parse LLM response as JSON. Raw content: ${e.substring(0, 200)}...`);
	}
}, m = class e {
	schema;
	config;
	constructor(e, t = {}) {
		this.schema = e, this.config = {
			maxResultRows: t.maxResultRows ?? 1e3,
			maxJoins: t.maxJoins ?? 10,
			maxSubqueryDepth: t.maxSubqueryDepth ?? 5,
			dialect: t.dialect ?? "postgresql",
			allowedSchemas: t.allowedSchemas,
			restrictedTables: t.restrictedTables ?? []
		};
	}
	validate(e) {
		let t = [], n = [], r = e.toUpperCase().trim(), i = this.removeComments(e).trim(), a = this.checkDestructiveStatements(r);
		a && t.push(a);
		let o = this.checkDangerousConstructs(r);
		t.push(...o), !r.startsWith("SELECT") && !r.startsWith("WITH") && t.push({
			code: "NOT_SELECT",
			message: "Only SELECT queries are permitted. The query must start with SELECT or WITH.",
			severity: "critical"
		});
		let s = this.extractTableReferences(i);
		for (let e of s) this.schema.tableExists(e) || t.push({
			code: "TABLE_NOT_FOUND",
			message: `Table "${e}" does not exist in the known schema.`,
			severity: "error"
		}), this.config.restrictedTables?.includes(e.toUpperCase()) && t.push({
			code: "RESTRICTED_TABLE",
			message: `Access to table "${e}" is restricted.`,
			severity: "critical"
		}), this.schema.isTableRestricted(e) && t.push({
			code: "RESTRICTED_TABLE",
			message: `Table "${e}" requires additional authorization.`,
			severity: "critical"
		});
		for (let e of this.detectDegenerateAggregates(i)) t.push({
			code: "DEGENERATE_AGGREGATE",
			message: e,
			severity: "error"
		});
		let c = this.analyzeComplexity(r);
		c.joinCount > this.config.maxJoins && n.push({
			code: "HIGH_JOIN_COUNT",
			message: `Query has ${c.joinCount} joins (max recommended: ${this.config.maxJoins}).`
		}), c.subqueryDepth > this.config.maxSubqueryDepth && n.push({
			code: "DEEP_SUBQUERY",
			message: `Query has subquery nesting depth of ${c.subqueryDepth} (max: ${this.config.maxSubqueryDepth}).`
		}), this.detectCartesianJoin(r, s.length) && n.push({
			code: "POSSIBLE_CARTESIAN",
			message: "Query may produce a Cartesian product. Verify that all tables have proper join conditions."
		});
		let l = e, u = this.stripParenGroups(e), d = /\bLIMIT\s+(\d+)/i.exec(u);
		if (!this.hasResultLimit(u.toUpperCase())) l = this.applyResultLimit(e), n.push({
			code: "LIMIT_APPLIED",
			message: `Result limit of ${this.config.maxResultRows} rows applied for safety.`
		});
		else if (d && parseInt(d[1], 10) > this.config.maxResultRows) {
			let t = e.toUpperCase().lastIndexOf("LIMIT");
			l = e.slice(0, t) + e.slice(t).replace(/\bLIMIT\s+\d+/i, `LIMIT ${this.config.maxResultRows}`), n.push({
				code: "LIMIT_REDUCED",
				message: `Result limit reduced from ${d[1]} to ${this.config.maxResultRows} rows.`
			});
		}
		return {
			valid: t.length === 0,
			errors: t,
			warnings: n,
			complexity: c,
			modifiedSql: t.length === 0 ? l : void 0
		};
	}
	checkDestructiveStatements(e) {
		for (let { pattern: t, name: n } of [
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
		]) if (t.test(e)) return {
			code: "DESTRUCTIVE_OPERATION",
			message: `${n} operations are not permitted. Only SELECT queries are allowed.`,
			severity: "critical"
		};
		return null;
	}
	checkDangerousConstructs(e) {
		let t = [];
		for (let { pattern: n, description: r } of [
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
		]) n.test(e) && t.push({
			code: "DANGEROUS_CONSTRUCT",
			message: `Dangerous SQL construct detected: ${r}`,
			severity: "critical"
		});
		return e.replace(/;\s*$/, "").includes(";") && t.push({
			code: "MULTIPLE_STATEMENTS",
			message: "Multiple SQL statements are not permitted.",
			severity: "critical"
		}), t;
	}
	analyzeComplexity(e) {
		let t = e.match(/\bJOIN\b/g), n = t ? t.length : 0, r = e.match(/\bWITH\b/g), i = r ? r.length : 0, a = this.measureSubqueryDepth(e), o = [
			"COUNT",
			"SUM",
			"AVG",
			"MIN",
			"MAX",
			"GROUP_CONCAT",
			"STRING_AGG",
			"ARRAY_AGG"
		], s = 0;
		for (let t of o) {
			let n = RegExp(`\\b${t}\\s*\\(`, "g"), r = e.match(n);
			s += r ? r.length : 0;
		}
		let c = e.match(/\bOVER\s*\(/g), l = c ? c.length : 0, u, d = n * 2 + a * 3 + i * 2 + s + l * 2;
		return u = d <= 3 ? "low" : d <= 8 ? "medium" : d <= 15 ? "high" : "very_high", {
			joinCount: n,
			subqueryDepth: a,
			cteCount: i,
			aggregationCount: s,
			windowFunctionCount: l,
			estimatedComplexity: u
		};
	}
	measureSubqueryDepth(e) {
		let t = 0, n = 0, r = !1, i = "";
		for (let a = 0; a < e.length; a++) {
			let o = e[a];
			(o === "'" || o === "\"") && !r ? (r = !0, i = o) : o === i && r && (r = !1), r || (o === "(" ? (n++, t = Math.max(t, n)) : o === ")" && (n = Math.max(0, n - 1)));
		}
		return t;
	}
	static FROM_ARG_FUNCTIONS = [
		"EXTRACT",
		"SUBSTRING",
		"TRIM",
		"POSITION",
		"OVERLAY"
	];
	maskFromArgFunctions(t) {
		let n = t;
		for (let t of e.FROM_ARG_FUNCTIONS) {
			let e = RegExp(`\\b${t}\\s*\\(`, "gi"), r;
			for (; (r = e.exec(n)) !== null;) {
				let t = r.index + r[0].length - 1, i = 0, a = t;
				for (; a < n.length; a++) if (n[a] === "(") i++;
				else if (n[a] === ")" && (i--, i === 0)) break;
				let o = Math.min(a, n.length);
				n = n.slice(0, t + 1) + " ".repeat(o - t - 1) + n.slice(o), e.lastIndex = o;
			}
		}
		return n;
	}
	extractCteNames(e) {
		let t = /* @__PURE__ */ new Set(), n = /(?:\bWITH\b|,)\s*(?:RECURSIVE\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*(?:(?:NOT\s+)?MATERIALIZED\s*)?\(/gi, r;
		for (; (r = n.exec(e)) !== null;) t.add(r[1].toLowerCase());
		return t;
	}
	detectDegenerateAggregates(e) {
		let t = [], n = (e) => e.trim().split(".").pop().toLowerCase(), r = /\bGROUP\s+BY\b([\s\S]*?)(?=\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bWINDOW\b|\bUNION\b|\bSELECT\b|\)|$)/gi, i;
		for (; (i = r.exec(e)) !== null;) {
			let r = new Set(i[1].split(",").map((e) => n(e)).filter((e) => /^[a-z_][a-z0-9_]*$/.test(e)));
			if (r.size === 0) continue;
			let a = e.slice(0, i.index), o = a.toUpperCase().lastIndexOf("SELECT");
			if (o === -1) continue;
			let s = a.slice(o), c = /* @__PURE__ */ new Set();
			for (let e of [/\b(?:AVG|SUM|MIN|MAX)\s*\(\s*(?:DISTINCT\s+)?([a-zA-Z_][\w.]*)\s*\)/gi, /\bPERCENTILE_(?:CONT|DISC)\s*\([^)]*\)\s*WITHIN\s+GROUP\s*\(\s*ORDER\s+BY\s+([a-zA-Z_][\w.]*)/gi]) {
				let t;
				for (; (t = e.exec(s)) !== null;) c.add(n(t[1]));
			}
			for (let e of c) r.has(e) && t.push(`"${e}" is aggregated and also listed in GROUP BY, so each group contains a single value and the aggregate equals that row's own value. Group only by the grouping key (e.g. department_id) and join the result back.`);
		}
		return Array.from(new Set(t));
	}
	extractTableReferences(e) {
		let t = /* @__PURE__ */ new Set(), n = this.maskFromArgFunctions(e), r = this.extractCteNames(n);
		for (let e of [/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi, /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi]) {
			let i;
			for (; (i = e.exec(n)) !== null;) {
				let e = i[2] || i[1];
				new Set([
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
				]).has(e.toUpperCase()) || r.has(e.toLowerCase()) || t.add(e);
			}
		}
		return Array.from(t);
	}
	detectCartesianJoin(e, t) {
		if (t > 1) {
			/\bJOIN\b/.test(e);
			let t = /\bWHERE\b/.test(e);
			if (/\bFROM\s+\w+\s*,\s*\w+/.test(e) && !t) return !0;
		}
		return !1;
	}
	stripParenGroups(e) {
		let t = "", n = 0;
		for (let r of e) {
			if (r === "(") {
				n++;
				continue;
			}
			if (r === ")") {
				n > 0 && n--;
				continue;
			}
			n === 0 && (t += r);
		}
		return t;
	}
	hasResultLimit(e) {
		return /\bLIMIT\s+\d+/i.test(e) || /\bFETCH\s+(FIRST|NEXT)\s+\d+\s+ROW/i.test(e) || /\bROWNUM\s*<=/i.test(e) || /\bTOP\s+\d+/i.test(e);
	}
	applyResultLimit(e) {
		let t = e.replace(/;\s*$/, "").trim();
		return this.config.dialect === "postgresql" || this.config.dialect === "sqlite" ? `${t}\nLIMIT ${this.config.maxResultRows}` : this.config.dialect === "oracle" ? `${t}\nFETCH FIRST ${this.config.maxResultRows} ROWS ONLY` : `${t}\nLIMIT ${this.config.maxResultRows}`;
	}
	removeComments(e) {
		let t = e.replace(/--.*$/gm, "");
		return t = t.replace(/\/\*[\s\S]*?\*\//g, ""), t;
	}
}, h = class {
	logDir;
	logFile;
	inMemoryLog = [];
	constructor(t) {
		this.logDir = t || e.join(process.cwd(), "audit_logs"), this.logFile = e.join(this.logDir, `audit_${this.getDateStamp()}.jsonl`);
		try {
			r.existsSync(this.logDir) || r.mkdirSync(this.logDir, { recursive: !0 });
		} catch (e) {
			console.warn("[Audit] Could not create log directory:", e);
		}
	}
	log(e) {
		let t = this.sanitize(e);
		this.inMemoryLog.push(t), this.inMemoryLog.length > 1e3 && (this.inMemoryLog = this.inMemoryLog.slice(-500));
		try {
			r.appendFileSync(this.logFile, JSON.stringify(t) + "\n", "utf-8");
		} catch (e) {
			console.warn("[Audit] Could not write log:", e);
		}
	}
	getRecent(e = 50) {
		return this.inMemoryLog.slice(-e).reverse();
	}
	getMetrics() {
		let e = this.inMemoryLog;
		if (e.length === 0) return {
			totalQueries: 0,
			successRate: 0,
			avgExecutionTimeMs: 0,
			avgRepairAttempts: 0,
			topTables: [],
			queriesLast24h: 0
		};
		let t = e.filter((e) => e.executionStatus === "success").length, n = e.reduce((e, t) => e + t.executionTimeMs, 0) / e.length, r = e.reduce((e, t) => e + t.repairAttempts, 0) / e.length, i = /* @__PURE__ */ new Map();
		for (let t of e) for (let e of t.retrievedTables) i.set(e, (i.get(e) || 0) + 1);
		let a = Array.from(i.entries()).sort((e, t) => t[1] - e[1]).slice(0, 10).map(([e, t]) => ({
			table: e,
			count: t
		})), o = Date.now(), s = e.filter((e) => o - new Date(e.timestamp).getTime() < 864e5).length;
		return {
			totalQueries: e.length,
			successRate: t / e.length * 100,
			avgExecutionTimeMs: Math.round(n),
			avgRepairAttempts: Math.round(r * 100) / 100,
			topTables: a,
			queriesLast24h: s
		};
	}
	sanitize(e) {
		return {
			...e,
			generatedSql: e.generatedSql.replace(/password\s*=\s*'[^']*'/gi, "password='***'")
		};
	}
	getDateStamp() {
		return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
	}
}, g = class {
	llm;
	schemaRetriever;
	guardian;
	db;
	auditLogger;
	config;
	conversations = /* @__PURE__ */ new Map();
	dataCoverage = null;
	constructor(e, t, n, r, i, a = {}) {
		this.llm = e, this.schemaRetriever = t, this.guardian = n, this.db = r, this.auditLogger = i, this.config = {
			fastMode: a.fastMode ?? !0,
			maxRepairAttempts: a.maxRepairAttempts ?? 3,
			maxResultRows: a.maxResultRows ?? 1e3,
			sqlTimeoutMs: a.sqlTimeoutMs ?? 3e4,
			llmTimeoutMs: a.llmTimeoutMs ?? 6e4,
			dialect: a.dialect ?? "postgresql"
		};
	}
	async processQuery(e, t) {
		let n = `req_${i().replace(/-/g, "").substring(0, 16)}`, r = (e, n, r, i) => {
			try {
				t?.({
					stage: e,
					status: n,
					detail: i,
					index: r,
					total: 6
				});
			} catch {}
		}, a = performance.now(), o = [], s = 0, c = 0;
		try {
			let t = performance.now();
			r("Understanding the question", "start", 1);
			let i = this.schemaRetriever.retrieve(e.question);
			if (r("Understanding the question", "done", 1, `${i.retrievedTableNames.length} tables`), o.push({
				name: "Schema & Semantic Retrieval",
				status: "success",
				durationMs: Math.round(performance.now() - t),
				details: `Retrieved ${i.retrievedTableNames.length} tables`
			}), i.hasAmbiguity) {
				let e = i.semanticResolution.ambiguousTerms[0], t = e.possibleMeanings.map((e) => ({
					label: e.label,
					description: e.description,
					value: e.label
				}));
				return {
					requestId: n,
					success: !1,
					errorType: "ambiguity",
					error: `The term "${e.term}" has multiple business meanings. Please clarify which one you mean.`,
					clarificationOptions: t,
					debug: this.buildDebugMetadata(n, "", [], [], "", "ambiguity", 0, 0, 0, 0, o)
				};
			}
			let l = performance.now(), u = this.getConversationContext(e), d;
			if (r("Planning the query", "start", 2), this.config.fastMode && !this.shouldPlan(e.question)) d = this.buildInlinePlan(e.question, i, u), r("Planning the query", "skipped", 2, "not needed for this question");
			else {
				d = await this.generateSQLPlan(e.question, i, u);
				let t = Math.round(performance.now() - l);
				s += t, o.push({
					name: "SQL Planning",
					status: "success",
					durationMs: t,
					details: `Intent: ${d.intent}`
				}), r("Planning the query", "done", 2, `${t} ms`);
			}
			let f = performance.now();
			r("Writing SQL", "start", 3);
			let p = await this.generateSQL(d, i);
			r("Writing SQL", "done", 3, `${Math.round(performance.now() - f)} ms`);
			let m = Math.round(performance.now() - f);
			s += m, o.push({
				name: "SQL Generation",
				status: "success",
				durationMs: m,
				details: `Generated ${p.length} chars`
			});
			let h = performance.now();
			r("Checking safety", "start", 4);
			let g = this.guardian.validate(p);
			if (r("Checking safety", g.valid ? "done" : "error", 4, g.valid ? "passed guardrails" : "repairing"), o.push({
				name: "SQL Validation",
				status: g.valid ? "success" : "error",
				durationMs: Math.round(performance.now() - h),
				details: g.valid ? `Passed (${g.warnings.length} warnings)` : `Failed: ${g.errors.map((e) => e.message).join("; ")}`
			}), !g.valid) {
				let e = await this.repairSQL(p, g, i, d);
				if (c = e.attempts, s += e.llmLatencyMs, e.success) p = e.sql, g = e.validation, o.push({
					name: "SQL Repair",
					status: "success",
					durationMs: e.totalMs,
					details: `Fixed after ${e.attempts} attempt(s)`
				});
				else return {
					requestId: n,
					success: !1,
					sql: p,
					sqlPlan: d,
					validationResult: g,
					error: `Generated SQL failed validation: ${g.errors.map((e) => e.message).join(". ")}`,
					errorType: "validation",
					debug: this.buildDebugMetadata(n, "", i.retrievedTableNames, this.getBusinessDefs(i), p, "validation_failed", 0, s, 0, c, o)
				};
			}
			let _ = g.modifiedSql || p, v = performance.now();
			r("Querying the database", "start", 5);
			try {
				let t = await this.db.executeQuery(_, [], this.config.sqlTimeoutMs);
				r("Querying the database", "done", 5, `${t.rowCount} rows`);
				let l = Math.round(performance.now() - v);
				o.push({
					name: "SQL Execution",
					status: "success",
					durationMs: l,
					details: `${t.rowCount} rows in ${t.executionTimeMs}ms`
				});
				let u = performance.now(), f = t.rowCount >= this.config.maxResultRows;
				r(t.rowCount === 0 ? "Explaining the empty result" : "Summarising", "start", 6);
				let m, h;
				if (t.rowCount === 0) {
					let t = await this.diagnoseEmptyResult(e.question, _, i);
					m = t.probes.length > 0 ? t.probes : void 0, h = {
						summary: t.summary,
						filters: d.filters
					};
				} else h = await this.generateSummary(e.question, d, t.rows, t.rowCount, f);
				let y = Math.round(performance.now() - u);
				s += y, o.push({
					name: "Result Summary",
					status: "success",
					durationMs: y
				}), r("Summarising", "done", 6), this.updateConversationContext(e, p, d, i.retrievedTableNames);
				let b = Math.round(performance.now() - a);
				return this.auditLogger.log({
					requestId: n,
					userId: e.userId || "anonymous",
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					userQuestion: e.question,
					model: this.llm.getConfig().model,
					retrievedTables: i.retrievedTableNames,
					retrievedBusinessRules: this.getBusinessDefs(i),
					generatedSql: p,
					validationResult: g.valid ? "passed" : "failed",
					executionStatus: "success",
					executionTimeMs: b,
					rowCount: t.rowCount,
					repairAttempts: c
				}), {
					requestId: n,
					success: !0,
					data: t.rows,
					rowCount: t.rowCount,
					fields: t.fields,
					truncated: f,
					emptyResultDiagnosis: m,
					summary: h.summary,
					filtersApplied: h.filters,
					executionTimeMs: b,
					sql: p,
					sqlPlan: d,
					validationResult: g,
					debug: this.buildDebugMetadata(n, d.intent, i.retrievedTableNames, this.getBusinessDefs(i), p, "success", b, s, t.rowCount, c, o)
				};
			} catch (t) {
				o.push({
					name: "SQL Execution",
					status: "error",
					durationMs: Math.round(performance.now() - v),
					details: t.message
				});
				let r = await this.repairSQLFromError(p, t.message, i, d);
				if (c += r.attempts, s += r.llmLatencyMs, r.success) {
					let t = performance.now(), l = await this.db.executeQuery(r.validation.modifiedSql || r.sql, [], this.config.sqlTimeoutMs);
					o.push({
						name: "SQL Repair + Re-execution",
						status: "success",
						durationMs: Math.round(performance.now() - t),
						details: `Fixed and got ${l.rowCount} rows`
					});
					let u = l.rowCount >= this.config.maxResultRows, f = await this.generateSummary(e.question, d, l.rows, l.rowCount, u);
					s += 500;
					let p = Math.round(performance.now() - a);
					return this.updateConversationContext(e, r.sql, d, i.retrievedTableNames), this.auditLogger.log({
						requestId: n,
						userId: e.userId || "anonymous",
						timestamp: (/* @__PURE__ */ new Date()).toISOString(),
						userQuestion: e.question,
						model: this.llm.getConfig().model,
						retrievedTables: i.retrievedTableNames,
						retrievedBusinessRules: this.getBusinessDefs(i),
						generatedSql: r.sql,
						validationResult: "passed_after_repair",
						executionStatus: "success",
						executionTimeMs: p,
						rowCount: l.rowCount,
						repairAttempts: c
					}), {
						requestId: n,
						success: !0,
						data: l.rows,
						rowCount: l.rowCount,
						fields: l.fields,
						truncated: u,
						summary: f.summary,
						filtersApplied: f.filters,
						executionTimeMs: p,
						sql: r.sql,
						sqlPlan: d,
						validationResult: r.validation,
						debug: this.buildDebugMetadata(n, d.intent, i.retrievedTableNames, this.getBusinessDefs(i), r.sql, "success_after_repair", p, s, l.rowCount, c, o)
					};
				}
				let l = Math.round(performance.now() - a);
				return {
					requestId: n,
					success: !1,
					sql: p,
					error: `I was unable to generate a correct query for this request. The database returned: ${t.message}`,
					errorType: "execution",
					sqlPlan: d,
					validationResult: g,
					executionTimeMs: l,
					debug: this.buildDebugMetadata(n, d.intent, i.retrievedTableNames, this.getBusinessDefs(i), p, "execution_failed", l, s, 0, c, o)
				};
			}
		} catch (e) {
			let t = Math.round(performance.now() - a), r = e.message?.includes("LLM") ? "llm" : "system";
			return {
				requestId: n,
				success: !1,
				error: `An internal error occurred: ${e.message}`,
				errorType: r,
				executionTimeMs: t,
				debug: this.buildDebugMetadata(n, "", [], [], "", `error_${r}`, t, s, 0, c, o)
			};
		}
	}
	async getDataCoverage() {
		if (this.dataCoverage !== null) return this.dataCoverage;
		try {
			let e = await this.db.executeQuery("SELECT table_name, column_name\n           FROM information_schema.columns\n          WHERE table_schema = 'public'\n            AND data_type IN ('date', 'timestamp without time zone', 'timestamp with time zone')\n          ORDER BY table_name, column_name", [], this.config.sqlTimeoutMs);
			if (e.rowCount === 0) return this.dataCoverage = "", this.dataCoverage;
			let t = e.rows.map((e) => `SELECT '${e.table_name}.${e.column_name}' AS col, MIN(${e.column_name})::text AS lo, MAX(${e.column_name})::text AS hi FROM ${e.table_name}`), n = (await this.db.executeQuery(t.join(" UNION ALL "), [], this.config.sqlTimeoutMs)).rows.filter((e) => e.lo && e.hi).map((e) => `  ${e.col}: ${String(e.lo).slice(0, 10)} to ${String(e.hi).slice(0, 10)}`), r = await this.db.executeQuery("SELECT table_name, column_name, data_type\n           FROM information_schema.columns\n          WHERE table_schema = 'public'\n            AND (\n                 (data_type IN ('integer','bigint','smallint','numeric')\n                   AND (column_name ~* '(financial|fiscal)_year' OR column_name ~* '(^|_)year$'))\n              OR (data_type IN ('character varying','text','character')\n                   AND column_name ~* '(quarter|period)')\n            )\n          ORDER BY table_name, column_name", [], this.config.sqlTimeoutMs);
			for (let e of r.rows) try {
				if (String(e.data_type).startsWith("char") || e.data_type === "text") {
					let t = (await this.db.executeQuery(`SELECT DISTINCT ${e.column_name} AS v FROM ${e.table_name}
                WHERE ${e.column_name} IS NOT NULL ORDER BY 1 LIMIT 12`, [], this.config.sqlTimeoutMs)).rows.map((e) => e.v).join(", ");
					t && n.push(`  ${e.table_name}.${e.column_name}: ${t}`);
				} else {
					let t = (await this.db.executeQuery(`SELECT MIN(${e.column_name})::text lo, MAX(${e.column_name})::text hi FROM ${e.table_name}`, [], this.config.sqlTimeoutMs)).rows[0];
					t?.lo && t?.hi && n.push(`  ${e.table_name}.${e.column_name}: ${t.lo} to ${t.hi}`);
				}
			} catch {}
			try {
				let e = (await this.db.executeQuery("SELECT table_name, column_name\n             FROM information_schema.columns\n            WHERE table_schema = 'public'\n              AND data_type IN ('character varying','text','character')\n              AND column_name ~* '(status|type_name|category|priority|risk|segment|gender|_name$)'\n              AND table_name NOT LIKE 'vw_%'\n            ORDER BY table_name, column_name", [], this.config.sqlTimeoutMs)).rows.map((e) => `SELECT '${e.table_name}.${e.column_name}' AS col, v::text AS val FROM (SELECT DISTINCT ${e.column_name} AS v FROM ${e.table_name}  WHERE ${e.column_name} IS NOT NULL LIMIT 26) s_${e.table_name}_${e.column_name}`);
				if (e.length > 0) {
					let t = await this.db.executeQuery(e.join(" UNION ALL "), [], this.config.sqlTimeoutMs), r = /* @__PURE__ */ new Map();
					for (let e of t.rows) r.has(e.col) || r.set(e.col, []), r.get(e.col).push(e.val);
					let i = [];
					for (let [e, t] of r) t.length === 0 || t.length > 25 || i.push(`  ${e}: ${t.sort().join(" | ")}`);
					i.length > 0 && (n.push(""), n.push("EXACT VALUES stored in categorical columns — filter using these"), n.push("strings verbatim. Never invent or abbreviate a value:"), n.push(...i));
				}
			} catch (e) {
				console.warn(`[Orchestrator] Could not profile categorical values: ${e.message}`);
			}
			this.dataCoverage = n.length ? `\n=== ACTUAL DATA COVERAGE (today is ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}) ===\nThese are the real ranges present. Any period you filter on must fall inside them.\nTables do not all cover the same span — when a question spans two tables, use the\noverlap of their ranges, never a period that only one of them has.\n` + n.join("\n") + "\n" : "";
		} catch (e) {
			console.warn(`[Orchestrator] Could not determine data coverage: ${e.message}`), this.dataCoverage = "";
		}
		return this.dataCoverage;
	}
	shouldPlan(e) {
		let t = e.toLowerCase();
		return (/* @__PURE__ */ "consecutive.year over year.year-over-year.yoy.quarter over quarter.quarter-over-quarter.compare.comparison.versus. vs .while.despite.whereas.trend.growth.declin.increas.decreas.percentile.median.top 5%.top 10%.bottom.average.median.above.below.exceeds.faster than.slower than.in each.for every.within each.per region.per department.before and after.unresolved.attrition.opposite. but ".split(".")).some((e) => t.includes(e)) ? !0 : e.trim().split(/\s+/).length > 14;
	}
	buildInlinePlan(e, t, n) {
		return {
			intent: e,
			entities: t.retrievedTableNames,
			filters: [],
			metrics: [],
			groupBy: [],
			orderBy: [],
			reasoning: n ? `${n}\n\nAnswer this question: ${e}` : e
		};
	}
	async generateSQLPlan(e, t, n) {
		let r = await this.getDataCoverage(), i = `You are an expert SQL query planner for a banking database (${this.config.dialect} dialect).
Your task is to analyze a natural language question and produce a structured query plan.

${t.schemaPrompt}
${t.semanticPrompt}
${r}
Any period you choose MUST lie within the data coverage above. Never plan a window
outside it — that returns zero rows. For "recent"/"last N periods", use the latest
periods that actually exist in the data.

${n ? `\n=== CONVERSATION CONTEXT ===\n${n}\n` : ""}

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
			systemPrompt: i,
			userPrompt: e,
			temperature: 0,
			maxTokens: 2e3,
			jsonMode: !0
		})).parsed;
	}
	async generateSQL(e, t) {
		let n = this.getDialectInstructions(), r = await this.getDataCoverage(), i = `You are an expert SQL developer. Generate a ${this.config.dialect.toUpperCase()} SQL query based on the structured plan and schema below.

${t.schemaPrompt}
${t.semanticPrompt}
${r}

=== SQL DIALECT RULES ===
${n}

=== WHAT TO ANSWER ===
${this.config.fastMode ? e.reasoning : JSON.stringify(e, null, 2)}

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
no commentary before or after. Do not restate the question. Start with SELECT or WITH.`, a = (await this.llm.generate({
			systemPrompt: i,
			userPrompt: `Generate the SQL query for: ${e.reasoning}`,
			temperature: 0,
			maxTokens: 3e3
		})).content.trim();
		return a = a.replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim(), a;
	}
	async diagnoseEmptyResult(e, t, n) {
		let r = "No records matched the specified criteria.";
		try {
			let i = await this.getDataCoverage(), a = await this.llm.generateStructured({
				systemPrompt: `A ${this.config.dialect.toUpperCase()} query returned zero rows. Determine why.

${n.schemaPrompt}
${i}

The user asked: "${e}"

The query that returned nothing:
${t}

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
				jsonMode: !0
			}), o = await Promise.all((a.parsed.probes ?? []).filter((e) => e?.sql && e?.condition).slice(0, 4).map(async (e) => {
				let t = this.guardian.validate(e.sql);
				if (!t.valid) return {
					condition: e.condition,
					matchCount: null,
					error: "probe failed validation"
				};
				try {
					let n = await this.db.executeQuery(t.modifiedSql || e.sql, [], 8e3), r = Number(n.rows?.[0]?.n ?? n.rows?.[0]?.count);
					return {
						condition: e.condition,
						matchCount: Number.isFinite(r) ? r : null
					};
				} catch (t) {
					return {
						condition: e.condition,
						matchCount: null,
						error: t.message
					};
				}
			})), s = o.filter((e) => e.matchCount !== null);
			if (s.length === 0) return {
				summary: r,
				probes: o
			};
			let c = s.filter((e) => e.matchCount === 0);
			if (c.length > 0) {
				let e = c.map((e) => `"${e.condition}"`).join(" and ");
				return {
					summary: `No records matched. The reason is ${c.length > 1 ? "these conditions match" : "this condition matches"} no rows at all in the current data: ${e}. Other conditions do have matching data, so the result is empty because of ${c.length > 1 ? "those" : "that"}.`,
					probes: o
				};
			}
			return {
				summary: `No records matched. Each condition has matching data on its own (${s.map((e) => `${e.condition}: ${e.matchCount.toLocaleString("en-IN")} rows`).join("; ")}), but no record satisfies all of them at the same time.`,
				probes: o
			};
		} catch (e) {
			return console.warn(`[Orchestrator] Empty-result diagnosis failed: ${e.message}`), {
				summary: r,
				probes: []
			};
		}
	}
	async generateSummary(e, t, n, r, i = !1) {
		if (r === 0) return {
			summary: "No records matched the specified criteria.",
			filters: t.filters
		};
		let a = n.slice(0, 5), o = n.length > 0 ? Object.keys(n[0]) : [], s = `You are a banking data analyst writing an executive summary.
Given a user question and query results, write a brief, clear summary. Two sentences maximum.

Question: "${e}"
Total rows returned: ${r}${i ? ` (TRUNCATED — the row cap was reached, so the full result set is LARGER than ${r}. Say the list is truncated and never present ${r} as a complete total.)` : ""}
Columns: ${o.join(", ")}
Sample data (first ${a.length} rows): ${JSON.stringify(a)}

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
				systemPrompt: s,
				userPrompt: "Generate the executive summary.",
				temperature: .1,
				maxTokens: 220,
				jsonMode: !0
			})).parsed;
		} catch {
			return {
				summary: `Retrieved ${r} record(s) for your query about ${t.intent}.`,
				filters: t.filters
			};
		}
	}
	async repairSQL(e, t, n, r) {
		let i = e, a = t, o = 0, s = 0, c = performance.now();
		for (; o < this.config.maxRepairAttempts && !a.valid;) {
			o++;
			let e = a.errors.map((e) => e.message).join("\n"), t = `The following ${this.config.dialect.toUpperCase()} SQL query has validation errors:

SQL:
${i}

Errors:
${e}

Schema context:
${n.schemaPrompt}

Fix the SQL to resolve these errors. Respond with ONLY the corrected SQL query.
Do not include explanations, markdown, or code blocks.`, r = performance.now(), c = await this.llm.generate({
				systemPrompt: `You are a SQL debugging expert. Fix the SQL query to resolve the reported errors. Use ${this.config.dialect.toUpperCase()} syntax.`,
				userPrompt: t,
				temperature: 0,
				maxTokens: 3e3
			});
			s += Math.round(performance.now() - r), i = c.content.trim().replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim(), a = this.guardian.validate(i);
		}
		return {
			success: a.valid,
			sql: i,
			validation: a,
			attempts: o,
			totalMs: Math.round(performance.now() - c),
			llmLatencyMs: s
		};
	}
	getErrorHint(e) {
		for (let [t, n] of [
			[/SELECT DISTINCT, ORDER BY expressions must appear in select list/i, "Fix: remove DISTINCT and de-duplicate with GROUP BY over the selected columns, or add every ORDER BY expression to the select list. Do not keep DISTINCT as-is."],
			[/must appear in the GROUP BY clause or be used in an aggregate function/i, "Fix: add that column to GROUP BY, or wrap it in an aggregate such as MAX()/AVG()."],
			[/function pg_catalog\.extract\(unknown, integer\) does not exist/i, "Fix: EXTRACT was applied to an integer, not a date. That value is already a number — use it directly instead of calling EXTRACT on it."],
			[/operator does not exist: /i, "Fix: the operand types do not match. Cast explicitly, e.g. value::numeric or value::date."],
			[/division by zero/i, "Fix: guard the denominator with NULLIF(denominator, 0)."]
		]) if (t.test(e)) return `\n\nKnown fix for this error: ${n}`;
		return "";
	}
	async repairSQLFromError(e, t, n, r) {
		let i = e, a = 0, o = 0;
		for (; a < this.config.maxRepairAttempts;) {
			a++;
			let e = this.getErrorHint(t), s = /column\s+"?[\w.]+"?\s+does not exist/i.test(t) ? "\n\nColumns that actually exist (table: columns):\n" + n.schemaContext.tables.map((e) => `${e.name}: ${e.columns.map((e) => e.name).join(", ")}`).join("\n") : "", c = `The following ${this.config.dialect.toUpperCase()} SQL query failed during execution:

SQL:
${i}

Database error:
${t}${e}${s}

Schema context:
${n.schemaPrompt}

Original query plan:
${JSON.stringify(r, null, 2)}

Fix the SQL to resolve this error.

Checklist before answering:
- If the error names a missing column, that column does not exist. Do NOT re-use it.
  Find the correct column in the schema above, or derive it — and if it came from a
  CTE, make the reference match the alias that CTE actually defines.
- Verify every column you reference exists on the table/CTE you qualify it with.
- Preserve the original query intent and ALL of its conditions.

Respond with ONLY the corrected SQL query.`, l = performance.now(), u = await this.llm.generate({
				systemPrompt: `You are a ${this.config.dialect.toUpperCase()} SQL debugging expert. Analyze the database error and fix the query.`,
				userPrompt: c,
				temperature: .05,
				maxTokens: 3e3
			});
			o += Math.round(performance.now() - l), i = u.content.trim().replace(/^```(?:sql)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
			let d = this.guardian.validate(i);
			if (d.valid) try {
				return await this.db.executeQuery(d.modifiedSql || i, [], this.config.sqlTimeoutMs), {
					success: !0,
					sql: i,
					validation: d,
					attempts: a,
					llmLatencyMs: o
				};
			} catch (e) {
				t = e.message;
			}
		}
		return {
			success: !1,
			sql: i,
			validation: this.guardian.validate(i),
			attempts: a,
			llmLatencyMs: o
		};
	}
	getConversationContext(e) {
		if (!e.sessionId || !e.isFollowUp) return;
		let t = this.conversations.get(e.sessionId);
		if (!(!t || t.history.length === 0)) return `The user is asking a follow-up question. Previous conversation:\n${t.history.slice(-3).map((e, t) => `Turn ${t + 1}: "${e.question}" → Tables: [${e.tables.join(", ")}]\nSQL: ${e.sql}`).join("\n\n")}\n\nThe new question should be interpreted in the context of this conversation. Carry forward relevant filters and context.`;
	}
	updateConversationContext(e, t, n, r) {
		let i = e.sessionId || "default";
		this.conversations.has(i) || this.conversations.set(i, {
			sessionId: i,
			history: []
		});
		let a = this.conversations.get(i);
		a.history.push({
			question: e.question,
			sql: t,
			plan: n,
			tables: r
		}), a.history.length > 10 && (a.history = a.history.slice(-10));
	}
	getDialectInstructions() {
		switch (this.config.dialect) {
			case "postgresql": return "\n- Use PostgreSQL syntax.\n- Use LIMIT for result limiting (not ROWNUM or TOP).\n- Use DATE_TRUNC for date truncation.\n- Use EXTRACT(MONTH FROM date) or EXTRACT(YEAR FROM date) for date parts.\n- Use COALESCE for null handling.\n- Use || for string concatenation.\n- Use CURRENT_DATE and CURRENT_TIMESTAMP.\n- Use GENERATE_SERIES for sequences if needed.\n- Use FILTER (WHERE ...) clause with aggregates if appropriate.\n- CTEs use WITH ... AS (...).\n- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() OVER (...).\n- Boolean values: TRUE/FALSE.\n- Case-sensitive identifiers: use double quotes if needed for mixed-case names.\n- For Indian fiscal year: FY starts April 1. FY 2023-24 means April 1 2023 to March 31 2024.";
			case "oracle": return "\n- Use Oracle SQL syntax.\n- Use FETCH FIRST N ROWS ONLY for result limiting (not LIMIT).\n- Use TRUNC(date, 'MM') for date truncation.\n- Use EXTRACT(MONTH FROM date) for date parts.\n- Use NVL or COALESCE for null handling.\n- Use || for string concatenation.\n- Use SYSDATE and SYSTIMESTAMP.\n- Use DUAL for SELECT without a table.\n- CTEs use WITH ... AS (...).\n- Window functions: ROW_NUMBER(), RANK(), DENSE_RANK(), LAG(), LEAD() OVER (...).\n- No boolean type; use 'Y'/'N' or 1/0.\n- For Indian fiscal year: FY starts April 1. FY 2023-24 means April 1 2023 to March 31 2024.";
			default: return "Use standard SQL syntax.";
		}
	}
	getBusinessDefs(e) {
		return e.semanticResolution.resolvedTerms.map((e) => `${e.originalTerm}: ${e.businessTerm.description}`);
	}
	buildDebugMetadata(e, t, n, r, i, a, o, s, c, l, u) {
		return {
			requestId: e,
			model: this.llm.getConfig().model,
			interpretedIntent: t,
			tablesSelected: n,
			businessDefinitionsUsed: r,
			sqlGenerated: i,
			validationStatus: a,
			executionTimeMs: o,
			llmLatencyMs: s,
			rowsReturned: c,
			repairAttempts: l,
			pipelineStages: u
		};
	}
};
//#endregion
//#region src/backend/init.ts
async function _(e) {
	console.log("[Init] Starting backend initialization...");
	let t = new s(v());
	await t.connect(), console.log("[Init] ✅ Database connected");
	let n = y(), r = new p(n, "qwen_runpod");
	console.log(`[Init] ✅ LLM configured: ${n.model} at ${n.baseUrl}`);
	let i = new c(), a = new l(), o = new d(e.databaseDir).load(i, a);
	console.log(`[Init] ✅ Schema loaded: ${o.tableCount} tables, ${o.viewCount} views, ${o.termCount} terms, ${o.ruleCount} rules, ${o.relationshipCount} relationships`);
	let f = new u(i, a), _ = new m(i, {
		maxResultRows: parseInt(process.env.SQL_MAX_ROWS || "1000", 10),
		maxJoins: parseInt(process.env.SQL_MAX_JOINS || "10", 10),
		maxSubqueryDepth: parseInt(process.env.SQL_MAX_SUBQUERY_DEPTH || "5", 10),
		dialect: "postgresql"
	}), b = new h(e.auditDir), x = new g(r, f, _, t, b, {
		maxRepairAttempts: parseInt(process.env.MAX_REPAIR_ATTEMPTS || "3", 10),
		maxResultRows: parseInt(process.env.SQL_MAX_ROWS || "1000", 10),
		sqlTimeoutMs: parseInt(process.env.SQL_TIMEOUT_MS || "30000", 10),
		llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10),
		dialect: "postgresql"
	});
	return console.log("[Init] ✅ Backend fully initialized"), {
		db: t,
		llm: r,
		schemaIntelligence: i,
		semanticLayer: a,
		schemaRetriever: f,
		guardian: _,
		auditLogger: b,
		orchestrator: x
	};
}
function v() {
	let e = process.env.DATABASE_URL;
	if (e) {
		let t = new URL(e);
		return {
			host: t.hostname,
			port: parseInt(t.port || "5432", 10),
			user: t.username,
			password: t.password,
			database: t.pathname.replace(/^\//, ""),
			dialect: "postgresql",
			readOnly: process.env.DB_READ_ONLY !== "false",
			maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "5", 10),
			idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10),
			connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "10000", 10),
			statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "30000", 10),
			ssl: e.includes("sslmode=require") || e.includes("neon.tech")
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
function y() {
	let e = process.env.LLM_BASE_URL;
	if (!e) throw Error("LLM_BASE_URL environment variable is required. Set it to your RunPod vLLM endpoint, e.g. https://<pod-id>-8000.proxy.runpod.net/v1");
	return {
		baseUrl: e,
		model: process.env.LLM_MODEL || "Qwen/Qwen3-Coder-Next",
		apiKey: process.env.LLM_API_KEY || process.env.RUNPOD_API_KEY,
		temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.05"),
		maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "4096", 10),
		timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10),
		maxRetries: parseInt(process.env.LLM_MAX_RETRIES || "2", 10)
	};
}
async function b(e) {
	let t = await e.db.testConnection(), n = await e.llm.healthCheck();
	return {
		database: {
			connected: t.success,
			latencyMs: t.latencyMs
		},
		llm: {
			healthy: n.healthy,
			model: n.model,
			latencyMs: n.latencyMs,
			error: n.error
		},
		schema: {
			tables: e.schemaIntelligence.getAllTables().length,
			terms: e.semanticLayer.getTermCount()
		}
	};
}
//#endregion
export { b as healthCheck, _ as initializeBackend };
