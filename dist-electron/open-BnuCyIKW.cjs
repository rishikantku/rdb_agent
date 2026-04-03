const require_chunk = require("./chunk-9hOWP6kD.cjs");
let node_buffer = require("node:buffer");
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_util = require("node:util");
let node_process = require("node:process");
node_process = require_chunk.__toESM(node_process);
let node_fs_promises = require("node:fs/promises");
node_fs_promises = require_chunk.__toESM(node_fs_promises);
let node_child_process = require("node:child_process");
node_child_process = require_chunk.__toESM(node_child_process);
let node_url = require("node:url");
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
//#region node_modules/is-docker/index.js
function hasDockerEnv() {
	try {
		node_fs.default.statSync("/.dockerenv");
		return true;
	} catch {
		return false;
	}
}
function hasDockerCGroup() {
	try {
		return node_fs.default.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
	} catch {
		return false;
	}
}
function isDocker() {
	if (isDockerCached === void 0) isDockerCached = hasDockerEnv() || hasDockerCGroup();
	return isDockerCached;
}
var isDockerCached;
var init_is_docker = require_chunk.__esmMin((() => {}));
//#endregion
//#region node_modules/is-inside-container/index.js
function isInsideContainer() {
	if (cachedResult === void 0) cachedResult = hasContainerEnv() || isDocker();
	return cachedResult;
}
var cachedResult, hasContainerEnv;
var init_is_inside_container = require_chunk.__esmMin((() => {
	init_is_docker();
	hasContainerEnv = () => {
		try {
			node_fs.default.statSync("/run/.containerenv");
			return true;
		} catch {
			return false;
		}
	};
}));
//#endregion
//#region node_modules/is-wsl/index.js
var isWsl, is_wsl_default;
var init_is_wsl = require_chunk.__esmMin((() => {
	init_is_inside_container();
	isWsl = () => {
		if (node_process.default.platform !== "linux") return false;
		if (node_os.default.release().toLowerCase().includes("microsoft")) {
			if (isInsideContainer()) return false;
			return true;
		}
		try {
			if (node_fs.default.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft")) return !isInsideContainer();
		} catch {}
		if (node_fs.default.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop") || node_fs.default.existsSync("/run/WSL")) return !isInsideContainer();
		return false;
	};
	is_wsl_default = node_process.default.env.__IS_WSL_TEST__ ? isWsl : isWsl();
}));
//#endregion
//#region node_modules/wsl-utils/index.js
var wslDrivesMountPoint, powerShellPathFromWsl, powerShellPath;
var init_wsl_utils = require_chunk.__esmMin((() => {
	init_is_wsl();
	wslDrivesMountPoint = (() => {
		const defaultMountPoint = "/mnt/";
		let mountPoint;
		return async function() {
			if (mountPoint) return mountPoint;
			const configFilePath = "/etc/wsl.conf";
			let isConfigFileExists = false;
			try {
				await node_fs_promises.default.access(configFilePath, node_fs_promises.constants.F_OK);
				isConfigFileExists = true;
			} catch {}
			if (!isConfigFileExists) return defaultMountPoint;
			const configContent = await node_fs_promises.default.readFile(configFilePath, { encoding: "utf8" });
			const configMountPoint = /(?<!#.*)root\s*=\s*(?<mountPoint>.*)/g.exec(configContent);
			if (!configMountPoint) return defaultMountPoint;
			mountPoint = configMountPoint.groups.mountPoint.trim();
			mountPoint = mountPoint.endsWith("/") ? mountPoint : `${mountPoint}/`;
			return mountPoint;
		};
	})();
	powerShellPathFromWsl = async () => {
		return `${await wslDrivesMountPoint()}c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`;
	};
	powerShellPath = async () => {
		if (is_wsl_default) return powerShellPathFromWsl();
		return `${node_process.default.env.SYSTEMROOT || node_process.default.env.windir || String.raw`C:\Windows`}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
	};
}));
//#endregion
//#region node_modules/define-lazy-prop/index.js
function defineLazyProperty(object, propertyName, valueGetter) {
	const define = (value) => Object.defineProperty(object, propertyName, {
		value,
		enumerable: true,
		writable: true
	});
	Object.defineProperty(object, propertyName, {
		configurable: true,
		enumerable: true,
		get() {
			const result = valueGetter();
			define(result);
			return result;
		},
		set(value) {
			define(value);
		}
	});
	return object;
}
var init_define_lazy_prop = require_chunk.__esmMin((() => {}));
//#endregion
//#region node_modules/default-browser-id/index.js
async function defaultBrowserId() {
	if (node_process.default.platform !== "darwin") throw new Error("macOS only");
	const { stdout } = await execFileAsync$3("defaults", [
		"read",
		"com.apple.LaunchServices/com.apple.launchservices.secure",
		"LSHandlers"
	]);
	const browserId = /LSHandlerRoleAll = "(?!-)(?<id>[^"]+?)";\s+?LSHandlerURLScheme = (?:http|https);/.exec(stdout)?.groups.id ?? "com.apple.Safari";
	if (browserId === "com.apple.safari") return "com.apple.Safari";
	return browserId;
}
var execFileAsync$3;
var init_default_browser_id = require_chunk.__esmMin((() => {
	execFileAsync$3 = (0, node_util.promisify)(node_child_process.execFile);
}));
//#endregion
//#region node_modules/run-applescript/index.js
async function runAppleScript(script, { humanReadableOutput = true, signal } = {}) {
	if (node_process.default.platform !== "darwin") throw new Error("macOS only");
	const outputArguments = humanReadableOutput ? [] : ["-ss"];
	const execOptions = {};
	if (signal) execOptions.signal = signal;
	const { stdout } = await execFileAsync$2("osascript", [
		"-e",
		script,
		outputArguments
	], execOptions);
	return stdout.trim();
}
var execFileAsync$2;
var init_run_applescript = require_chunk.__esmMin((() => {
	execFileAsync$2 = (0, node_util.promisify)(node_child_process.execFile);
}));
//#endregion
//#region node_modules/bundle-name/index.js
async function bundleName(bundleId) {
	return runAppleScript(`tell application "Finder" to set app_path to application file id "${bundleId}" as string\ntell application "System Events" to get value of property list item "CFBundleName" of property list file (app_path & ":Contents:Info.plist")`);
}
var init_bundle_name = require_chunk.__esmMin((() => {
	init_run_applescript();
}));
//#endregion
//#region node_modules/default-browser/windows.js
async function defaultBrowser$1(_execFileAsync = execFileAsync$1) {
	const { stdout } = await _execFileAsync("reg", [
		"QUERY",
		" HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice",
		"/v",
		"ProgId"
	]);
	const match = /ProgId\s*REG_SZ\s*(?<id>\S+)/.exec(stdout);
	if (!match) throw new UnknownBrowserError(`Cannot find Windows browser in stdout: ${JSON.stringify(stdout)}`);
	const { id } = match.groups;
	const dotIndex = id.lastIndexOf(".");
	const hyphenIndex = id.lastIndexOf("-");
	const baseIdByDot = dotIndex === -1 ? void 0 : id.slice(0, dotIndex);
	const baseIdByHyphen = hyphenIndex === -1 ? void 0 : id.slice(0, hyphenIndex);
	return windowsBrowserProgIds[id] ?? windowsBrowserProgIds[baseIdByDot] ?? windowsBrowserProgIds[baseIdByHyphen] ?? {
		name: id,
		id
	};
}
var execFileAsync$1, windowsBrowserProgIds, UnknownBrowserError;
var init_windows = require_chunk.__esmMin((() => {
	execFileAsync$1 = (0, node_util.promisify)(node_child_process.execFile);
	windowsBrowserProgIds = {
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
	};
	new Map(Object.entries(windowsBrowserProgIds));
	UnknownBrowserError = class extends Error {};
}));
//#endregion
//#region node_modules/default-browser/index.js
async function defaultBrowser() {
	if (node_process.default.platform === "darwin") {
		const id = await defaultBrowserId();
		return {
			name: await bundleName(id),
			id
		};
	}
	if (node_process.default.platform === "linux") {
		const { stdout } = await execFileAsync("xdg-mime", [
			"query",
			"default",
			"x-scheme-handler/http"
		]);
		const id = stdout.trim();
		return {
			name: titleize(id.replace(/.desktop$/, "").replace("-", " ")),
			id
		};
	}
	if (node_process.default.platform === "win32") return defaultBrowser$1();
	throw new Error("Only macOS, Linux, and Windows are supported");
}
var execFileAsync, titleize;
var init_default_browser = require_chunk.__esmMin((() => {
	init_default_browser_id();
	init_bundle_name();
	init_windows();
	execFileAsync = (0, node_util.promisify)(node_child_process.execFile);
	titleize = (string) => string.toLowerCase().replaceAll(/(?:^|\s|-)\S/g, (x) => x.toUpperCase());
}));
//#endregion
//#region node_modules/open/index.js
/**
Get the default browser name in Windows from WSL.

@returns {Promise<string>} Browser name.
*/
async function getWindowsDefaultBrowserFromWsl() {
	const powershellPath = await powerShellPath();
	const rawCommand = String.raw`(Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice").ProgId`;
	const { stdout } = await execFile(powershellPath, [
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy",
		"Bypass",
		"-EncodedCommand",
		node_buffer.Buffer.from(rawCommand, "utf16le").toString("base64")
	], { encoding: "utf8" });
	const progId = stdout.trim();
	const browserMap = {
		ChromeHTML: "com.google.chrome",
		BraveHTML: "com.brave.Browser",
		MSEdgeHTM: "com.microsoft.edge",
		FirefoxURL: "org.mozilla.firefox"
	};
	return browserMap[progId] ? { id: browserMap[progId] } : {};
}
function detectArchBinary(binary) {
	if (typeof binary === "string" || Array.isArray(binary)) return binary;
	const { [arch]: archBinary } = binary;
	if (!archBinary) throw new Error(`${arch} is not supported`);
	return archBinary;
}
function detectPlatformBinary({ [platform]: platformBinary }, { wsl }) {
	if (wsl && is_wsl_default) return detectArchBinary(wsl);
	if (!platformBinary) throw new Error(`${platform} is not supported`);
	return detectArchBinary(platformBinary);
}
var execFile, __dirname$1, localXdgOpenPath, platform, arch, pTryEach, baseOpen, open, apps;
//#endregion
require_chunk.__esmMin((() => {
	init_wsl_utils();
	init_define_lazy_prop();
	init_default_browser();
	init_is_inside_container();
	execFile = (0, node_util.promisify)(node_child_process.default.execFile);
	__dirname$1 = node_path.default.dirname((0, node_url.fileURLToPath)({}.url));
	localXdgOpenPath = node_path.default.join(__dirname$1, "xdg-open");
	({platform, arch} = node_process.default);
	pTryEach = async (array, mapper) => {
		let latestError;
		for (const item of array) try {
			return await mapper(item);
		} catch (error) {
			latestError = error;
		}
		throw latestError;
	};
	baseOpen = async (options) => {
		options = {
			wait: false,
			background: false,
			newInstance: false,
			allowNonzeroExitCode: false,
			...options
		};
		if (Array.isArray(options.app)) return pTryEach(options.app, (singleApp) => baseOpen({
			...options,
			app: singleApp
		}));
		let { name: app, arguments: appArguments = [] } = options.app ?? {};
		appArguments = [...appArguments];
		if (Array.isArray(app)) return pTryEach(app, (appName) => baseOpen({
			...options,
			app: {
				name: appName,
				arguments: appArguments
			}
		}));
		if (app === "browser" || app === "browserPrivate") {
			const ids = {
				"com.google.chrome": "chrome",
				"google-chrome.desktop": "chrome",
				"com.brave.Browser": "brave",
				"org.mozilla.firefox": "firefox",
				"firefox.desktop": "firefox",
				"com.microsoft.msedge": "edge",
				"com.microsoft.edge": "edge",
				"com.microsoft.edgemac": "edge",
				"microsoft-edge.desktop": "edge"
			};
			const flags = {
				chrome: "--incognito",
				brave: "--incognito",
				firefox: "--private-window",
				edge: "--inPrivate"
			};
			const browser = is_wsl_default ? await getWindowsDefaultBrowserFromWsl() : await defaultBrowser();
			if (browser.id in ids) {
				const browserName = ids[browser.id];
				if (app === "browserPrivate") appArguments.push(flags[browserName]);
				return baseOpen({
					...options,
					app: {
						name: apps[browserName],
						arguments: appArguments
					}
				});
			}
			throw new Error(`${browser.name} is not supported as a default browser`);
		}
		let command;
		const cliArguments = [];
		const childProcessOptions = {};
		if (platform === "darwin") {
			command = "open";
			if (options.wait) cliArguments.push("--wait-apps");
			if (options.background) cliArguments.push("--background");
			if (options.newInstance) cliArguments.push("--new");
			if (app) cliArguments.push("-a", app);
		} else if (platform === "win32" || is_wsl_default && !isInsideContainer() && !app) {
			command = await powerShellPath();
			cliArguments.push("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand");
			if (!is_wsl_default) childProcessOptions.windowsVerbatimArguments = true;
			const encodedArguments = ["Start"];
			if (options.wait) encodedArguments.push("-Wait");
			if (app) {
				encodedArguments.push(`"\`"${app}\`""`);
				if (options.target) appArguments.push(options.target);
			} else if (options.target) encodedArguments.push(`"${options.target}"`);
			if (appArguments.length > 0) {
				appArguments = appArguments.map((argument) => `"\`"${argument}\`""`);
				encodedArguments.push("-ArgumentList", appArguments.join(","));
			}
			options.target = node_buffer.Buffer.from(encodedArguments.join(" "), "utf16le").toString("base64");
		} else {
			if (app) command = app;
			else {
				const isBundled = !__dirname$1 || __dirname$1 === "/";
				let exeLocalXdgOpen = false;
				try {
					await node_fs_promises.default.access(localXdgOpenPath, node_fs_promises.constants.X_OK);
					exeLocalXdgOpen = true;
				} catch {}
				command = node_process.default.versions.electron ?? (platform === "android" || isBundled || !exeLocalXdgOpen) ? "xdg-open" : localXdgOpenPath;
			}
			if (appArguments.length > 0) cliArguments.push(...appArguments);
			if (!options.wait) {
				childProcessOptions.stdio = "ignore";
				childProcessOptions.detached = true;
			}
		}
		if (platform === "darwin" && appArguments.length > 0) cliArguments.push("--args", ...appArguments);
		if (options.target) cliArguments.push(options.target);
		const subprocess = node_child_process.default.spawn(command, cliArguments, childProcessOptions);
		if (options.wait) return new Promise((resolve, reject) => {
			subprocess.once("error", reject);
			subprocess.once("close", (exitCode) => {
				if (!options.allowNonzeroExitCode && exitCode > 0) {
					reject(/* @__PURE__ */ new Error(`Exited with code ${exitCode}`));
					return;
				}
				resolve(subprocess);
			});
		});
		subprocess.unref();
		return subprocess;
	};
	open = (target, options) => {
		if (typeof target !== "string") throw new TypeError("Expected a `target`");
		return baseOpen({
			...options,
			target
		});
	};
	apps = {};
	defineLazyProperty(apps, "chrome", () => detectPlatformBinary({
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
	} }));
	defineLazyProperty(apps, "brave", () => detectPlatformBinary({
		darwin: "brave browser",
		win32: "brave",
		linux: ["brave-browser", "brave"]
	}, { wsl: {
		ia32: "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
		x64: ["/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe", "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"]
	} }));
	defineLazyProperty(apps, "firefox", () => detectPlatformBinary({
		darwin: "firefox",
		win32: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`,
		linux: "firefox"
	}, { wsl: "/mnt/c/Program Files/Mozilla Firefox/firefox.exe" }));
	defineLazyProperty(apps, "edge", () => detectPlatformBinary({
		darwin: "microsoft edge",
		win32: "msedge",
		linux: ["microsoft-edge", "microsoft-edge-dev"]
	}, { wsl: "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" }));
	defineLazyProperty(apps, "browser", () => "browser");
	defineLazyProperty(apps, "browserPrivate", () => "browserPrivate");
}))();
exports.default = open;
