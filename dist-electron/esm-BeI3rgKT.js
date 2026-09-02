import { a as e, i as t, n, o as r, r as i, t as a } from "./chunk-BQCxAhux.js";
//#region node_modules/postgres-array/index.js
var o = /* @__PURE__ */ a(((e) => {
	e.parse = function(e, n) {
		return new t(e, n).parse();
	};
	var t = class e {
		constructor(e, t) {
			this.source = e, this.transform = t || n, this.position = 0, this.entries = [], this.recorded = [], this.dimension = 0;
		}
		isEof() {
			return this.position >= this.source.length;
		}
		nextCharacter() {
			var e = this.source[this.position++];
			return e === "\\" ? {
				value: this.source[this.position++],
				escaped: !0
			} : {
				value: e,
				escaped: !1
			};
		}
		record(e) {
			this.recorded.push(e);
		}
		newEntry(e) {
			var t;
			(this.recorded.length > 0 || e) && (t = this.recorded.join(""), t === "NULL" && !e && (t = null), t !== null && (t = this.transform(t)), this.entries.push(t), this.recorded = []);
		}
		consumeDimensions() {
			if (this.source[0] === "[") for (; !this.isEof() && this.nextCharacter().value !== "=";);
		}
		parse(t) {
			var n, r, i;
			for (this.consumeDimensions(); !this.isEof();) if (n = this.nextCharacter(), n.value === "{" && !i) this.dimension++, this.dimension > 1 && (r = new e(this.source.substr(this.position - 1), this.transform), this.entries.push(r.parse(!0)), this.position += r.position - 2);
			else if (n.value === "}" && !i) {
				if (this.dimension--, !this.dimension && (this.newEntry(), t)) return this.entries;
			} else n.value === "\"" && !n.escaped ? (i && this.newEntry(!0), i = !i) : n.value === "," && !i ? this.newEntry() : this.record(n.value);
			if (this.dimension !== 0) throw Error("array dimension not balanced");
			return this.entries;
		}
	};
	function n(e) {
		return e;
	}
})), s = /* @__PURE__ */ a(((e, t) => {
	var n = o();
	t.exports = { create: function(e, t) {
		return { parse: function() {
			return n.parse(e, t);
		} };
	} };
})), c = /* @__PURE__ */ a(((e, t) => {
	var n = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/, r = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/, i = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/, a = /^-?infinity$/;
	t.exports = function(e) {
		if (a.test(e)) return Number(e.replace("i", "I"));
		var t = n.exec(e);
		if (!t) return o(e) || null;
		var r = !!t[8], i = parseInt(t[1], 10);
		r && (i = c(i));
		var u = parseInt(t[2], 10) - 1, d = t[3], f = parseInt(t[4], 10), p = parseInt(t[5], 10), m = parseInt(t[6], 10), h = t[7];
		h = h ? 1e3 * parseFloat(h) : 0;
		var g, _ = s(e);
		return _ == null ? (g = new Date(i, u, d, f, p, m, h), l(i) && g.setFullYear(i)) : (g = new Date(Date.UTC(i, u, d, f, p, m, h)), l(i) && g.setUTCFullYear(i), _ !== 0 && g.setTime(g.getTime() - _)), g;
	};
	function o(e) {
		var t = r.exec(e);
		if (t) {
			var n = parseInt(t[1], 10);
			t[4] && (n = c(n));
			var i = parseInt(t[2], 10) - 1, a = t[3], o = new Date(n, i, a);
			return l(n) && o.setFullYear(n), o;
		}
	}
	function s(e) {
		if (e.endsWith("+00")) return 0;
		var t = i.exec(e.split(" ")[1]);
		if (t) {
			var n = t[1];
			if (n === "Z") return 0;
			var r = n === "-" ? -1 : 1;
			return (parseInt(t[2], 10) * 3600 + parseInt(t[3] || 0, 10) * 60 + parseInt(t[4] || 0, 10)) * r * 1e3;
		}
	}
	function c(e) {
		return -(e - 1);
	}
	function l(e) {
		return e >= 0 && e < 100;
	}
})), l = /* @__PURE__ */ a(((e, t) => {
	t.exports = r;
	var n = Object.prototype.hasOwnProperty;
	function r(e) {
		for (var t = 1; t < arguments.length; t++) {
			var r = arguments[t];
			for (var i in r) n.call(r, i) && (e[i] = r[i]);
		}
		return e;
	}
})), u = /* @__PURE__ */ a(((e, t) => {
	var n = l();
	t.exports = r;
	function r(e) {
		if (!(this instanceof r)) return new r(e);
		n(this, _(e));
	}
	var i = [
		"seconds",
		"minutes",
		"hours",
		"days",
		"months",
		"years"
	];
	r.prototype.toPostgres = function() {
		var e = i.filter(this.hasOwnProperty, this);
		return this.milliseconds && e.indexOf("seconds") < 0 && e.push("seconds"), e.length === 0 ? "0" : e.map(function(e) {
			var t = this[e] || 0;
			return e === "seconds" && this.milliseconds && (t = (t + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "")), t + " " + e;
		}, this).join(" ");
	};
	var a = {
		years: "Y",
		months: "M",
		days: "D",
		hours: "H",
		minutes: "M",
		seconds: "S"
	}, o = [
		"years",
		"months",
		"days"
	], s = [
		"hours",
		"minutes",
		"seconds"
	];
	r.prototype.toISOString = r.prototype.toISO = function() {
		var e = o.map(n, this).join(""), t = s.map(n, this).join("");
		return "P" + e + "T" + t;
		function n(e) {
			var t = this[e] || 0;
			return e === "seconds" && this.milliseconds && (t = (t + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "")), t + a[e];
		}
	};
	var c = "([+-]?\\d+)", u = c + "\\s+years?", d = c + "\\s+mons?", f = c + "\\s+days?", p = new RegExp([
		u,
		d,
		f,
		"([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?"
	].map(function(e) {
		return "(" + e + ")?";
	}).join("\\s*")), m = {
		years: 2,
		months: 4,
		days: 6,
		hours: 9,
		minutes: 10,
		seconds: 11,
		milliseconds: 12
	}, h = [
		"hours",
		"minutes",
		"seconds",
		"milliseconds"
	];
	function g(e) {
		var t = e + "000000".slice(e.length);
		return parseInt(t, 10) / 1e3;
	}
	function _(e) {
		if (!e) return {};
		var t = p.exec(e), n = t[8] === "-";
		return Object.keys(m).reduce(function(e, r) {
			var i = t[m[r]];
			return !i || (i = r === "milliseconds" ? g(i) : parseInt(i, 10), !i) ? e : (n && ~h.indexOf(r) && (i *= -1), e[r] = i, e);
		}, {});
	}
})), d = /* @__PURE__ */ a(((e, t) => {
	var n = Buffer.from || Buffer;
	t.exports = function(e) {
		if (/^\\x/.test(e)) return n(e.substr(2), "hex");
		for (var t = "", r = 0; r < e.length;) if (e[r] !== "\\") t += e[r], ++r;
		else if (/[0-7]{3}/.test(e.substr(r + 1, 3))) t += String.fromCharCode(parseInt(e.substr(r + 1, 3), 8)), r += 4;
		else {
			for (var i = 1; r + i < e.length && e[r + i] === "\\";) i++;
			for (var a = 0; a < Math.floor(i / 2); ++a) t += "\\";
			r += Math.floor(i / 2) * 2;
		}
		return n(t, "binary");
	};
})), f = /* @__PURE__ */ a(((e, t) => {
	var n = o(), r = s(), i = c(), a = u(), l = d();
	function f(e) {
		return function(t) {
			return t === null ? t : e(t);
		};
	}
	function p(e) {
		return e === null ? e : e === "TRUE" || e === "t" || e === "true" || e === "y" || e === "yes" || e === "on" || e === "1";
	}
	function m(e) {
		return e ? n.parse(e, p) : null;
	}
	function h(e) {
		return parseInt(e, 10);
	}
	function g(e) {
		return e ? n.parse(e, f(h)) : null;
	}
	function _(e) {
		return e ? n.parse(e, f(function(e) {
			return T(e).trim();
		})) : null;
	}
	var v = function(e) {
		return e ? r.create(e, function(e) {
			return e !== null && (e = D(e)), e;
		}).parse() : null;
	}, y = function(e) {
		return e ? r.create(e, function(e) {
			return e !== null && (e = parseFloat(e)), e;
		}).parse() : null;
	}, b = function(e) {
		return e ? r.create(e).parse() : null;
	}, x = function(e) {
		return e ? r.create(e, function(e) {
			return e !== null && (e = i(e)), e;
		}).parse() : null;
	}, S = function(e) {
		return e ? r.create(e, function(e) {
			return e !== null && (e = a(e)), e;
		}).parse() : null;
	}, C = function(e) {
		return e ? n.parse(e, f(l)) : null;
	}, w = function(e) {
		return parseInt(e, 10);
	}, T = function(e) {
		var t = String(e);
		return /^\d+$/.test(t) ? t : e;
	}, E = function(e) {
		return e ? n.parse(e, f(JSON.parse)) : null;
	}, D = function(e) {
		return e[0] === "(" ? (e = e.substring(1, e.length - 1).split(","), {
			x: parseFloat(e[0]),
			y: parseFloat(e[1])
		}) : null;
	}, O = function(e) {
		if (e[0] !== "<" && e[1] !== "(") return null;
		for (var t = "(", n = "", r = !1, i = 2; i < e.length - 1; i++) {
			if (r || (t += e[i]), e[i] === ")") {
				r = !0;
				continue;
			} else if (!r) continue;
			e[i] !== "," && (n += e[i]);
		}
		var a = D(t);
		return a.radius = parseFloat(n), a;
	};
	t.exports = { init: function(e) {
		e(20, T), e(21, w), e(23, w), e(26, w), e(700, parseFloat), e(701, parseFloat), e(16, p), e(1082, i), e(1114, i), e(1184, i), e(600, D), e(651, b), e(718, O), e(1e3, m), e(1001, C), e(1005, g), e(1007, g), e(1028, g), e(1016, _), e(1017, v), e(1021, y), e(1022, y), e(1231, y), e(1014, b), e(1015, b), e(1008, b), e(1009, b), e(1040, b), e(1041, b), e(1115, x), e(1182, x), e(1185, x), e(1186, a), e(1187, S), e(17, l), e(114, JSON.parse.bind(JSON)), e(3802, JSON.parse.bind(JSON)), e(199, E), e(3807, E), e(3907, b), e(2951, b), e(791, b), e(1183, b), e(1270, b);
	} };
})), p = /* @__PURE__ */ a(((e, t) => {
	var n = 1e6;
	function r(e) {
		var t = e.readInt32BE(0), r = e.readUInt32BE(4), i = "";
		t < 0 && (t = ~t + (r === 0), r = ~r + 1 >>> 0, i = "-");
		var a = "", o = t % n, s, c, l, u, d;
		if (t = t / n >>> 0, s = 4294967296 * o + r, r = s / n >>> 0, c = "" + (s - n * r), r === 0 && t === 0) return i + c + a;
		for (l = "", u = 6 - c.length, d = 0; d < u; d++) l += "0";
		if (a = l + c + a, o = t % n, t = t / n >>> 0, s = 4294967296 * o + r, r = s / n >>> 0, c = "" + (s - n * r), r === 0 && t === 0) return i + c + a;
		for (l = "", u = 6 - c.length, d = 0; d < u; d++) l += "0";
		if (a = l + c + a, o = t % n, t = t / n >>> 0, s = 4294967296 * o + r, r = s / n >>> 0, c = "" + (s - n * r), r === 0 && t === 0) return i + c + a;
		for (l = "", u = 6 - c.length, d = 0; d < u; d++) l += "0";
		return a = l + c + a, o = t % n, s = 4294967296 * o + r, c = "" + s % n, i + c + a;
	}
	t.exports = r;
})), m = /* @__PURE__ */ a(((e, t) => {
	var n = p(), r = function(e, t, n, r, i) {
		n ||= 0, r ||= !1, i ||= function(e, t, n) {
			return e * 2 ** n + t;
		};
		var a = n >> 3, o = function(e) {
			return r ? ~e & 255 : e;
		}, s = 255, c = 8 - n % 8;
		t < c && (s = 255 << 8 - t & 255, c = t), n && (s >>= n % 8);
		var l = 0;
		n % 8 + t >= 8 && (l = i(0, o(e[a]) & s, c));
		for (var u = t + n >> 3, d = a + 1; d < u; d++) l = i(l, o(e[d]), 8);
		var f = (t + n) % 8;
		return f > 0 && (l = i(l, o(e[u]) >> 8 - f, f)), l;
	}, i = function(e, t, n) {
		var i = 2 ** (n - 1) - 1, a = r(e, 1), o = r(e, n, 1);
		if (o === 0) return 0;
		var s = 1, c = r(e, t, n + 1, !1, function(e, t, n) {
			e === 0 && (e = 1);
			for (var r = 1; r <= n; r++) s /= 2, (t & 1 << n - r) > 0 && (e += s);
			return e;
		});
		return o == 2 ** (n + 1) - 1 ? c === 0 ? a === 0 ? Infinity : -Infinity : NaN : (a === 0 ? 1 : -1) * 2 ** (o - i) * c;
	}, a = function(e) {
		return r(e, 1) == 1 ? -1 * (r(e, 15, 1, !0) + 1) : r(e, 15, 1);
	}, o = function(e) {
		return r(e, 1) == 1 ? -1 * (r(e, 31, 1, !0) + 1) : r(e, 31, 1);
	}, s = function(e) {
		return i(e, 23, 8);
	}, c = function(e) {
		return i(e, 52, 11);
	}, l = function(e) {
		var t = r(e, 16, 32);
		if (t == 49152) return NaN;
		for (var n = 1e4 ** r(e, 16, 16), i = 0, a = r(e, 16), o = 0; o < a; o++) i += r(e, 16, 64 + 16 * o) * n, n /= 1e4;
		var s = 10 ** r(e, 16, 48);
		return (t === 0 ? 1 : -1) * Math.round(i * s) / s;
	}, u = function(e, t) {
		var n = r(t, 1), i = r(t, 63, 1), a = /* @__PURE__ */ new Date((n === 0 ? 1 : -1) * i / 1e3 + 9466848e5);
		return e || a.setTime(a.getTime() + a.getTimezoneOffset() * 6e4), a.usec = i % 1e3, a.getMicroSeconds = function() {
			return this.usec;
		}, a.setMicroSeconds = function(e) {
			this.usec = e;
		}, a.getUTCMicroSeconds = function() {
			return this.usec;
		}, a;
	}, d = function(e) {
		var t = r(e, 32);
		r(e, 32, 32);
		for (var n = r(e, 32, 64), i = 96, a = [], o = 0; o < t; o++) a[o] = r(e, 32, i), i += 32, i += 32;
		var s = function(t) {
			var n = r(e, 32, i);
			if (i += 32, n == 4294967295) return null;
			var a;
			if (t == 23 || t == 20) return a = r(e, n * 8, i), i += n * 8, a;
			if (t == 25) return a = e.toString(this.encoding, i >> 3, (i += n << 3) >> 3), a;
			console.log("ERROR: ElementType not implemented: " + t);
		}, c = function(e, t) {
			var n = [], r;
			if (e.length > 1) {
				var i = e.shift();
				for (r = 0; r < i; r++) n[r] = c(e, t);
				e.unshift(i);
			} else for (r = 0; r < e[0]; r++) n[r] = s(t);
			return n;
		};
		return c(a, n);
	}, f = function(e) {
		return e.toString("utf8");
	}, m = function(e) {
		return e === null ? null : r(e, 8) > 0;
	};
	t.exports = { init: function(e) {
		e(20, n), e(21, a), e(23, o), e(26, o), e(1700, l), e(700, s), e(701, c), e(16, m), e(1114, u.bind(null, !1)), e(1184, u.bind(null, !0)), e(1e3, d), e(1007, d), e(1016, d), e(1008, d), e(1009, d), e(25, f);
	} };
})), h = /* @__PURE__ */ a(((e, t) => {
	t.exports = {
		BOOL: 16,
		BYTEA: 17,
		CHAR: 18,
		INT8: 20,
		INT2: 21,
		INT4: 23,
		REGPROC: 24,
		TEXT: 25,
		OID: 26,
		TID: 27,
		XID: 28,
		CID: 29,
		JSON: 114,
		XML: 142,
		PG_NODE_TREE: 194,
		SMGR: 210,
		PATH: 602,
		POLYGON: 604,
		CIDR: 650,
		FLOAT4: 700,
		FLOAT8: 701,
		ABSTIME: 702,
		RELTIME: 703,
		TINTERVAL: 704,
		CIRCLE: 718,
		MACADDR8: 774,
		MONEY: 790,
		MACADDR: 829,
		INET: 869,
		ACLITEM: 1033,
		BPCHAR: 1042,
		VARCHAR: 1043,
		DATE: 1082,
		TIME: 1083,
		TIMESTAMP: 1114,
		TIMESTAMPTZ: 1184,
		INTERVAL: 1186,
		TIMETZ: 1266,
		BIT: 1560,
		VARBIT: 1562,
		NUMERIC: 1700,
		REFCURSOR: 1790,
		REGPROCEDURE: 2202,
		REGOPER: 2203,
		REGOPERATOR: 2204,
		REGCLASS: 2205,
		REGTYPE: 2206,
		UUID: 2950,
		TXID_SNAPSHOT: 2970,
		PG_LSN: 3220,
		PG_NDISTINCT: 3361,
		PG_DEPENDENCIES: 3402,
		TSVECTOR: 3614,
		TSQUERY: 3615,
		GTSVECTOR: 3642,
		REGCONFIG: 3734,
		REGDICTIONARY: 3769,
		JSONB: 3802,
		REGNAMESPACE: 4089,
		REGROLE: 4096
	};
})), g = /* @__PURE__ */ a(((e) => {
	var t = f(), n = m(), r = s(), i = h();
	e.getTypeParser = c, e.setTypeParser = l, e.arrayParser = r, e.builtins = i;
	var a = {
		text: {},
		binary: {}
	};
	function o(e) {
		return String(e);
	}
	function c(e, t) {
		return t ||= "text", a[t] && a[t][e] || o;
	}
	function l(e, t, n) {
		typeof t == "function" && (n = t, t = "text"), a[t][e] = n;
	}
	t.init(function(e, t) {
		a.text[e] = t;
	}), n.init(function(e, t) {
		a.binary[e] = t;
	});
})), _ = /* @__PURE__ */ a(((e, t) => {
	var n;
	try {
		n = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
	} catch {}
	t.exports = {
		host: "localhost",
		user: n,
		database: void 0,
		password: null,
		connectionString: void 0,
		port: 5432,
		rows: 0,
		binary: !1,
		max: 10,
		idleTimeoutMillis: 3e4,
		client_encoding: "",
		ssl: !1,
		application_name: void 0,
		fallback_application_name: void 0,
		options: void 0,
		parseInputDatesAsUTC: !1,
		statement_timeout: !1,
		lock_timeout: !1,
		idle_in_transaction_session_timeout: !1,
		query_timeout: !1,
		connect_timeout: 0,
		keepalives: 1,
		keepalives_idle: 0
	};
	var r = g(), i = r.getTypeParser(20, "text"), a = r.getTypeParser(1016, "text");
	t.exports.__defineSetter__("parseInt8", function(e) {
		r.setTypeParser(20, "text", e ? r.getTypeParser(23, "text") : i), r.setTypeParser(1016, "text", e ? r.getTypeParser(1007, "text") : a);
	});
})), v = /* @__PURE__ */ a(((e, n) => {
	var r = _(), i = t("util"), { isDate: a } = i.types || i;
	function o(e) {
		return "\"" + e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
	}
	function s(e) {
		let t = "{";
		for (let n = 0; n < e.length; n++) if (n > 0 && (t += ","), e[n] === null || e[n] === void 0) t += "NULL";
		else if (Array.isArray(e[n])) t += s(e[n]);
		else if (ArrayBuffer.isView(e[n])) {
			let r = e[n];
			if (!(r instanceof Buffer)) {
				let e = Buffer.from(r.buffer, r.byteOffset, r.byteLength);
				r = e.length === r.byteLength ? e : e.slice(r.byteOffset, r.byteOffset + r.byteLength);
			}
			t += "\\\\x" + r.toString("hex");
		} else t += o(c(e[n]));
		return t += "}", t;
	}
	var c = function(e, t) {
		if (e == null) return null;
		if (typeof e == "object") {
			if (e instanceof Buffer) return e;
			if (ArrayBuffer.isView(e)) {
				let t = Buffer.from(e.buffer, e.byteOffset, e.byteLength);
				return t.length === e.byteLength ? t : t.slice(e.byteOffset, e.byteOffset + e.byteLength);
			}
			return a(e) ? r.parseInputDatesAsUTC ? d(e) : u(e) : Array.isArray(e) ? s(e) : l(e, t);
		}
		return e.toString();
	};
	function l(e, t) {
		if (e && typeof e.toPostgres == "function") {
			if (t ||= [], t.indexOf(e) !== -1) throw Error("circular reference detected while preparing \"" + e + "\" for query");
			return t.push(e), c(e.toPostgres(c), t);
		}
		return JSON.stringify(e);
	}
	function u(e) {
		let t = -e.getTimezoneOffset(), n = e.getFullYear(), r = n < 1;
		r && (n = Math.abs(n) + 1);
		let i = String(n).padStart(4, "0") + "-" + String(e.getMonth() + 1).padStart(2, "0") + "-" + String(e.getDate()).padStart(2, "0") + "T" + String(e.getHours()).padStart(2, "0") + ":" + String(e.getMinutes()).padStart(2, "0") + ":" + String(e.getSeconds()).padStart(2, "0") + "." + String(e.getMilliseconds()).padStart(3, "0");
		return t < 0 ? (i += "-", t *= -1) : i += "+", i += String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"), r && (i += " BC"), i;
	}
	function d(e) {
		let t = e.getUTCFullYear(), n = t < 1;
		n && (t = Math.abs(t) + 1);
		let r = String(t).padStart(4, "0") + "-" + String(e.getUTCMonth() + 1).padStart(2, "0") + "-" + String(e.getUTCDate()).padStart(2, "0") + "T" + String(e.getUTCHours()).padStart(2, "0") + ":" + String(e.getUTCMinutes()).padStart(2, "0") + ":" + String(e.getUTCSeconds()).padStart(2, "0") + "." + String(e.getUTCMilliseconds()).padStart(3, "0");
		return r += "+00:00", n && (r += " BC"), r;
	}
	function f(e, t, n) {
		return e = typeof e == "string" ? { text: e } : e, t && (typeof t == "function" ? e.callback = t : e.values = t), n && (e.callback = n), e;
	}
	n.exports = {
		prepareValue: function(e) {
			return c(e);
		},
		normalizeQueryConfig: f,
		escapeIdentifier: function(e) {
			return "\"" + e.replace(/"/g, "\"\"") + "\"";
		},
		escapeLiteral: function(e) {
			let t = !1, n = "'";
			if (e == null || typeof e != "string") return "''";
			for (let r = 0; r < e.length; r++) {
				let i = e[r];
				i === "'" ? n += i + i : i === "\\" ? (n += i + i, t = !0) : n += i;
			}
			return n += "'", t === !0 && (n = " E" + n), n;
		}
	};
})), y = /* @__PURE__ */ a(((e, n) => {
	var r = t("crypto");
	function i(e) {
		return r.createHash("md5").update(e, "utf-8").digest("hex");
	}
	function a(e, t, n) {
		let r = i(t + e);
		return "md5" + i(Buffer.concat([Buffer.from(r), n]));
	}
	function o(e) {
		return r.createHash("sha256").update(e).digest();
	}
	function s(e, t) {
		return e = e.replace(/(\D)-/, "$1"), r.createHash(e).update(t).digest();
	}
	function c(e, t) {
		return r.createHmac("sha256", e).update(t).digest();
	}
	async function l(e, t, n) {
		return r.pbkdf2Sync(e, t, n, 32, "sha256");
	}
	n.exports = {
		postgresMd5PasswordHash: a,
		randomBytes: r.randomBytes,
		deriveKey: l,
		sha256: o,
		hashByName: s,
		hmacSha256: c,
		md5: i
	};
})), b = /* @__PURE__ */ a(((e, n) => {
	var r = t("crypto");
	n.exports = {
		postgresMd5PasswordHash: l,
		randomBytes: s,
		deriveKey: p,
		sha256: u,
		hashByName: d,
		hmacSha256: f,
		md5: c
	};
	var i = r.webcrypto || globalThis.crypto, a = i.subtle, o = new TextEncoder();
	function s(e) {
		return i.getRandomValues(Buffer.alloc(e));
	}
	async function c(e) {
		try {
			return r.createHash("md5").update(e, "utf-8").digest("hex");
		} catch {
			let t = typeof e == "string" ? o.encode(e) : e, n = await a.digest("MD5", t);
			return Array.from(new Uint8Array(n)).map((e) => e.toString(16).padStart(2, "0")).join("");
		}
	}
	async function l(e, t, n) {
		let r = await c(t + e);
		return "md5" + await c(Buffer.concat([Buffer.from(r), n]));
	}
	async function u(e) {
		return await a.digest("SHA-256", e);
	}
	async function d(e, t) {
		return await a.digest(e, t);
	}
	async function f(e, t) {
		let n = await a.importKey("raw", e, {
			name: "HMAC",
			hash: "SHA-256"
		}, !1, ["sign"]);
		return await a.sign("HMAC", n, o.encode(t));
	}
	async function p(e, t, n) {
		let r = await a.importKey("raw", o.encode(e), "PBKDF2", !1, ["deriveBits"]), i = {
			name: "PBKDF2",
			hash: "SHA-256",
			salt: t,
			iterations: n
		};
		return await a.deriveBits(i, r, 256, ["deriveBits"]);
	}
})), x = /* @__PURE__ */ a(((e, t) => {
	parseInt(process.versions && process.versions.node && process.versions.node.split(".")[0]) < 15 ? t.exports = y() : t.exports = b();
})), S = /* @__PURE__ */ a(((e, t) => {
	function n(e, t) {
		return /* @__PURE__ */ Error("SASL channel binding: " + e + " when parsing public certificate " + t.toString("base64"));
	}
	function r(e, t) {
		let r = e[t++];
		if (r < 128) return {
			length: r,
			index: t
		};
		let i = r & 127;
		if (i > 4) throw n("bad length", e);
		r = 0;
		for (let n = 0; n < i; n++) r = r << 8 | e[t++];
		return {
			length: r,
			index: t
		};
	}
	function i(e, t) {
		if (e[t++] !== 6) throw n("non-OID data", e);
		let { length: i, index: a } = r(e, t);
		t = a;
		let o = t + i, s = e[t++], c = (s / 40 >> 0) + "." + s % 40;
		for (; t < o;) {
			let n = 0;
			for (; t < o;) {
				let r = e[t++];
				if (n = n << 7 | r & 127, r < 128) break;
			}
			c += "." + n;
		}
		return {
			oid: c,
			index: t
		};
	}
	function a(e, t) {
		if (e[t++] !== 48) throw n("non-sequence data", e);
		return r(e, t);
	}
	function o(e, t) {
		t === void 0 && (t = 0), t = a(e, t).index;
		let { length: o, index: s } = a(e, t);
		t = s + o, t = a(e, t).index;
		let { oid: c, index: l } = i(e, t);
		switch (c) {
			case "1.2.840.113549.1.1.4": return "MD5";
			case "1.2.840.113549.1.1.5": return "SHA-1";
			case "1.2.840.113549.1.1.11": return "SHA-256";
			case "1.2.840.113549.1.1.12": return "SHA-384";
			case "1.2.840.113549.1.1.13": return "SHA-512";
			case "1.2.840.113549.1.1.14": return "SHA-224";
			case "1.2.840.113549.1.1.15": return "SHA512-224";
			case "1.2.840.113549.1.1.16": return "SHA512-256";
			case "1.2.840.10045.4.1": return "SHA-1";
			case "1.2.840.10045.4.3.1": return "SHA-224";
			case "1.2.840.10045.4.3.2": return "SHA-256";
			case "1.2.840.10045.4.3.3": return "SHA-384";
			case "1.2.840.10045.4.3.4": return "SHA-512";
			case "1.2.840.113549.1.1.10": {
				if (t = l, t = a(e, t).index, e[t++] !== 160) throw n("non-tag data", e);
				t = r(e, t).index, t = a(e, t).index;
				let { oid: o } = i(e, t);
				switch (o) {
					case "1.2.840.113549.2.5": return "MD5";
					case "1.3.14.3.2.26": return "SHA-1";
					case "2.16.840.1.101.3.4.2.1": return "SHA-256";
					case "2.16.840.1.101.3.4.2.2": return "SHA-384";
					case "2.16.840.1.101.3.4.2.3": return "SHA-512";
				}
				throw n("unknown hash OID " + o, e);
			}
			case "1.3.101.110":
			case "1.3.101.112": return "SHA-512";
			case "1.3.101.111":
			case "1.3.101.113": throw n("Ed448 certificate channel binding is not currently supported by Postgres");
		}
		throw n("unknown OID " + c, e);
	}
	t.exports = { signatureAlgorithmHashFromCertificate: o };
})), C = /* @__PURE__ */ a(((e, t) => {
	var n = x(), { signatureAlgorithmHashFromCertificate: r } = S();
	function i(e, t) {
		let r = ["SCRAM-SHA-256"];
		t && r.unshift("SCRAM-SHA-256-PLUS");
		let i = r.find((t) => e.includes(t));
		if (!i) throw Error("SASL: Only mechanism(s) " + r.join(" and ") + " are supported");
		if (i === "SCRAM-SHA-256-PLUS" && typeof t.getPeerCertificate != "function") throw Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
		let a = n.randomBytes(18).toString("base64");
		return {
			mechanism: i,
			clientNonce: a,
			response: (i === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : t ? "y" : "n") + ",,n=*,r=" + a,
			message: "SASLInitialResponse"
		};
	}
	async function a(e, t, i, a) {
		if (e.message !== "SASLInitialResponse") throw Error("SASL: Last message was not SASLInitialResponse");
		if (typeof t != "string") throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
		if (t === "") throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
		if (typeof i != "string") throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
		let o = u(i);
		if (!o.nonce.startsWith(e.clientNonce)) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
		if (o.nonce.length === e.clientNonce.length) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
		let s = "n=*,r=" + e.clientNonce, c = "r=" + o.nonce + ",s=" + o.salt + ",i=" + o.iteration, l = a ? "eSws" : "biws";
		if (e.mechanism === "SCRAM-SHA-256-PLUS") {
			let e = a.getPeerCertificate().raw, t = r(e);
			(t === "MD5" || t === "SHA-1") && (t = "SHA-256");
			let i = await n.hashByName(t, e);
			l = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(i)]).toString("base64");
		}
		let d = "c=" + l + ",r=" + o.nonce, p = s + "," + c + "," + d, m = Buffer.from(o.salt, "base64"), h = await n.deriveKey(t, m, o.iteration), g = await n.hmacSha256(h, "Client Key"), _ = await n.sha256(g), v = await n.hmacSha256(_, p), y = f(Buffer.from(g), Buffer.from(v)).toString("base64"), b = await n.hmacSha256(h, "Server Key"), x = await n.hmacSha256(b, p);
		e.message = "SASLResponse", e.serverSignature = Buffer.from(x).toString("base64"), e.response = d + ",p=" + y;
	}
	function o(e, t) {
		if (e.message !== "SASLResponse") throw Error("SASL: Last message was not SASLResponse");
		if (typeof t != "string") throw Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
		let { serverSignature: n } = d(t);
		if (n !== e.serverSignature) throw Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
	}
	function s(e) {
		if (typeof e != "string") throw TypeError("SASL: text must be a string");
		return e.split("").map((t, n) => e.charCodeAt(n)).every((e) => e >= 33 && e <= 43 || e >= 45 && e <= 126);
	}
	function c(e) {
		return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(e);
	}
	function l(e) {
		if (typeof e != "string") throw TypeError("SASL: attribute pairs text must be a string");
		return new Map(e.split(",").map((e) => {
			if (!/^.=/.test(e)) throw Error("SASL: Invalid attribute pair entry");
			return [e[0], e.substring(2)];
		}));
	}
	function u(e) {
		let t = l(e), n = t.get("r");
		if (!n) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
		if (!s(n)) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
		let r = t.get("s");
		if (!r) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
		if (!c(r)) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
		let i = t.get("i");
		if (!i) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
		if (!/^[1-9][0-9]*$/.test(i)) throw Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
		return {
			nonce: n,
			salt: r,
			iteration: parseInt(i, 10)
		};
	}
	function d(e) {
		let t = l(e).get("v");
		if (!t) throw Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
		if (!c(t)) throw Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
		return { serverSignature: t };
	}
	function f(e, t) {
		if (!Buffer.isBuffer(e)) throw TypeError("first argument must be a Buffer");
		if (!Buffer.isBuffer(t)) throw TypeError("second argument must be a Buffer");
		if (e.length !== t.length) throw Error("Buffer lengths must match");
		if (e.length === 0) throw Error("Buffers cannot be empty");
		return Buffer.from(e.map((n, r) => e[r] ^ t[r]));
	}
	t.exports = {
		startSession: i,
		continueSession: a,
		finalizeSession: o
	};
})), w = /* @__PURE__ */ a(((e, t) => {
	var n = g();
	function r(e) {
		this._types = e || n, this.text = {}, this.binary = {};
	}
	r.prototype.getOverrides = function(e) {
		switch (e) {
			case "text": return this.text;
			case "binary": return this.binary;
			default: return {};
		}
	}, r.prototype.setTypeParser = function(e, t, n) {
		typeof t == "function" && (n = t, t = "text"), this.getOverrides(t)[e] = n;
	}, r.prototype.getTypeParser = function(e, t) {
		return t ||= "text", this.getOverrides(t)[e] || this._types.getTypeParser(e, t);
	}, t.exports = r;
})), T = /* @__PURE__ */ a(((e, n) => {
	function r(e, n = {}) {
		if (e.charAt(0) === "/") {
			let t = e.split(" ");
			return {
				host: t[0],
				database: t[1]
			};
		}
		let r = {}, i, a = !1;
		/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(e) && (e = encodeURI(e).replace(/%25(\d\d)/g, "%$1"));
		try {
			try {
				i = new URL(e, "postgres://base");
			} catch {
				i = new URL(e.replace("@/", "@___DUMMY___/"), "postgres://base"), a = !0;
			}
		} catch (e) {
			throw e.input &&= "*****REDACTED*****", e;
		}
		for (let e of i.searchParams.entries()) r[e[0]] = e[1];
		if (r.user = r.user || decodeURIComponent(i.username), r.password = r.password || decodeURIComponent(i.password), i.protocol == "socket:") return r.host = decodeURI(i.pathname), r.database = i.searchParams.get("db"), r.client_encoding = i.searchParams.get("encoding"), r;
		let o = a ? "" : i.hostname;
		r.host ? o && /^%2f/i.test(o) && (i.pathname = o + i.pathname) : r.host = decodeURIComponent(o), r.port ||= i.port;
		let c = i.pathname.slice(1) || null;
		r.database = c ? decodeURI(c) : null, (r.ssl === "true" || r.ssl === "1") && (r.ssl = !0), r.ssl === "0" && (r.ssl = !1), (r.sslcert || r.sslkey || r.sslrootcert || r.sslmode) && (r.ssl = {});
		let l = r.sslcert || r.sslkey || r.sslrootcert ? t("fs") : null;
		if (r.sslcert && (r.ssl.cert = l.readFileSync(r.sslcert).toString()), r.sslkey && (r.ssl.key = l.readFileSync(r.sslkey).toString()), r.sslrootcert && (r.ssl.ca = l.readFileSync(r.sslrootcert).toString()), n.useLibpqCompat && r.uselibpqcompat) throw Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
		if (r.uselibpqcompat === "true" || n.useLibpqCompat) switch (r.sslmode) {
			case "disable":
				r.ssl = !1;
				break;
			case "prefer":
				r.ssl.rejectUnauthorized = !1;
				break;
			case "require":
				r.sslrootcert ? r.ssl.checkServerIdentity = function() {} : r.ssl.rejectUnauthorized = !1;
				break;
			case "verify-ca":
				if (!r.ssl.ca) throw Error("SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security.");
				r.ssl.checkServerIdentity = function() {};
				break;
			case "verify-full": break;
		}
		else switch (r.sslmode) {
			case "disable":
				r.ssl = !1;
				break;
			case "prefer":
			case "require":
			case "verify-ca":
			case "verify-full":
				r.sslmode !== "verify-full" && s(r.sslmode);
				break;
			case "no-verify":
				r.ssl.rejectUnauthorized = !1;
				break;
		}
		return r;
	}
	function i(e) {
		return Object.entries(e).reduce((e, [t, n]) => (n != null && (e[t] = n), e), {});
	}
	function a(e) {
		return Object.entries(e).reduce((e, [t, n]) => {
			if (t === "ssl") {
				let r = n;
				typeof r == "boolean" && (e[t] = r), typeof r == "object" && (e[t] = i(r));
			} else if (n != null) if (t === "port") {
				if (n !== "") {
					let r = parseInt(n, 10);
					if (isNaN(r)) throw Error(`Invalid ${t}: ${n}`);
					e[t] = r;
				}
			} else e[t] = n;
			return e;
		}, {});
	}
	function o(e) {
		return a(r(e));
	}
	function s(e) {
		!s.warned && typeof process < "u" && process.emitWarning && (s.warned = !0, process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${e}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`));
	}
	n.exports = r, r.parse = r, r.toClientConfig = a, r.parseIntoClientConfig = o;
})), E = /* @__PURE__ */ a(((e, n) => {
	var r = t("dns"), i = _(), a = T().parse, o = function(e, t, n) {
		return t[e] ? t[e] : (n === void 0 ? n = process.env["PG" + e.toUpperCase()] : n === !1 || (n = process.env[n]), n || i[e]);
	}, s = function() {
		switch (process.env.PGSSLMODE) {
			case "disable": return !1;
			case "prefer":
			case "require":
			case "verify-ca":
			case "verify-full": return !0;
			case "no-verify": return { rejectUnauthorized: !1 };
		}
		return i.ssl;
	}, c = function(e) {
		return "'" + ("" + e).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
	}, l = function(e, t, n) {
		let r = t[n];
		r != null && e.push(n + "=" + c(r));
	};
	n.exports = class {
		constructor(e) {
			e = typeof e == "string" ? a(e) : e || {}, e.connectionString && (e = Object.assign({}, e, a(e.connectionString))), this.user = o("user", e), this.database = o("database", e), this.database === void 0 && (this.database = this.user), this.port = parseInt(o("port", e), 10), this.host = o("host", e), Object.defineProperty(this, "password", {
				configurable: !0,
				enumerable: !1,
				writable: !0,
				value: o("password", e)
			}), this.binary = o("binary", e), this.options = o("options", e), this.ssl = e.ssl === void 0 ? s() : e.ssl, typeof this.ssl == "string" && this.ssl === "true" && (this.ssl = !0), this.ssl === "no-verify" && (this.ssl = { rejectUnauthorized: !1 }), this.ssl && this.ssl.key && Object.defineProperty(this.ssl, "key", { enumerable: !1 }), this.client_encoding = o("client_encoding", e), this.replication = o("replication", e), this.isDomainSocket = !(this.host || "").indexOf("/"), this.application_name = o("application_name", e, "PGAPPNAME"), this.fallback_application_name = o("fallback_application_name", e, !1), this.statement_timeout = o("statement_timeout", e, !1), this.lock_timeout = o("lock_timeout", e, !1), this.idle_in_transaction_session_timeout = o("idle_in_transaction_session_timeout", e, !1), this.query_timeout = o("query_timeout", e, !1), e.connectionTimeoutMillis === void 0 ? this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0 : this.connect_timeout = Math.floor(e.connectionTimeoutMillis / 1e3), e.keepAlive === !1 ? this.keepalives = 0 : e.keepAlive === !0 && (this.keepalives = 1), typeof e.keepAliveInitialDelayMillis == "number" && (this.keepalives_idle = Math.floor(e.keepAliveInitialDelayMillis / 1e3));
		}
		getLibpqConnectionString(e) {
			let t = [];
			l(t, this, "user"), l(t, this, "password"), l(t, this, "port"), l(t, this, "application_name"), l(t, this, "fallback_application_name"), l(t, this, "connect_timeout"), l(t, this, "options");
			let n = typeof this.ssl == "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
			if (l(t, n, "sslmode"), l(t, n, "sslca"), l(t, n, "sslkey"), l(t, n, "sslcert"), l(t, n, "sslrootcert"), this.database && t.push("dbname=" + c(this.database)), this.replication && t.push("replication=" + c(this.replication)), this.host && t.push("host=" + c(this.host)), this.isDomainSocket) return e(null, t.join(" "));
			this.client_encoding && t.push("client_encoding=" + c(this.client_encoding)), r.lookup(this.host, function(n, r) {
				return n ? e(n, null) : (t.push("hostaddr=" + c(r)), e(null, t.join(" ")));
			});
		}
	};
})), D = /* @__PURE__ */ a(((e, t) => {
	var n = g(), r = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
	t.exports = class {
		constructor(e, t) {
			this.command = null, this.rowCount = null, this.oid = null, this.rows = [], this.fields = [], this._parsers = void 0, this._types = t, this.RowCtor = null, this.rowAsArray = e === "array", this.rowAsArray && (this.parseRow = this._parseRowAsArray), this._prebuiltEmptyResultObject = null;
		}
		addCommandComplete(e) {
			let t;
			t = e.text ? r.exec(e.text) : r.exec(e.command), t && (this.command = t[1], t[3] ? (this.oid = parseInt(t[2], 10), this.rowCount = parseInt(t[3], 10)) : t[2] && (this.rowCount = parseInt(t[2], 10)));
		}
		_parseRowAsArray(e) {
			let t = Array(e.length);
			for (let n = 0, r = e.length; n < r; n++) {
				let r = e[n];
				r === null ? t[n] = null : t[n] = this._parsers[n](r);
			}
			return t;
		}
		parseRow(e) {
			let t = { ...this._prebuiltEmptyResultObject };
			for (let n = 0, r = e.length; n < r; n++) {
				let r = e[n], i = this.fields[n].name;
				if (r !== null) {
					let e = this.fields[n].format === "binary" ? Buffer.from(r) : r;
					t[i] = this._parsers[n](e);
				} else t[i] = null;
			}
			return t;
		}
		addRow(e) {
			this.rows.push(e);
		}
		addFields(e) {
			this.fields = e, this.fields.length && (this._parsers = Array(e.length));
			let t = {};
			for (let r = 0; r < e.length; r++) {
				let i = e[r];
				t[i.name] = null, this._types ? this._parsers[r] = this._types.getTypeParser(i.dataTypeID, i.format || "text") : this._parsers[r] = n.getTypeParser(i.dataTypeID, i.format || "text");
			}
			this._prebuiltEmptyResultObject = { ...t };
		}
	};
})), O = /* @__PURE__ */ a(((e, n) => {
	var { EventEmitter: r } = t("events"), i = D(), a = v();
	n.exports = class extends r {
		constructor(e, t, n) {
			super(), e = a.normalizeQueryConfig(e, t, n), this.text = e.text, this.values = e.values, this.rows = e.rows, this.types = e.types, this.name = e.name, this.queryMode = e.queryMode, this.binary = e.binary, this.portal = e.portal || "", this.callback = e.callback, this._rowMode = e.rowMode, process.domain && e.callback && (this.callback = process.domain.bind(e.callback)), this._result = new i(this._rowMode, this.types), this._results = this._result, this._canceledDueToError = !1;
		}
		requiresPreparation() {
			return this.queryMode === "extended" || this.name || this.rows ? !0 : !this.text || !this.values ? !1 : this.values.length > 0;
		}
		_checkForMultirow() {
			this._result.command && (Array.isArray(this._results) || (this._results = [this._result]), this._result = new i(this._rowMode, this._result._types), this._results.push(this._result));
		}
		handleRowDescription(e) {
			this._checkForMultirow(), this._result.addFields(e.fields), this._accumulateRows = this.callback || !this.listeners("row").length;
		}
		handleDataRow(e) {
			let t;
			if (!this._canceledDueToError) {
				try {
					t = this._result.parseRow(e.fields);
				} catch (e) {
					this._canceledDueToError = e;
					return;
				}
				this.emit("row", t, this._result), this._accumulateRows && this._result.addRow(t);
			}
		}
		handleCommandComplete(e, t) {
			this._checkForMultirow(), this._result.addCommandComplete(e), this.rows && t.sync();
		}
		handleEmptyQuery(e) {
			this.rows && e.sync();
		}
		handleError(e, t) {
			if (this._canceledDueToError &&= (e = this._canceledDueToError, !1), this.callback) return this.callback(e);
			this.emit("error", e);
		}
		handleReadyForQuery(e) {
			if (this._canceledDueToError) return this.handleError(this._canceledDueToError, e);
			if (this.callback) try {
				this.callback(null, this._results);
			} catch (e) {
				process.nextTick(() => {
					throw e;
				});
			}
			this.emit("end", this._results);
		}
		submit(e) {
			if (typeof this.text != "string" && typeof this.name != "string") return /* @__PURE__ */ Error("A query must have either text or a name. Supplying neither is unsupported.");
			let t = e.parsedStatements[this.name];
			if (this.text && t && this.text !== t) return /* @__PURE__ */ Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
			if (this.values && !Array.isArray(this.values)) return /* @__PURE__ */ Error("Query values must be an array");
			if (this.requiresPreparation()) {
				e.stream.cork && e.stream.cork();
				try {
					this.prepare(e);
				} finally {
					e.stream.uncork && e.stream.uncork();
				}
			} else e.query(this.text);
			return null;
		}
		hasBeenParsed(e) {
			return this.name && e.parsedStatements[this.name];
		}
		handlePortalSuspended(e) {
			this._getRows(e, this.rows);
		}
		_getRows(e, t) {
			e.execute({
				portal: this.portal,
				rows: t
			}), t ? e.flush() : e.sync();
		}
		prepare(e) {
			this.hasBeenParsed(e) || e.parse({
				text: this.text,
				name: this.name,
				types: this.types
			});
			try {
				e.bind({
					portal: this.portal,
					statement: this.name,
					values: this.values,
					binary: this.binary,
					valueMapper: a.prepareValue
				});
			} catch (t) {
				this.handleError(t, e);
				return;
			}
			e.describe({
				type: "P",
				name: this.portal || ""
			}), this._getRows(e, this.rows);
		}
		handleCopyInResponse(e) {
			e.sendCopyFail("No source stream defined");
		}
		handleCopyData(e, t) {}
	};
})), k = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.NoticeMessage = e.DataRowMessage = e.CommandCompleteMessage = e.ReadyForQueryMessage = e.NotificationResponseMessage = e.BackendKeyDataMessage = e.AuthenticationMD5Password = e.ParameterStatusMessage = e.ParameterDescriptionMessage = e.RowDescriptionMessage = e.Field = e.CopyResponse = e.CopyDataMessage = e.DatabaseError = e.copyDone = e.emptyQuery = e.replicationStart = e.portalSuspended = e.noData = e.closeComplete = e.bindComplete = e.parseComplete = void 0, e.parseComplete = {
		name: "parseComplete",
		length: 5
	}, e.bindComplete = {
		name: "bindComplete",
		length: 5
	}, e.closeComplete = {
		name: "closeComplete",
		length: 5
	}, e.noData = {
		name: "noData",
		length: 5
	}, e.portalSuspended = {
		name: "portalSuspended",
		length: 5
	}, e.replicationStart = {
		name: "replicationStart",
		length: 4
	}, e.emptyQuery = {
		name: "emptyQuery",
		length: 4
	}, e.copyDone = {
		name: "copyDone",
		length: 4
	}, e.DatabaseError = class extends Error {
		constructor(e, t, n) {
			super(e), this.length = t, this.name = n;
		}
	}, e.CopyDataMessage = class {
		constructor(e, t) {
			this.length = e, this.chunk = t, this.name = "copyData";
		}
	}, e.CopyResponse = class {
		constructor(e, t, n, r) {
			this.length = e, this.name = t, this.binary = n, this.columnTypes = Array(r);
		}
	}, e.Field = class {
		constructor(e, t, n, r, i, a, o) {
			this.name = e, this.tableID = t, this.columnID = n, this.dataTypeID = r, this.dataTypeSize = i, this.dataTypeModifier = a, this.format = o;
		}
	}, e.RowDescriptionMessage = class {
		constructor(e, t) {
			this.length = e, this.fieldCount = t, this.name = "rowDescription", this.fields = Array(this.fieldCount);
		}
	}, e.ParameterDescriptionMessage = class {
		constructor(e, t) {
			this.length = e, this.parameterCount = t, this.name = "parameterDescription", this.dataTypeIDs = Array(this.parameterCount);
		}
	}, e.ParameterStatusMessage = class {
		constructor(e, t, n) {
			this.length = e, this.parameterName = t, this.parameterValue = n, this.name = "parameterStatus";
		}
	}, e.AuthenticationMD5Password = class {
		constructor(e, t) {
			this.length = e, this.salt = t, this.name = "authenticationMD5Password";
		}
	}, e.BackendKeyDataMessage = class {
		constructor(e, t, n) {
			this.length = e, this.processID = t, this.secretKey = n, this.name = "backendKeyData";
		}
	}, e.NotificationResponseMessage = class {
		constructor(e, t, n, r) {
			this.length = e, this.processId = t, this.channel = n, this.payload = r, this.name = "notification";
		}
	}, e.ReadyForQueryMessage = class {
		constructor(e, t) {
			this.length = e, this.status = t, this.name = "readyForQuery";
		}
	}, e.CommandCompleteMessage = class {
		constructor(e, t) {
			this.length = e, this.text = t, this.name = "commandComplete";
		}
	}, e.DataRowMessage = class {
		constructor(e, t) {
			this.length = e, this.fields = t, this.name = "dataRow", this.fieldCount = t.length;
		}
	}, e.NoticeMessage = class {
		constructor(e, t) {
			this.length = e, this.message = t, this.name = "notice";
		}
	};
})), A = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Writer = void 0, e.Writer = class {
		constructor(e = 256) {
			this.size = e, this.offset = 5, this.headerPosition = 0, this.buffer = Buffer.allocUnsafe(e);
		}
		ensure(e) {
			if (this.buffer.length - this.offset < e) {
				let t = this.buffer, n = t.length + (t.length >> 1) + e;
				this.buffer = Buffer.allocUnsafe(n), t.copy(this.buffer);
			}
		}
		addInt32(e) {
			return this.ensure(4), this.buffer[this.offset++] = e >>> 24 & 255, this.buffer[this.offset++] = e >>> 16 & 255, this.buffer[this.offset++] = e >>> 8 & 255, this.buffer[this.offset++] = e >>> 0 & 255, this;
		}
		addInt16(e) {
			return this.ensure(2), this.buffer[this.offset++] = e >>> 8 & 255, this.buffer[this.offset++] = e >>> 0 & 255, this;
		}
		addCString(e) {
			if (!e) this.ensure(1);
			else {
				let t = Buffer.byteLength(e);
				this.ensure(t + 1), this.buffer.write(e, this.offset, "utf-8"), this.offset += t;
			}
			return this.buffer[this.offset++] = 0, this;
		}
		addString(e = "") {
			let t = Buffer.byteLength(e);
			return this.ensure(t), this.buffer.write(e, this.offset), this.offset += t, this;
		}
		add(e) {
			return this.ensure(e.length), e.copy(this.buffer, this.offset), this.offset += e.length, this;
		}
		join(e) {
			if (e) {
				this.buffer[this.headerPosition] = e;
				let t = this.offset - (this.headerPosition + 1);
				this.buffer.writeInt32BE(t, this.headerPosition + 1);
			}
			return this.buffer.slice(e ? 0 : 5, this.offset);
		}
		flush(e) {
			let t = this.join(e);
			return this.offset = 5, this.headerPosition = 0, this.buffer = Buffer.allocUnsafe(this.size), t;
		}
	};
})), j = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.serialize = void 0;
	var t = A(), n = new t.Writer(), r = (e) => {
		n.addInt16(3).addInt16(0);
		for (let t of Object.keys(e)) n.addCString(t).addCString(e[t]);
		n.addCString("client_encoding").addCString("UTF8");
		let r = n.addCString("").flush(), i = r.length + 4;
		return new t.Writer().addInt32(i).add(r).flush();
	}, i = () => {
		let e = Buffer.allocUnsafe(8);
		return e.writeInt32BE(8, 0), e.writeInt32BE(80877103, 4), e;
	}, a = (e) => n.addCString(e).flush(112), o = function(e, t) {
		return n.addCString(e).addInt32(Buffer.byteLength(t)).addString(t), n.flush(112);
	}, s = function(e) {
		return n.addString(e).flush(112);
	}, c = (e) => n.addCString(e).flush(81), l = [], u = (e) => {
		let t = e.name || "";
		t.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", t, t.length), console.error("This can cause conflicts and silent errors executing queries"));
		let r = e.types || l, i = r.length, a = n.addCString(t).addCString(e.text).addInt16(i);
		for (let e = 0; e < i; e++) a.addInt32(r[e]);
		return n.flush(80);
	}, d = new t.Writer(), f = function(e, t) {
		for (let r = 0; r < e.length; r++) {
			let i = t ? t(e[r], r) : e[r];
			i == null ? (n.addInt16(0), d.addInt32(-1)) : i instanceof Buffer ? (n.addInt16(1), d.addInt32(i.length), d.add(i)) : (n.addInt16(0), d.addInt32(Buffer.byteLength(i)), d.addString(i));
		}
	}, p = (e = {}) => {
		let t = e.portal || "", r = e.statement || "", i = e.binary || !1, a = e.values || l, o = a.length;
		return n.addCString(t).addCString(r), n.addInt16(o), f(a, e.valueMapper), n.addInt16(o), n.add(d.flush()), n.addInt16(1), n.addInt16(i ? 1 : 0), n.flush(66);
	}, m = Buffer.from([
		69,
		0,
		0,
		0,
		9,
		0,
		0,
		0,
		0,
		0
	]), h = (e) => {
		if (!e || !e.portal && !e.rows) return m;
		let t = e.portal || "", n = e.rows || 0, r = Buffer.byteLength(t), i = 4 + r + 1 + 4, a = Buffer.allocUnsafe(1 + i);
		return a[0] = 69, a.writeInt32BE(i, 1), a.write(t, 5, "utf-8"), a[r + 5] = 0, a.writeUInt32BE(n, a.length - 4), a;
	}, g = (e, t) => {
		let n = Buffer.allocUnsafe(16);
		return n.writeInt32BE(16, 0), n.writeInt16BE(1234, 4), n.writeInt16BE(5678, 6), n.writeInt32BE(e, 8), n.writeInt32BE(t, 12), n;
	}, _ = (e, t) => {
		let n = 4 + Buffer.byteLength(t) + 1, r = Buffer.allocUnsafe(1 + n);
		return r[0] = e, r.writeInt32BE(n, 1), r.write(t, 5, "utf-8"), r[n] = 0, r;
	}, v = n.addCString("P").flush(68), y = n.addCString("S").flush(68), b = (e) => e.name ? _(68, `${e.type}${e.name || ""}`) : e.type === "P" ? v : y, x = (e) => _(67, `${e.type}${e.name || ""}`), S = (e) => n.add(e).flush(100), C = (e) => _(102, e), w = (e) => Buffer.from([
		e,
		0,
		0,
		0,
		4
	]), T = w(72), E = w(83), D = w(88), O = w(99);
	e.serialize = {
		startup: r,
		password: a,
		requestSsl: i,
		sendSASLInitialResponseMessage: o,
		sendSCRAMClientFinalMessage: s,
		query: c,
		parse: u,
		bind: p,
		execute: h,
		describe: b,
		close: x,
		flush: () => T,
		sync: () => E,
		end: () => D,
		copyData: S,
		copyDone: () => O,
		copyFail: C,
		cancel: g
	};
})), M = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.BufferReader = void 0, e.BufferReader = class {
		constructor(e = 0) {
			this.offset = e, this.buffer = Buffer.allocUnsafe(0), this.encoding = "utf-8";
		}
		setBuffer(e, t) {
			this.offset = e, this.buffer = t;
		}
		int16() {
			let e = this.buffer.readInt16BE(this.offset);
			return this.offset += 2, e;
		}
		byte() {
			let e = this.buffer[this.offset];
			return this.offset++, e;
		}
		int32() {
			let e = this.buffer.readInt32BE(this.offset);
			return this.offset += 4, e;
		}
		uint32() {
			let e = this.buffer.readUInt32BE(this.offset);
			return this.offset += 4, e;
		}
		string(e) {
			let t = this.buffer.toString(this.encoding, this.offset, this.offset + e);
			return this.offset += e, t;
		}
		cstring() {
			let e = this.offset, t = e;
			for (; this.buffer[t++] !== 0;);
			return this.offset = t, this.buffer.toString(this.encoding, e, t - 1);
		}
		bytes(e) {
			let t = this.buffer.slice(this.offset, this.offset + e);
			return this.offset += e, t;
		}
	};
})), N = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Parser = void 0;
	var t = k(), n = M(), r = 1, i = r + 4, a = -1, o = Buffer.allocUnsafe(0);
	e.Parser = class {
		constructor(e) {
			if (this.buffer = o, this.bufferLength = 0, this.bufferOffset = 0, this.reader = new n.BufferReader(), e?.mode === "binary") throw Error("Binary mode not supported yet");
			this.mode = e?.mode || "text";
		}
		parse(e, t) {
			this.mergeBuffer(e);
			let n = this.bufferOffset + this.bufferLength, a = this.bufferOffset;
			for (; a + i <= n;) {
				let e = this.buffer[a], o = this.buffer.readUInt32BE(a + r), s = r + o;
				if (s + a <= n) t(this.handlePacket(a + i, e, o, this.buffer)), a += s;
				else break;
			}
			a === n ? (this.buffer = o, this.bufferLength = 0, this.bufferOffset = 0) : (this.bufferLength = n - a, this.bufferOffset = a);
		}
		mergeBuffer(e) {
			if (this.bufferLength > 0) {
				let t = this.bufferLength + e.byteLength;
				if (t + this.bufferOffset > this.buffer.byteLength) {
					let e;
					if (t <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) e = this.buffer;
					else {
						let n = this.buffer.byteLength * 2;
						for (; t >= n;) n *= 2;
						e = Buffer.allocUnsafe(n);
					}
					this.buffer.copy(e, 0, this.bufferOffset, this.bufferOffset + this.bufferLength), this.buffer = e, this.bufferOffset = 0;
				}
				e.copy(this.buffer, this.bufferOffset + this.bufferLength), this.bufferLength = t;
			} else this.buffer = e, this.bufferOffset = 0, this.bufferLength = e.byteLength;
		}
		handlePacket(e, n, r, i) {
			let { reader: a } = this;
			a.setBuffer(e, i);
			let f;
			switch (n) {
				case 50:
					f = t.bindComplete;
					break;
				case 49:
					f = t.parseComplete;
					break;
				case 51:
					f = t.closeComplete;
					break;
				case 110:
					f = t.noData;
					break;
				case 115:
					f = t.portalSuspended;
					break;
				case 99:
					f = t.copyDone;
					break;
				case 87:
					f = t.replicationStart;
					break;
				case 73:
					f = t.emptyQuery;
					break;
				case 68:
					f = _(a);
					break;
				case 67:
					f = c(a);
					break;
				case 90:
					f = s(a);
					break;
				case 65:
					f = p(a);
					break;
				case 82:
					f = b(a, r);
					break;
				case 83:
					f = v(a);
					break;
				case 75:
					f = y(a);
					break;
				case 69:
					f = x(a, "error");
					break;
				case 78:
					f = x(a, "notice");
					break;
				case 84:
					f = m(a);
					break;
				case 116:
					f = g(a);
					break;
				case 71:
					f = u(a);
					break;
				case 72:
					f = d(a);
					break;
				case 100:
					f = l(a, r);
					break;
				default: return new t.DatabaseError("received invalid response: " + n.toString(16), r, "error");
			}
			return a.setBuffer(0, o), f.length = r, f;
		}
	};
	var s = (e) => {
		let n = e.string(1);
		return new t.ReadyForQueryMessage(a, n);
	}, c = (e) => {
		let n = e.cstring();
		return new t.CommandCompleteMessage(a, n);
	}, l = (e, n) => {
		let r = e.bytes(n - 4);
		return new t.CopyDataMessage(a, r);
	}, u = (e) => f(e, "copyInResponse"), d = (e) => f(e, "copyOutResponse"), f = (e, n) => {
		let r = e.byte() !== 0, i = e.int16(), o = new t.CopyResponse(a, n, r, i);
		for (let t = 0; t < i; t++) o.columnTypes[t] = e.int16();
		return o;
	}, p = (e) => {
		let n = e.int32(), r = e.cstring(), i = e.cstring();
		return new t.NotificationResponseMessage(a, n, r, i);
	}, m = (e) => {
		let n = e.int16(), r = new t.RowDescriptionMessage(a, n);
		for (let t = 0; t < n; t++) r.fields[t] = h(e);
		return r;
	}, h = (e) => {
		let n = e.cstring(), r = e.uint32(), i = e.int16(), a = e.uint32(), o = e.int16(), s = e.int32(), c = e.int16() === 0 ? "text" : "binary";
		return new t.Field(n, r, i, a, o, s, c);
	}, g = (e) => {
		let n = e.int16(), r = new t.ParameterDescriptionMessage(a, n);
		for (let t = 0; t < n; t++) r.dataTypeIDs[t] = e.int32();
		return r;
	}, _ = (e) => {
		let n = e.int16(), r = Array(n);
		for (let t = 0; t < n; t++) {
			let n = e.int32();
			r[t] = n === -1 ? null : e.string(n);
		}
		return new t.DataRowMessage(a, r);
	}, v = (e) => {
		let n = e.cstring(), r = e.cstring();
		return new t.ParameterStatusMessage(a, n, r);
	}, y = (e) => {
		let n = e.int32(), r = e.int32();
		return new t.BackendKeyDataMessage(a, n, r);
	}, b = (e, n) => {
		let r = e.int32(), i = {
			name: "authenticationOk",
			length: n
		};
		switch (r) {
			case 0: break;
			case 3:
				i.length === 8 && (i.name = "authenticationCleartextPassword");
				break;
			case 5:
				if (i.length === 12) {
					i.name = "authenticationMD5Password";
					let n = e.bytes(4);
					return new t.AuthenticationMD5Password(a, n);
				}
				break;
			case 10:
				{
					i.name = "authenticationSASL", i.mechanisms = [];
					let t;
					do
						t = e.cstring(), t && i.mechanisms.push(t);
					while (t);
				}
				break;
			case 11:
				i.name = "authenticationSASLContinue", i.data = e.string(n - 8);
				break;
			case 12:
				i.name = "authenticationSASLFinal", i.data = e.string(n - 8);
				break;
			default: throw Error("Unknown authenticationOk message type " + r);
		}
		return i;
	}, x = (e, n) => {
		let r = {}, i = e.string(1);
		for (; i !== "\0";) r[i] = e.cstring(), i = e.string(1);
		let o = r.M, s = n === "notice" ? new t.NoticeMessage(a, o) : new t.DatabaseError(o, a, n);
		return s.severity = r.S, s.code = r.C, s.detail = r.D, s.hint = r.H, s.position = r.P, s.internalPosition = r.p, s.internalQuery = r.q, s.where = r.W, s.schema = r.s, s.table = r.t, s.column = r.c, s.dataType = r.d, s.constraint = r.n, s.file = r.F, s.line = r.L, s.routine = r.R, s;
	};
})), P = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.DatabaseError = e.serialize = e.parse = void 0;
	var t = k();
	Object.defineProperty(e, "DatabaseError", {
		enumerable: !0,
		get: function() {
			return t.DatabaseError;
		}
	});
	var n = j();
	Object.defineProperty(e, "serialize", {
		enumerable: !0,
		get: function() {
			return n.serialize;
		}
	});
	var r = N();
	function i(e, t) {
		let n = new r.Parser();
		return e.on("data", (e) => n.parse(e, t)), new Promise((t) => e.on("end", () => t()));
	}
	e.parse = i;
})), F = /* @__PURE__ */ a(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.default = {};
})), I = /* @__PURE__ */ a(((e, n) => {
	var { getStream: r, getSecureStream: i } = c();
	n.exports = {
		getStream: r,
		getSecureStream: i
	};
	function a() {
		function e(e) {
			return new (t("net")).Socket();
		}
		function n(e) {
			return t("tls").connect(e);
		}
		return {
			getStream: e,
			getSecureStream: n
		};
	}
	function o() {
		function e(e) {
			let { CloudflareSocket: t } = F();
			return new t(e);
		}
		function t(e) {
			return e.socket.startTls(e), e.socket;
		}
		return {
			getStream: e,
			getSecureStream: t
		};
	}
	function s() {
		if (typeof navigator == "object" && navigator !== null && typeof navigator.userAgent == "string") return navigator.userAgent === "Cloudflare-Workers";
		if (typeof Response == "function") {
			let e = new Response(null, { cf: { thing: !0 } });
			if (typeof e.cf == "object" && e.cf !== null && e.cf.thing) return !0;
		}
		return !1;
	}
	function c() {
		return s() ? o() : a();
	}
})), L = /* @__PURE__ */ a(((e, n) => {
	var r = t("events").EventEmitter, { parse: i, serialize: a } = P(), { getStream: o, getSecureStream: s } = I(), c = a.flush(), l = a.sync(), u = a.end();
	n.exports = class extends r {
		constructor(e) {
			super(), e ||= {}, this.stream = e.stream || o(e.ssl), typeof this.stream == "function" && (this.stream = this.stream(e)), this._keepAlive = e.keepAlive, this._keepAliveInitialDelayMillis = e.keepAliveInitialDelayMillis, this.parsedStatements = {}, this.ssl = e.ssl || !1, this._ending = !1, this._emitMessage = !1;
			let t = this;
			this.on("newListener", function(e) {
				e === "message" && (t._emitMessage = !0);
			});
		}
		connect(e, n) {
			let r = this;
			this._connecting = !0, this.stream.setNoDelay(!0), this.stream.connect(e, n), this.stream.once("connect", function() {
				r._keepAlive && r.stream.setKeepAlive(!0, r._keepAliveInitialDelayMillis), r.emit("connect");
			});
			let i = function(e) {
				r._ending && (e.code === "ECONNRESET" || e.code === "EPIPE") || r.emit("error", e);
			};
			if (this.stream.on("error", i), this.stream.on("close", function() {
				r.emit("end");
			}), !this.ssl) return this.attachListeners(this.stream);
			this.stream.once("data", function(e) {
				switch (e.toString("utf8")) {
					case "S": break;
					case "N": return r.stream.end(), r.emit("error", /* @__PURE__ */ Error("The server does not support SSL connections"));
					default: return r.stream.end(), r.emit("error", /* @__PURE__ */ Error("There was an error establishing an SSL connection"));
				}
				let a = { socket: r.stream };
				r.ssl !== !0 && (Object.assign(a, r.ssl), "key" in r.ssl && (a.key = r.ssl.key));
				let o = t("net");
				o.isIP && o.isIP(n) === 0 && (a.servername = n);
				try {
					r.stream = s(a);
				} catch (e) {
					return r.emit("error", e);
				}
				r.attachListeners(r.stream), r.stream.on("error", i), r.emit("sslconnect");
			});
		}
		attachListeners(e) {
			i(e, (e) => {
				let t = e.name === "error" ? "errorMessage" : e.name;
				this._emitMessage && this.emit("message", e), this.emit(t, e);
			});
		}
		requestSsl() {
			this.stream.write(a.requestSsl());
		}
		startup(e) {
			this.stream.write(a.startup(e));
		}
		cancel(e, t) {
			this._send(a.cancel(e, t));
		}
		password(e) {
			this._send(a.password(e));
		}
		sendSASLInitialResponseMessage(e, t) {
			this._send(a.sendSASLInitialResponseMessage(e, t));
		}
		sendSCRAMClientFinalMessage(e) {
			this._send(a.sendSCRAMClientFinalMessage(e));
		}
		_send(e) {
			return this.stream.writable ? this.stream.write(e) : !1;
		}
		query(e) {
			this._send(a.query(e));
		}
		parse(e) {
			this._send(a.parse(e));
		}
		bind(e) {
			this._send(a.bind(e));
		}
		execute(e) {
			this._send(a.execute(e));
		}
		flush() {
			this.stream.writable && this.stream.write(c);
		}
		sync() {
			this._ending = !0, this._send(l);
		}
		ref() {
			this.stream.ref();
		}
		unref() {
			this.stream.unref();
		}
		end() {
			if (this._ending = !0, !this._connecting || !this.stream.writable) {
				this.stream.end();
				return;
			}
			return this.stream.write(u, () => {
				this.stream.end();
			});
		}
		close(e) {
			this._send(a.close(e));
		}
		describe(e) {
			this._send(a.describe(e));
		}
		sendCopyFromChunk(e) {
			this._send(a.copyData(e));
		}
		endCopyFrom() {
			this._send(a.copyDone());
		}
		sendCopyFail(e) {
			this._send(a.copyFail(e));
		}
	};
})), R = /* @__PURE__ */ a(((e, n) => {
	var { Transform: r } = t("stream"), { StringDecoder: i } = t("string_decoder"), a = Symbol("last"), o = Symbol("decoder");
	function s(e, t, n) {
		let r;
		if (this.overflow) {
			if (r = this[o].write(e).split(this.matcher), r.length === 1) return n();
			r.shift(), this.overflow = !1;
		} else this[a] += this[o].write(e), r = this[a].split(this.matcher);
		this[a] = r.pop();
		for (let e = 0; e < r.length; e++) try {
			l(this, this.mapper(r[e]));
		} catch (e) {
			return n(e);
		}
		if (this.overflow = this[a].length > this.maxLength, this.overflow && !this.skipOverflow) {
			n(/* @__PURE__ */ Error("maximum buffer reached"));
			return;
		}
		n();
	}
	function c(e) {
		if (this[a] += this[o].end(), this[a]) try {
			l(this, this.mapper(this[a]));
		} catch (t) {
			return e(t);
		}
		e();
	}
	function l(e, t) {
		t !== void 0 && e.push(t);
	}
	function u(e) {
		return e;
	}
	function d(e, t, n) {
		switch (e ||= /\r?\n/, t ||= u, n ||= {}, arguments.length) {
			case 1:
				typeof e == "function" ? (t = e, e = /\r?\n/) : typeof e == "object" && !(e instanceof RegExp) && !e[Symbol.split] && (n = e, e = /\r?\n/);
				break;
			case 2: typeof e == "function" ? (n = t, t = e, e = /\r?\n/) : typeof t == "object" && (n = t, t = u);
		}
		n = Object.assign({}, n), n.autoDestroy = !0, n.transform = s, n.flush = c, n.readableObjectMode = !0;
		let l = new r(n);
		return l[a] = "", l[o] = new i("utf8"), l.matcher = e, l.mapper = t, l.maxLength = n.maxLength, l.skipOverflow = n.skipOverflow || !1, l.overflow = !1, l._destroy = function(e, t) {
			this._writableState.errorEmitted = !1, t(e);
		}, l;
	}
	n.exports = d;
})), z = /* @__PURE__ */ a(((e, n) => {
	var r = t("path"), i = t("stream").Stream, a = R(), o = t("util"), s = 5432, c = process.platform === "win32", l = process.stderr, u = 56, d = 7, f = 61440, p = 32768;
	function m(e) {
		return (e & f) == p;
	}
	var h = [
		"host",
		"port",
		"database",
		"user",
		"password"
	], g = h.length, _ = h[g - 1];
	function v() {
		if (l instanceof i && !0 === l.writable) {
			var e = Array.prototype.slice.call(arguments).concat("\n");
			l.write(o.format.apply(o, e));
		}
	}
	Object.defineProperty(n.exports, "isWin", {
		get: function() {
			return c;
		},
		set: function(e) {
			c = e;
		}
	}), n.exports.warnTo = function(e) {
		var t = l;
		return l = e, t;
	}, n.exports.getFileName = function(e) {
		var t = e || process.env;
		return t.PGPASSFILE || (c ? r.join(t.APPDATA || "./", "postgresql", "pgpass.conf") : r.join(t.HOME || "./", ".pgpass"));
	}, n.exports.usePgPass = function(e, t) {
		return Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD") ? !1 : c ? !0 : (t ||= "<unkn>", m(e.mode) ? e.mode & (u | d) ? (v("WARNING: password file \"%s\" has group or world access; permissions should be u=rw (0600) or less", t), !1) : !0 : (v("WARNING: password file \"%s\" is not a plain file", t), !1));
	};
	var y = n.exports.match = function(e, t) {
		return h.slice(0, -1).reduce(function(n, r, i) {
			return i == 1 && Number(e[r] || s) === Number(t[r]) ? n && !0 : n && (t[r] === "*" || t[r] === e[r]);
		}, !0);
	};
	n.exports.getPassword = function(e, t, n) {
		var r, i = t.pipe(a());
		function o(t) {
			var n = b(t);
			n && x(n) && y(e, n) && (r = n[_], i.end());
		}
		var s = function() {
			t.destroy(), n(r);
		}, c = function(e) {
			t.destroy(), v("WARNING: error on reading file: %s", e), n(void 0);
		};
		t.on("error", c), i.on("data", o).on("end", s).on("error", c);
	};
	var b = n.exports.parseLine = function(e) {
		if (e.length < 11 || e.match(/^\s+#/)) return null;
		for (var t = "", n = "", r = 0, i = 0, a = {}, o = !1, s = function(t, n, r) {
			var i = e.substring(n, r);
			Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE") || (i = i.replace(/\\([:\\])/g, "$1")), a[h[t]] = i;
		}, c = 0; c < e.length - 1; c += 1) {
			if (t = e.charAt(c + 1), n = e.charAt(c), o = r == g - 1, o) {
				s(r, i);
				break;
			}
			c >= 0 && t == ":" && n !== "\\" && (s(r, i, c + 1), i = c + 2, r += 1);
		}
		return a = Object.keys(a).length === g ? a : null, a;
	}, x = n.exports.isValidEntry = function(e) {
		for (var t = {
			0: function(e) {
				return e.length > 0;
			},
			1: function(e) {
				return e === "*" ? !0 : (e = Number(e), isFinite(e) && e > 0 && e < 9007199254740992 && Math.floor(e) === e);
			},
			2: function(e) {
				return e.length > 0;
			},
			3: function(e) {
				return e.length > 0;
			},
			4: function(e) {
				return e.length > 0;
			}
		}, n = 0; n < h.length; n += 1) {
			var r = t[n];
			if (!r(e[h[n]] || "")) return !1;
		}
		return !0;
	};
})), B = /* @__PURE__ */ a(((e, n) => {
	t("path");
	var r = t("fs"), i = z();
	n.exports = function(e, t) {
		var n = i.getFileName();
		r.stat(n, function(a, o) {
			if (a || !i.usePgPass(o, n)) return t(void 0);
			var s = r.createReadStream(n);
			i.getPassword(e, s, t);
		});
	}, n.exports.warnTo = i.warnTo;
})), V = /* @__PURE__ */ a(((e, n) => {
	var r = t("events").EventEmitter, i = v(), a = t("util"), o = C(), s = w(), c = E(), l = O(), u = _(), d = L(), f = x(), p = a.deprecate(() => {}, "Client.activeQuery is deprecated and will be removed in pg@9.0"), m = a.deprecate(() => {}, "Client.queryQueue is deprecated and will be removed in pg@9.0."), h = a.deprecate(() => {}, "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code."), g = a.deprecate(() => {}, "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0."), y = a.deprecate(() => {}, "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."), b = class extends r {
		constructor(e) {
			super(), this.connectionParameters = new c(e), this.user = this.connectionParameters.user, this.database = this.connectionParameters.database, this.port = this.connectionParameters.port, this.host = this.connectionParameters.host, Object.defineProperty(this, "password", {
				configurable: !0,
				enumerable: !1,
				writable: !0,
				value: this.connectionParameters.password
			}), this.replication = this.connectionParameters.replication;
			let t = e || {};
			t.Promise && g(), this._Promise = t.Promise || global.Promise, this._types = new s(t.types), this._ending = !1, this._ended = !1, this._connecting = !1, this._connected = !1, this._connectionError = !1, this._queryable = !0, this._activeQuery = null, this.enableChannelBinding = !!t.enableChannelBinding, this.connection = t.connection || new d({
				stream: t.stream,
				ssl: this.connectionParameters.ssl,
				keepAlive: t.keepAlive || !1,
				keepAliveInitialDelayMillis: t.keepAliveInitialDelayMillis || 0,
				encoding: this.connectionParameters.client_encoding || "utf8"
			}), this._queryQueue = [], this.binary = t.binary || u.binary, this.processID = null, this.secretKey = null, this.ssl = this.connectionParameters.ssl || !1, this.ssl && this.ssl.key && Object.defineProperty(this.ssl, "key", { enumerable: !1 }), this._connectionTimeoutMillis = t.connectionTimeoutMillis || 0;
		}
		get activeQuery() {
			return p(), this._activeQuery;
		}
		set activeQuery(e) {
			p(), this._activeQuery = e;
		}
		_getActiveQuery() {
			return this._activeQuery;
		}
		_errorAllQueries(e) {
			let t = (t) => {
				process.nextTick(() => {
					t.handleError(e, this.connection);
				});
			}, n = this._getActiveQuery();
			n && (t(n), this._activeQuery = null), this._queryQueue.forEach(t), this._queryQueue.length = 0;
		}
		_connect(e) {
			let t = this, n = this.connection;
			if (this._connectionCallback = e, this._connecting || this._connected) {
				let t = /* @__PURE__ */ Error("Client has already been connected. You cannot reuse a client.");
				process.nextTick(() => {
					e(t);
				});
				return;
			}
			this._connecting = !0, this._connectionTimeoutMillis > 0 && (this.connectionTimeoutHandle = setTimeout(() => {
				n._ending = !0, n.stream.destroy(/* @__PURE__ */ Error("timeout expired"));
			}, this._connectionTimeoutMillis), this.connectionTimeoutHandle.unref && this.connectionTimeoutHandle.unref()), this.host && this.host.indexOf("/") === 0 ? n.connect(this.host + "/.s.PGSQL." + this.port) : n.connect(this.port, this.host), n.on("connect", function() {
				t.ssl ? n.requestSsl() : n.startup(t.getStartupConf());
			}), n.on("sslconnect", function() {
				n.startup(t.getStartupConf());
			}), this._attachListeners(n), n.once("end", () => {
				let e = this._ending ? /* @__PURE__ */ Error("Connection terminated") : /* @__PURE__ */ Error("Connection terminated unexpectedly");
				clearTimeout(this.connectionTimeoutHandle), this._errorAllQueries(e), this._ended = !0, this._ending || (this._connecting && !this._connectionError ? this._connectionCallback ? this._connectionCallback(e) : this._handleErrorEvent(e) : this._connectionError || this._handleErrorEvent(e)), process.nextTick(() => {
					this.emit("end");
				});
			});
		}
		connect(e) {
			if (e) {
				this._connect(e);
				return;
			}
			return new this._Promise((e, t) => {
				this._connect((n) => {
					n ? t(n) : e(this);
				});
			});
		}
		_attachListeners(e) {
			e.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this)), e.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this)), e.on("authenticationSASL", this._handleAuthSASL.bind(this)), e.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this)), e.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this)), e.on("backendKeyData", this._handleBackendKeyData.bind(this)), e.on("error", this._handleErrorEvent.bind(this)), e.on("errorMessage", this._handleErrorMessage.bind(this)), e.on("readyForQuery", this._handleReadyForQuery.bind(this)), e.on("notice", this._handleNotice.bind(this)), e.on("rowDescription", this._handleRowDescription.bind(this)), e.on("dataRow", this._handleDataRow.bind(this)), e.on("portalSuspended", this._handlePortalSuspended.bind(this)), e.on("emptyQuery", this._handleEmptyQuery.bind(this)), e.on("commandComplete", this._handleCommandComplete.bind(this)), e.on("parseComplete", this._handleParseComplete.bind(this)), e.on("copyInResponse", this._handleCopyInResponse.bind(this)), e.on("copyData", this._handleCopyData.bind(this)), e.on("notification", this._handleNotification.bind(this));
		}
		_getPassword(e) {
			let t = this.connection;
			if (typeof this.password == "function") this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((n) => {
				if (n !== void 0) {
					if (typeof n != "string") {
						t.emit("error", /* @__PURE__ */ TypeError("Password must be a string"));
						return;
					}
					this.connectionParameters.password = this.password = n;
				} else this.connectionParameters.password = this.password = null;
				e();
			}).catch((e) => {
				t.emit("error", e);
			});
			else if (this.password !== null) e();
			else try {
				B()(this.connectionParameters, (t) => {
					t !== void 0 && (h(), this.connectionParameters.password = this.password = t), e();
				});
			} catch (e) {
				this.emit("error", e);
			}
		}
		_handleAuthCleartextPassword(e) {
			this._getPassword(() => {
				this.connection.password(this.password);
			});
		}
		_handleAuthMD5Password(e) {
			this._getPassword(async () => {
				try {
					let t = await f.postgresMd5PasswordHash(this.user, this.password, e.salt);
					this.connection.password(t);
				} catch (e) {
					this.emit("error", e);
				}
			});
		}
		_handleAuthSASL(e) {
			this._getPassword(() => {
				try {
					this.saslSession = o.startSession(e.mechanisms, this.enableChannelBinding && this.connection.stream), this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
				} catch (e) {
					this.connection.emit("error", e);
				}
			});
		}
		async _handleAuthSASLContinue(e) {
			try {
				await o.continueSession(this.saslSession, this.password, e.data, this.enableChannelBinding && this.connection.stream), this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
			} catch (e) {
				this.connection.emit("error", e);
			}
		}
		_handleAuthSASLFinal(e) {
			try {
				o.finalizeSession(this.saslSession, e.data), this.saslSession = null;
			} catch (e) {
				this.connection.emit("error", e);
			}
		}
		_handleBackendKeyData(e) {
			this.processID = e.processID, this.secretKey = e.secretKey;
		}
		_handleReadyForQuery(e) {
			this._connecting && (this._connecting = !1, this._connected = !0, clearTimeout(this.connectionTimeoutHandle), this._connectionCallback &&= (this._connectionCallback(null, this), null), this.emit("connect"));
			let t = this._getActiveQuery();
			this._activeQuery = null, this.readyForQuery = !0, t && t.handleReadyForQuery(this.connection), this._pulseQueryQueue();
		}
		_handleErrorWhileConnecting(e) {
			if (!this._connectionError) {
				if (this._connectionError = !0, clearTimeout(this.connectionTimeoutHandle), this._connectionCallback) return this._connectionCallback(e);
				this.emit("error", e);
			}
		}
		_handleErrorEvent(e) {
			if (this._connecting) return this._handleErrorWhileConnecting(e);
			this._queryable = !1, this._errorAllQueries(e), this.emit("error", e);
		}
		_handleErrorMessage(e) {
			if (this._connecting) return this._handleErrorWhileConnecting(e);
			let t = this._getActiveQuery();
			if (!t) {
				this._handleErrorEvent(e);
				return;
			}
			this._activeQuery = null, t.handleError(e, this.connection);
		}
		_handleRowDescription(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected rowDescription message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handleRowDescription(e);
		}
		_handleDataRow(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected dataRow message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handleDataRow(e);
		}
		_handlePortalSuspended(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected portalSuspended message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handlePortalSuspended(this.connection);
		}
		_handleEmptyQuery(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected emptyQuery message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handleEmptyQuery(this.connection);
		}
		_handleCommandComplete(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected commandComplete message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handleCommandComplete(e, this.connection);
		}
		_handleParseComplete() {
			let e = this._getActiveQuery();
			if (e == null) {
				let e = /* @__PURE__ */ Error("Received unexpected parseComplete message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			e.name && (this.connection.parsedStatements[e.name] = e.text);
		}
		_handleCopyInResponse(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected copyInResponse message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handleCopyInResponse(this.connection);
		}
		_handleCopyData(e) {
			let t = this._getActiveQuery();
			if (t == null) {
				let e = /* @__PURE__ */ Error("Received unexpected copyData message from backend.");
				this._handleErrorEvent(e);
				return;
			}
			t.handleCopyData(e, this.connection);
		}
		_handleNotification(e) {
			this.emit("notification", e);
		}
		_handleNotice(e) {
			this.emit("notice", e);
		}
		getStartupConf() {
			let e = this.connectionParameters, t = {
				user: e.user,
				database: e.database
			}, n = e.application_name || e.fallback_application_name;
			return n && (t.application_name = n), e.replication && (t.replication = "" + e.replication), e.statement_timeout && (t.statement_timeout = String(parseInt(e.statement_timeout, 10))), e.lock_timeout && (t.lock_timeout = String(parseInt(e.lock_timeout, 10))), e.idle_in_transaction_session_timeout && (t.idle_in_transaction_session_timeout = String(parseInt(e.idle_in_transaction_session_timeout, 10))), e.options && (t.options = e.options), t;
		}
		cancel(e, t) {
			if (e.activeQuery === t) {
				let t = this.connection;
				this.host && this.host.indexOf("/") === 0 ? t.connect(this.host + "/.s.PGSQL." + this.port) : t.connect(this.port, this.host), t.on("connect", function() {
					t.cancel(e.processID, e.secretKey);
				});
			} else e._queryQueue.indexOf(t) !== -1 && e._queryQueue.splice(e._queryQueue.indexOf(t), 1);
		}
		setTypeParser(e, t, n) {
			return this._types.setTypeParser(e, t, n);
		}
		getTypeParser(e, t) {
			return this._types.getTypeParser(e, t);
		}
		escapeIdentifier(e) {
			return i.escapeIdentifier(e);
		}
		escapeLiteral(e) {
			return i.escapeLiteral(e);
		}
		_pulseQueryQueue() {
			if (this.readyForQuery === !0) {
				this._activeQuery = this._queryQueue.shift();
				let e = this._getActiveQuery();
				if (e) {
					this.readyForQuery = !1, this.hasExecuted = !0;
					let t = e.submit(this.connection);
					t && process.nextTick(() => {
						e.handleError(t, this.connection), this.readyForQuery = !0, this._pulseQueryQueue();
					});
				} else this.hasExecuted && (this._activeQuery = null, this.emit("drain"));
			}
		}
		query(e, t, n) {
			let r, i, a, o, s;
			if (e == null) throw TypeError("Client was passed a null or undefined query");
			return typeof e.submit == "function" ? (a = e.query_timeout || this.connectionParameters.query_timeout, i = r = e, r.callback || (typeof t == "function" ? r.callback = t : n && (r.callback = n))) : (a = e.query_timeout || this.connectionParameters.query_timeout, r = new l(e, t, n), r.callback || (i = new this._Promise((e, t) => {
				r.callback = (n, r) => n ? t(n) : e(r);
			}).catch((e) => {
				throw Error.captureStackTrace(e), e;
			}))), a && (s = r.callback || (() => {}), o = setTimeout(() => {
				let e = /* @__PURE__ */ Error("Query read timeout");
				process.nextTick(() => {
					r.handleError(e, this.connection);
				}), s(e), r.callback = () => {};
				let t = this._queryQueue.indexOf(r);
				t > -1 && this._queryQueue.splice(t, 1), this._pulseQueryQueue();
			}, a), r.callback = (e, t) => {
				clearTimeout(o), s(e, t);
			}), this.binary && !r.binary && (r.binary = !0), r._result && !r._result._types && (r._result._types = this._types), this._queryable ? this._ending ? (process.nextTick(() => {
				r.handleError(/* @__PURE__ */ Error("Client was closed and is not queryable"), this.connection);
			}), i) : (this._queryQueue.length > 0 && y(), this._queryQueue.push(r), this._pulseQueryQueue(), i) : (process.nextTick(() => {
				r.handleError(/* @__PURE__ */ Error("Client has encountered a connection error and is not queryable"), this.connection);
			}), i);
		}
		ref() {
			this.connection.ref();
		}
		unref() {
			this.connection.unref();
		}
		end(e) {
			if (this._ending = !0, !this.connection._connecting || this._ended) if (e) e();
			else return this._Promise.resolve();
			if (this._getActiveQuery() || !this._queryable ? this.connection.stream.destroy() : this.connection.end(), e) this.connection.once("end", e);
			else return new this._Promise((e) => {
				this.connection.once("end", e);
			});
		}
		get queryQueue() {
			return m(), this._queryQueue;
		}
	};
	b.Query = l, n.exports = b;
})), H = /* @__PURE__ */ a(((e, n) => {
	var r = t("events").EventEmitter, i = function() {}, a = (e, t) => {
		let n = e.findIndex(t);
		return n === -1 ? void 0 : e.splice(n, 1)[0];
	}, o = class {
		constructor(e, t, n) {
			this.client = e, this.idleListener = t, this.timeoutId = n;
		}
	}, s = class {
		constructor(e) {
			this.callback = e;
		}
	};
	function c() {
		throw Error("Release called on client which has already been released to the pool.");
	}
	function l(e, t) {
		if (t) return {
			callback: t,
			result: void 0
		};
		let n, r;
		return {
			callback: function(e, t) {
				e ? n(e) : r(t);
			},
			result: new e(function(e, t) {
				r = e, n = t;
			}).catch((e) => {
				throw Error.captureStackTrace(e), e;
			})
		};
	}
	function u(e, t) {
		return function n(r) {
			r.client = t, t.removeListener("error", n), t.on("error", () => {
				e.log("additional client error after disconnection due to error", r);
			}), e._remove(t), e.emit("error", r, t);
		};
	}
	n.exports = class extends r {
		constructor(e, t) {
			super(), this.options = Object.assign({}, e), e != null && "password" in e && Object.defineProperty(this.options, "password", {
				configurable: !0,
				enumerable: !1,
				writable: !0,
				value: e.password
			}), e != null && e.ssl && e.ssl.key && Object.defineProperty(this.options.ssl, "key", { enumerable: !1 }), this.options.max = this.options.max || this.options.poolSize || 10, this.options.min = this.options.min || 0, this.options.maxUses = this.options.maxUses || Infinity, this.options.allowExitOnIdle = this.options.allowExitOnIdle || !1, this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0, this.log = this.options.log || function() {}, this.Client = this.options.Client || t || Y().Client, this.Promise = this.options.Promise || global.Promise, this.options.idleTimeoutMillis === void 0 && (this.options.idleTimeoutMillis = 1e4), this._clients = [], this._idle = [], this._expired = /* @__PURE__ */ new WeakSet(), this._pendingQueue = [], this._endCallback = void 0, this.ending = !1, this.ended = !1;
		}
		_promiseTry(e) {
			let t = this.Promise;
			return typeof t.try == "function" ? t.try(e) : new t((t) => t(e()));
		}
		_isFull() {
			return this._clients.length >= this.options.max;
		}
		_isAboveMin() {
			return this._clients.length > this.options.min;
		}
		_pulseQueue() {
			if (this.log("pulse queue"), this.ended) {
				this.log("pulse queue ended");
				return;
			}
			if (this.ending) {
				this.log("pulse queue on ending"), this._idle.length && this._idle.slice().map((e) => {
					this._remove(e.client);
				}), this._clients.length || (this.ended = !0, this._endCallback());
				return;
			}
			if (!this._pendingQueue.length) {
				this.log("no queued requests");
				return;
			}
			if (!this._idle.length && this._isFull()) return;
			let e = this._pendingQueue.shift();
			if (this._idle.length) {
				let t = this._idle.pop();
				clearTimeout(t.timeoutId);
				let n = t.client;
				n.ref && n.ref();
				let r = t.idleListener;
				return this._acquireClient(n, e, r, !1);
			}
			if (!this._isFull()) return this.newClient(e);
			throw Error("unexpected condition");
		}
		_remove(e, t) {
			let n = a(this._idle, (t) => t.client === e);
			n !== void 0 && clearTimeout(n.timeoutId), this._clients = this._clients.filter((t) => t !== e);
			let r = this;
			e.end(() => {
				r.emit("remove", e), typeof t == "function" && t();
			});
		}
		connect(e) {
			if (this.ending) {
				let t = /* @__PURE__ */ Error("Cannot use a pool after calling end on the pool");
				return e ? e(t) : this.Promise.reject(t);
			}
			let t = l(this.Promise, e), n = t.result;
			if (this._isFull() || this._idle.length) {
				if (this._idle.length && process.nextTick(() => this._pulseQueue()), !this.options.connectionTimeoutMillis) return this._pendingQueue.push(new s(t.callback)), n;
				let e = (e, n, r) => {
					clearTimeout(i), t.callback(e, n, r);
				}, r = new s(e), i = setTimeout(() => {
					a(this._pendingQueue, (t) => t.callback === e), r.timedOut = !0, t.callback(/* @__PURE__ */ Error("timeout exceeded when trying to connect"));
				}, this.options.connectionTimeoutMillis);
				return i.unref && i.unref(), this._pendingQueue.push(r), n;
			}
			return this.newClient(new s(t.callback)), n;
		}
		newClient(e) {
			let t = new this.Client(this.options);
			this._clients.push(t);
			let n = u(this, t);
			this.log("checking client timeout");
			let r, a = !1;
			this.options.connectionTimeoutMillis && (r = setTimeout(() => {
				t.connection ? (this.log("ending client due to timeout"), a = !0, t.connection.stream.destroy()) : t.isConnected() || (this.log("ending client due to timeout"), a = !0, t.end());
			}, this.options.connectionTimeoutMillis)), this.log("connecting new client"), t.connect((o) => {
				if (r && clearTimeout(r), t.on("error", n), o) this.log("client failed to connect", o), this._clients = this._clients.filter((e) => e !== t), a && (o = Error("Connection terminated due to connection timeout", { cause: o })), this._pulseQueue(), e.timedOut || e.callback(o, void 0, i);
				else {
					if (this.log("new client connected"), this.options.onConnect) {
						this._promiseTry(() => this.options.onConnect(t)).then(() => {
							this._afterConnect(t, e, n);
						}, (n) => {
							this._clients = this._clients.filter((e) => e !== t), t.end(() => {
								this._pulseQueue(), e.timedOut || e.callback(n, void 0, i);
							});
						});
						return;
					}
					return this._afterConnect(t, e, n);
				}
			});
		}
		_afterConnect(e, t, n) {
			if (this.options.maxLifetimeSeconds !== 0) {
				let t = setTimeout(() => {
					this.log("ending client due to expired lifetime"), this._expired.add(e), this._idle.findIndex((t) => t.client === e) !== -1 && this._acquireClient(e, new s((e, t, n) => n()), n, !1);
				}, this.options.maxLifetimeSeconds * 1e3);
				t.unref(), e.once("end", () => clearTimeout(t));
			}
			return this._acquireClient(e, t, n, !0);
		}
		_acquireClient(e, t, n, r) {
			r && this.emit("connect", e), this.emit("acquire", e), e.release = this._releaseOnce(e, n), e.removeListener("error", n), t.timedOut ? r && this.options.verify ? this.options.verify(e, e.release) : e.release() : r && this.options.verify ? this.options.verify(e, (n) => {
				if (n) return e.release(n), t.callback(n, void 0, i);
				t.callback(void 0, e, e.release);
			}) : t.callback(void 0, e, e.release);
		}
		_releaseOnce(e, t) {
			let n = !1;
			return (r) => {
				n && c(), n = !0, this._release(e, t, r);
			};
		}
		_release(e, t, n) {
			if (e.on("error", t), e._poolUseCount = (e._poolUseCount || 0) + 1, this.emit("release", n, e), n || this.ending || !e._queryable || e._ending || e._poolUseCount >= this.options.maxUses) return e._poolUseCount >= this.options.maxUses && this.log("remove expended client"), this._remove(e, this._pulseQueue.bind(this));
			if (this._expired.has(e)) return this.log("remove expired client"), this._expired.delete(e), this._remove(e, this._pulseQueue.bind(this));
			let r;
			this.options.idleTimeoutMillis && this._isAboveMin() && (r = setTimeout(() => {
				this._isAboveMin() && (this.log("remove idle client"), this._remove(e, this._pulseQueue.bind(this)));
			}, this.options.idleTimeoutMillis), this.options.allowExitOnIdle && r.unref()), this.options.allowExitOnIdle && e.unref(), this._idle.push(new o(e, t, r)), this._pulseQueue();
		}
		query(e, t, n) {
			if (typeof e == "function") {
				let t = l(this.Promise, e);
				return setImmediate(function() {
					return t.callback(/* @__PURE__ */ Error("Passing a function as the first parameter to pool.query is not supported"));
				}), t.result;
			}
			typeof t == "function" && (n = t, t = void 0);
			let r = l(this.Promise, n);
			return n = r.callback, this.connect((r, i) => {
				if (r) return n(r);
				let a = !1, o = (e) => {
					a || (a = !0, i.release(e), n(e));
				};
				i.once("error", o), this.log("dispatching query");
				try {
					i.query(e, t, (e, t) => {
						if (this.log("query dispatched"), i.removeListener("error", o), !a) return a = !0, i.release(e), e ? n(e) : n(void 0, t);
					});
				} catch (e) {
					return i.release(e), n(e);
				}
			}), r.result;
		}
		end(e) {
			if (this.log("ending"), this.ending) {
				let t = /* @__PURE__ */ Error("Called end on pool more than once");
				return e ? e(t) : this.Promise.reject(t);
			}
			this.ending = !0;
			let t = l(this.Promise, e);
			return this._endCallback = t.callback, this._pulseQueue(), t.result;
		}
		get waitingCount() {
			return this._pendingQueue.length;
		}
		get idleCount() {
			return this._idle.length;
		}
		get expiredCount() {
			return this._clients.reduce((e, t) => e + (this._expired.has(t) ? 1 : 0), 0);
		}
		get totalCount() {
			return this._clients.length;
		}
	};
})), U = /* @__PURE__ */ i({ default: () => W }), W, G = n((() => {
	throw W = {}, Error("Could not resolve \"pg-native\" imported by \"pg\". Is it installed?");
})), K = /* @__PURE__ */ a(((e, n) => {
	var r = t("events").EventEmitter, i = t("util"), a = v(), o = n.exports = function(e, t, n) {
		r.call(this), e = a.normalizeQueryConfig(e, t, n), this.text = e.text, this.values = e.values, this.name = e.name, this.queryMode = e.queryMode, this.callback = e.callback, this.state = "new", this._arrayMode = e.rowMode === "array", this._emitRowEvents = !1, this.on("newListener", function(e) {
			e === "row" && (this._emitRowEvents = !0);
		}.bind(this));
	};
	i.inherits(o, r);
	var s = {
		sqlState: "code",
		statementPosition: "position",
		messagePrimary: "message",
		context: "where",
		schemaName: "schema",
		tableName: "table",
		columnName: "column",
		dataTypeName: "dataType",
		constraintName: "constraint",
		sourceFile: "file",
		sourceLine: "line",
		sourceFunction: "routine"
	};
	o.prototype.handleError = function(e) {
		let t = this.native.pq.resultErrorFields();
		if (t) for (let n in t) {
			let r = s[n] || n;
			e[r] = t[n];
		}
		this.callback ? this.callback(e) : this.emit("error", e), this.state = "error";
	}, o.prototype.then = function(e, t) {
		return this._getPromise().then(e, t);
	}, o.prototype.catch = function(e) {
		return this._getPromise().catch(e);
	}, o.prototype._getPromise = function() {
		return this._promise ||= new Promise(function(e, t) {
			this._once("end", e), this._once("error", t);
		}.bind(this)), this._promise;
	}, o.prototype.submit = function(e) {
		this.state = "running";
		let t = this;
		this.native = e.native, e.native.arrayMode = this._arrayMode;
		let n = function(n, r, i) {
			if (e.native.arrayMode = !1, setImmediate(function() {
				t.emit("_done");
			}), n) return t.handleError(n);
			t._emitRowEvents && (i.length > 1 ? r.forEach((e, n) => {
				e.forEach((e) => {
					t.emit("row", e, i[n]);
				});
			}) : r.forEach(function(e) {
				t.emit("row", e, i);
			})), t.state = "end", t.emit("end", i), t.callback && t.callback(null, i);
		};
		if (process.domain && (n = process.domain.bind(n)), this.name) {
			this.name.length > 63 && (console.error("Warning! Postgres only supports 63 characters for query names."), console.error("You supplied %s (%s)", this.name, this.name.length), console.error("This can cause conflicts and silent errors executing queries"));
			let r = (this.values || []).map(a.prepareValue);
			if (e.namedQueries[this.name]) {
				if (this.text && e.namedQueries[this.name] !== this.text) {
					let e = /* @__PURE__ */ Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
					return n(e);
				}
				return e.native.execute(this.name, r, n);
			}
			return e.native.prepare(this.name, this.text, r.length, function(i) {
				return i ? n(i) : (e.namedQueries[t.name] = t.text, t.native.execute(t.name, r, n));
			});
		} else if (this.values) {
			if (!Array.isArray(this.values)) return n(/* @__PURE__ */ Error("Query values must be an array"));
			let t = this.values.map(a.prepareValue);
			e.native.query(this.text, t, n);
		} else this.queryMode === "extended" ? e.native.query(this.text, [], n) : e.native.query(this.text, n);
	};
})), q = /* @__PURE__ */ a(((n, r) => {
	var i = t("util"), a;
	try {
		a = (G(), e(U));
	} catch (e) {
		throw e;
	}
	var o = w(), s = t("events").EventEmitter, c = t("util"), l = E(), u = K(), d = i.deprecate(() => {}, "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."), f = r.exports = function(e) {
		s.call(this), e ||= {}, this._Promise = e.Promise || global.Promise, this._types = new o(e.types), this.native = new a({ types: this._types }), this._queryQueue = [], this._ending = !1, this._connecting = !1, this._connected = !1, this._queryable = !0;
		let t = this.connectionParameters = new l(e);
		e.nativeConnectionString && (t.nativeConnectionString = e.nativeConnectionString), this.user = t.user, Object.defineProperty(this, "password", {
			configurable: !0,
			enumerable: !1,
			writable: !0,
			value: t.password
		}), this.database = t.database, this.host = t.host, this.port = t.port, this.namedQueries = {};
	};
	f.Query = u, c.inherits(f, s), f.prototype._errorAllQueries = function(e) {
		let t = (t) => {
			process.nextTick(() => {
				t.native = this.native, t.handleError(e);
			});
		};
		this._hasActiveQuery() && (t(this._activeQuery), this._activeQuery = null), this._queryQueue.forEach(t), this._queryQueue.length = 0;
	}, f.prototype._connect = function(e) {
		let t = this;
		if (this._connecting) {
			process.nextTick(() => e(/* @__PURE__ */ Error("Client has already been connected. You cannot reuse a client.")));
			return;
		}
		this._connecting = !0, this.connectionParameters.getLibpqConnectionString(function(n, r) {
			if (t.connectionParameters.nativeConnectionString && (r = t.connectionParameters.nativeConnectionString), n) return e(n);
			t.native.connect(r, function(n) {
				if (n) return t.native.end(), e(n);
				t._connected = !0, t.native.on("error", function(e) {
					t._queryable = !1, t._errorAllQueries(e), t.emit("error", e);
				}), t.native.on("notification", function(e) {
					t.emit("notification", {
						channel: e.relname,
						payload: e.extra
					});
				}), t.emit("connect"), t._pulseQueryQueue(!0), e(null, this);
			});
		});
	}, f.prototype.connect = function(e) {
		if (e) {
			this._connect(e);
			return;
		}
		return new this._Promise((e, t) => {
			this._connect((n) => {
				n ? t(n) : e(this);
			});
		});
	}, f.prototype.query = function(e, t, n) {
		let r, i, a, o, s;
		if (e == null) throw TypeError("Client was passed a null or undefined query");
		if (typeof e.submit == "function") a = e.query_timeout || this.connectionParameters.query_timeout, i = r = e, typeof t == "function" && (e.callback = t);
		else if (a = e.query_timeout || this.connectionParameters.query_timeout, r = new u(e, t, n), !r.callback) {
			let e, t;
			i = new this._Promise((n, r) => {
				e = n, t = r;
			}).catch((e) => {
				throw Error.captureStackTrace(e), e;
			}), r.callback = (n, r) => n ? t(n) : e(r);
		}
		return a && (s = r.callback || (() => {}), o = setTimeout(() => {
			let e = /* @__PURE__ */ Error("Query read timeout");
			process.nextTick(() => {
				r.handleError(e, this.connection);
			}), s(e), r.callback = () => {};
			let t = this._queryQueue.indexOf(r);
			t > -1 && this._queryQueue.splice(t, 1), this._pulseQueryQueue();
		}, a), r.callback = (e, t) => {
			clearTimeout(o), s(e, t);
		}), this._queryable ? this._ending ? (r.native = this.native, process.nextTick(() => {
			r.handleError(/* @__PURE__ */ Error("Client was closed and is not queryable"));
		}), i) : (this._queryQueue.length > 0 && d(), this._queryQueue.push(r), this._pulseQueryQueue(), i) : (r.native = this.native, process.nextTick(() => {
			r.handleError(/* @__PURE__ */ Error("Client has encountered a connection error and is not queryable"));
		}), i);
	}, f.prototype.end = function(e) {
		let t = this;
		this._ending = !0, this._connected || this.once("connect", this.end.bind(this, e));
		let n;
		return e || (n = new this._Promise(function(t, n) {
			e = (e) => e ? n(e) : t();
		})), this.native.end(function() {
			t._connected = !1, t._errorAllQueries(/* @__PURE__ */ Error("Connection terminated")), process.nextTick(() => {
				t.emit("end"), e && e();
			});
		}), n;
	}, f.prototype._hasActiveQuery = function() {
		return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
	}, f.prototype._pulseQueryQueue = function(e) {
		if (!this._connected || this._hasActiveQuery()) return;
		let t = this._queryQueue.shift();
		if (!t) {
			e || this.emit("drain");
			return;
		}
		this._activeQuery = t, t.submit(this);
		let n = this;
		t.once("_done", function() {
			n._pulseQueryQueue();
		});
	}, f.prototype.cancel = function(e) {
		this._activeQuery === e ? this.native.cancel(function() {}) : this._queryQueue.indexOf(e) !== -1 && this._queryQueue.splice(this._queryQueue.indexOf(e), 1);
	}, f.prototype.ref = function() {}, f.prototype.unref = function() {}, f.prototype.setTypeParser = function(e, t, n) {
		return this._types.setTypeParser(e, t, n);
	}, f.prototype.getTypeParser = function(e, t) {
		return this._types.getTypeParser(e, t);
	}, f.prototype.isConnected = function() {
		return this._connected;
	};
})), J = /* @__PURE__ */ a(((e, t) => {
	t.exports = q();
})), Y = /* @__PURE__ */ a(((e, t) => {
	var n = V(), r = _(), i = L(), a = D(), o = v(), s = H(), c = w(), { DatabaseError: l } = P(), { escapeIdentifier: u, escapeLiteral: d } = v(), f = (e) => class extends s {
		constructor(t) {
			super(t, e);
		}
	}, p = function(e) {
		this.defaults = r, this.Client = e, this.Query = this.Client.Query, this.Pool = f(this.Client), this._pools = [], this.Connection = i, this.types = g(), this.DatabaseError = l, this.TypeOverrides = c, this.escapeIdentifier = u, this.escapeLiteral = d, this.Result = a, this.utils = o;
	}, m = n, h = !1;
	try {
		h = !!process.env.NODE_PG_FORCE_NATIVE;
	} catch {}
	h && (m = J()), t.exports = new p(m), Object.defineProperty(t.exports, "native", {
		configurable: !0,
		enumerable: !1,
		get() {
			let e = null;
			try {
				e = new p(J());
			} catch (e) {
				if (e.code !== "MODULE_NOT_FOUND") throw e;
			}
			return Object.defineProperty(t.exports, "native", { value: e }), e;
		}
	});
})), X = /* @__PURE__ */ r(Y(), 1), Z = X.default.Client, Q = X.default.Pool;
X.default.Connection, X.default.types, X.default.Query, X.default.DatabaseError, X.default.escapeIdentifier, X.default.escapeLiteral, X.default.Result, X.default.TypeOverrides, X.default.defaults;
//#endregion
export { Q as n, Z as t };
