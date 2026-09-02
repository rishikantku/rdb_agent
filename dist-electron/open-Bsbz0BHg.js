import { n as e } from "./chunk-BQCxAhux.js";
import { Buffer as t } from "node:buffer";
import n from "node:os";
import { promisify as r } from "node:util";
import i from "node:process";
import a, { constants as o } from "node:fs/promises";
import s, { execFile as c } from "node:child_process";
import { fileURLToPath as l } from "node:url";
import u from "node:path";
import d from "node:fs";
//#region node_modules/is-docker/index.js
function f() {
	try {
		return d.statSync("/.dockerenv"), !0;
	} catch {
		return !1;
	}
}
function p() {
	try {
		return d.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
	} catch {
		return !1;
	}
}
function ee() {
	return m === void 0 && (m = f() || p()), m;
}
var m, h = e((() => {}));
//#endregion
//#region node_modules/is-inside-container/index.js
function g() {
	return _ === void 0 && (_ = v() || ee()), _;
}
var _, v, y = e((() => {
	h(), v = () => {
		try {
			return d.statSync("/run/.containerenv"), !0;
		} catch {
			return !1;
		}
	};
})), b, x, S = e((() => {
	y(), b = () => {
		if (i.platform !== "linux") return !1;
		if (n.release().toLowerCase().includes("microsoft")) return !g();
		try {
			if (d.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft")) return !g();
		} catch {}
		return d.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop") || d.existsSync("/run/WSL") ? !g() : !1;
	}, x = i.env.__IS_WSL_TEST__ ? b : b();
})), C, w, T, te = e((() => {
	S(), C = (() => {
		let e = "/mnt/", t;
		return async function() {
			if (t) return t;
			let n = "/etc/wsl.conf", r = !1;
			try {
				await a.access(n, o.F_OK), r = !0;
			} catch {}
			if (!r) return e;
			let i = await a.readFile(n, { encoding: "utf8" }), s = /(?<!#.*)root\s*=\s*(?<mountPoint>.*)/g.exec(i);
			return s ? (t = s.groups.mountPoint.trim(), t = t.endsWith("/") ? t : `${t}/`, t) : e;
		};
	})(), w = async () => `${await C()}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`, T = async () => x ? w() : `${i.env.SYSTEMROOT || i.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
}));
//#endregion
//#region node_modules/define-lazy-prop/index.js
function E(e, t, n) {
	let r = (n) => Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		writable: !0
	});
	return Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !0,
		get() {
			let e = n();
			return r(e), e;
		},
		set(e) {
			r(e);
		}
	}), e;
}
var ne = e((() => {}));
//#endregion
//#region node_modules/default-browser-id/index.js
async function D() {
	if (i.platform !== "darwin") throw Error("macOS only");
	let { stdout: e } = await O("defaults", [
		"read",
		"com.apple.LaunchServices/com.apple.launchservices.secure",
		"LSHandlers"
	]), t = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(e)?.groups.id ?? "com.apple.Safari";
	return t === "com.apple.safari" ? "com.apple.Safari" : t;
}
var O, k = e((() => {
	O = r(c);
}));
//#endregion
//#region node_modules/run-applescript/index.js
async function A(e, { humanReadableOutput: t = !0, signal: n } = {}) {
	if (i.platform !== "darwin") throw Error("macOS only");
	let r = t ? [] : ["-ss"], a = {};
	n && (a.signal = n);
	let { stdout: o } = await j("osascript", [
		"-e",
		e,
		r
	], a);
	return o.trim();
}
var j, M = e((() => {
	j = r(c);
}));
//#endregion
//#region node_modules/bundle-name/index.js
async function N(e) {
	return A(`tell application "Finder" to set app_path to application file id "${e}" as string\ntell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}
var P = e((() => {
	M();
}));
//#endregion
//#region node_modules/default-browser/windows.js
async function re(e = F) {
	let { stdout: t } = await e("reg", [
		"QUERY",
		" HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
		"/v",
		"ProgId"
	]), n = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(t);
	if (!n) throw new L(`Cannot find Windows browser in stdout: ${JSON.stringify(t)}`);
	let { id: r } = n.groups, i = r.lastIndexOf("."), a = r.lastIndexOf("-"), o = i === -1 ? void 0 : r.slice(0, i), s = a === -1 ? void 0 : r.slice(0, a);
	return I[r] ?? I[o] ?? I[s] ?? {
		name: r,
		id: r
	};
}
var F, I, L, ie = e((() => {
	F = r(c), I = {
		MSEdgeHTM: {
			name: "Edge",
			id: "com.microsoft.edge"
		},
		MSEdgeBHTML: {
			name: "Edge Beta",
			id: "com.microsoft.edge.beta"
		},
		MSEdgeDHTML: {
			name: "Edge Dev",
			id: "com.microsoft.edge.dev"
		},
		AppXq0fevzme2pys62n3e0fbqa7peapykr8v: {
			name: "Edge",
			id: "com.microsoft.edge.old"
		},
		ChromeHTML: {
			name: "Chrome",
			id: "com.google.chrome"
		},
		ChromeBHTML: {
			name: "Chrome Beta",
			id: "com.google.chrome.beta"
		},
		ChromeDHTML: {
			name: "Chrome Dev",
			id: "com.google.chrome.dev"
		},
		ChromiumHTM: {
			name: "Chromium",
			id: "org.chromium.Chromium"
		},
		BraveHTML: {
			name: "Brave",
			id: "com.brave.Browser"
		},
		BraveBHTML: {
			name: "Brave Beta",
			id: "com.brave.Browser.beta"
		},
		BraveDHTML: {
			name: "Brave Dev",
			id: "com.brave.Browser.dev"
		},
		BraveSSHTM: {
			name: "Brave Nightly",
			id: "com.brave.Browser.nightly"
		},
		FirefoxURL: {
			name: "Firefox",
			id: "org.mozilla.firefox"
		},
		OperaStable: {
			name: "Opera",
			id: "com.operasoftware.Opera"
		},
		VivaldiHTM: {
			name: "Vivaldi",
			id: "com.vivaldi.Vivaldi"
		},
		"IE.HTTP": {
			name: "Internet Explorer",
			id: "com.microsoft.ie"
		}
	}, new Map(Object.entries(I)), L = class extends Error {};
}));
//#endregion
//#region node_modules/default-browser/index.js
async function R() {
	if (i.platform === "darwin") {
		let e = await D();
		return {
			name: await N(e),
			id: e
		};
	}
	if (i.platform === "linux") {
		let { stdout: e } = await z("xdg-mime", [
			"query",
			"default",
			"x-scheme-handler/http"
		]), t = e.trim();
		return {
			name: B(t.replace(/.desktop$/, "").replace("-", " ")),
			id: t
		};
	}
	if (i.platform === "win32") return re();
	throw Error("Only macOS, Linux, and Windows are supported");
}
var z, B, V = e((() => {
	k(), P(), ie(), z = r(c), B = (e) => e.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (e) => e.toUpperCase());
}));
//#endregion
//#region node_modules/open/index.js
async function H() {
	let e = await T(), n = String.raw`(Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice").ProgId`, { stdout: r } = await G(e, [
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy",
		"Bypass",
		"-EncodedCommand",
		t.from(n, "utf16le").toString("base64")
	], { encoding: "utf8" }), i = r.trim(), a = {
		ChromeHTML: "com.google.chrome",
		BraveHTML: "com.brave.Browser",
		MSEdgeHTM: "com.microsoft.edge",
		FirefoxURL: "org.mozilla.firefox"
	};
	return a[i] ? { id: a[i] } : {};
}
function U(e) {
	if (typeof e == "string" || Array.isArray(e)) return e;
	let { [Y]: t } = e;
	if (!t) throw Error(`${Y} is not supported`);
	return t;
}
function W({ [J]: e }, { wsl: t }) {
	if (t && x) return U(t);
	if (!e) throw Error(`${J} is not supported`);
	return U(e);
}
var G, K, q, J, Y, X, Z, Q, $;
//#endregion
e((() => {
	te(), ne(), V(), y(), G = r(s.execFile), K = u.dirname(l(import.meta.url)), q = u.join(K, "xdg-open"), {platform: J, arch: Y} = i, X = async (e, t) => {
		let n;
		for (let r of e) try {
			return await t(r);
		} catch (e) {
			n = e;
		}
		throw n;
	}, Z = async (e) => {
		if (e = {
			wait: !1,
			background: !1,
			newInstance: !1,
			allowNonzeroExitCode: !1,
			...e
		}, Array.isArray(e.app)) return X(e.app, (t) => Z({
			...e,
			app: t
		}));
		let { name: n, arguments: r = [] } = e.app ?? {};
		if (r = [...r], Array.isArray(n)) return X(n, (t) => Z({
			...e,
			app: {
				name: t,
				arguments: r
			}
		}));
		if (n === "browser" || n === "browserPrivate") {
			let t = {
				"com.google.chrome": "chrome",
				"google-chrome.desktop": "chrome",
				"com.brave.Browser": "brave",
				"org.mozilla.firefox": "firefox",
				"firefox.desktop": "firefox",
				"com.microsoft.msedge": "edge",
				"com.microsoft.edge": "edge",
				"com.microsoft.edgemac": "edge",
				"microsoft-edge.desktop": "edge"
			}, i = {
				chrome: "--incognito",
				brave: "--incognito",
				firefox: "--private-window",
				edge: "--inPrivate"
			}, a = x ? await H() : await R();
			if (a.id in t) {
				let o = t[a.id];
				return n === "browserPrivate" && r.push(i[o]), Z({
					...e,
					app: {
						name: $[o],
						arguments: r
					}
				});
			}
			throw Error(`${a.name} is not supported as a default browser`);
		}
		let c, l = [], u = {};
		if (J === "darwin") c = "open", e.wait && l.push("--wait-apps"), e.background && l.push("--background"), e.newInstance && l.push("--new"), n && l.push("-a", n);
		else if (J === "win32" || x && !g() && !n) {
			c = await T(), l.push("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand"), x || (u.windowsVerbatimArguments = !0);
			let i = ["Start"];
			e.wait && i.push("-Wait"), n ? (i.push(`"\`"${n}\`""`), e.target && r.push(e.target)) : e.target && i.push(`"${e.target}"`), r.length > 0 && (r = r.map((e) => `"\`"${e}\`""`), i.push("-ArgumentList", r.join(","))), e.target = t.from(i.join(" "), "utf16le").toString("base64");
		} else {
			if (n) c = n;
			else {
				let e = !K || K === "/", t = !1;
				try {
					await a.access(q, o.X_OK), t = !0;
				} catch {}
				c = i.versions.electron ?? (J === "android" || e || !t) ? "xdg-open" : q;
			}
			r.length > 0 && l.push(...r), e.wait || (u.stdio = "ignore", u.detached = !0);
		}
		J === "darwin" && r.length > 0 && l.push("--args", ...r), e.target && l.push(e.target);
		let d = s.spawn(c, l, u);
		return e.wait ? new Promise((t, n) => {
			d.once("error", n), d.once("close", (r) => {
				if (!e.allowNonzeroExitCode && r > 0) {
					n(/* @__PURE__ */ Error(`Exited with code ${r}`));
					return;
				}
				t(d);
			});
		}) : (d.unref(), d);
	}, Q = (e, t) => {
		if (typeof e != "string") throw TypeError("Expected a `target`");
		return Z({
			...t,
			target: e
		});
	}, $ = {}, E($, "chrome", () => W({
		darwin: "google chrome",
		win32: "chrome",
		linux: [
			"google-chrome",
			"google-chrome-stable",
			"chromium"
		]
	}, { wsl: {
		ia32: "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
		x64: ["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe", "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
	} })), E($, "brave", () => W({
		darwin: "brave browser",
		win32: "brave",
		linux: ["brave-browser", "brave"]
	}, { wsl: {
		ia32: "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
		x64: ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"]
	} })), E($, "firefox", () => W({
		darwin: "firefox",
		win32: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`,
		linux: "firefox"
	}, { wsl: "/mnt/c/Program Files/Mozilla Firefox/firefox.exe" })), E($, "edge", () => W({
		darwin: "microsoft edge",
		win32: "msedge",
		linux: ["microsoft-edge", "microsoft-edge-dev"]
	}, { wsl: "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" })), E($, "browser", () => "browser"), E($, "browserPrivate", () => "browserPrivate");
}))();
export { Q as default };
