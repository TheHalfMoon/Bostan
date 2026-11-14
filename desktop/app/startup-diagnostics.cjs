const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const phases = new Set([
  "window_loaded", "data_protected", "runtime_valid", "child_spawned",
  "utility_bootstrap", "importing_server", "starting_server", "ready",
]);
const codes = new Set([
  "STARTUP_FAILED", "STARTUP_TIMEOUT", "BACKEND_EXITED", "RUNTIME_MISSING",
  "ERR_MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_UNKNOWN_FILE_EXTENSION",
  "ERR_DLOPEN_FAILED", "ERR_REQUIRE_ESM", "ERR_INVALID_PACKAGE_CONFIG",
  "EACCES", "EPERM", "ENOENT", "EADDRINUSE",
  "POSTGRES_LIBRARY_MISSING", "POSTGRES_SIGNATURE_INVALID", "POSTGRES_LOCALE_INVALID",
  "POSTGRES_PERMISSION_DENIED", "POSTGRES_ROOT_REFUSED", "POSTGRES_INIT_FAILED",
]);
function startupPhaseLine(phase) {
  return phases.has(phase) ? `BOSTAN_DESKTOP_STARTUP_PHASE ${phase}` : null;
}
function startupCode(code) { return codes.has(code) ? code : "STARTUP_FAILED"; }
function startupErrorCode(error) {
  const code = startupCode(error?.code);
  if (code !== "STARTUP_FAILED") return code;
  // The dependency wraps initdb exits as a message. Match only its fixed prefix;
  // classify buffered stderr locally, never emit any of its text or paths.
  try {
    const text = typeof error?.message === "string" ? error.message.slice(0, 65536) : "";
    if (!text.startsWith("Postgres init script exited with code ")) return code;
    if (/code signature|signature.*invalid|not valid for use in process/i.test(text)) return "POSTGRES_SIGNATURE_INVALID";
    if (/Library not loaded:|image not found|cannot open shared object file/i.test(text)) return "POSTGRES_LIBRARY_MISSING";
    if (/invalid locale|locale.*not supported|could not set locale/i.test(text)) return "POSTGRES_LOCALE_INVALID";
    if (/cannot be run as root/i.test(text)) return "POSTGRES_ROOT_REFUSED";
    if (/permission denied|operation not permitted/i.test(text)) return "POSTGRES_PERMISSION_DENIED";
    return "POSTGRES_INIT_FAILED";
  } catch { return code; }
}
function startupFailureLine(code) { return `BOSTAN_DESKTOP_STARTUP_FAILURE ${startupCode(code)}`; }
const sitePattern = /^BOSTAN_DESKTOP_STARTUP_SITE (?:server|config|signing):[1-9]\d{0,5}:[1-9]\d{0,5}$/;
function startupFailureSite(error, runtimeRoot) {
  // Only code locations in three known startup modules may leave this process.
  // Never expose the raw message, stack, function names or absolute paths.
  try {
    if (typeof error?.stack !== "string") return null;
    // macOS can canonicalize /var to /private/var in stack URLs.
    // Accept only the configured runtime root and its filesystem real path.
    const roots = [runtimeRoot];
    try {
      const realRoot = fs.realpathSync.native(runtimeRoot);
      if (realRoot !== runtimeRoot) roots.push(realRoot);
    } catch { /* Missing runtime roots still fail closed. */ }
    const frames = roots.map(root => {
      const prefix = pathToFileURL(path.join(root, "dist") + path.sep).href;
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^\\s+at (?:[^\\r\\n]*?\\()?${escaped}(index\\.js|config\\.js|services/decision-signing\\.js):([1-9]\\d{0,5}):([1-9]\\d{0,5})\\)?$`);
    });
    for (const line of error.stack.slice(0, 8192).split(/\r?\n/).slice(0, 32)) {
      const match = frames.map(frame => frame.exec(line)).find(Boolean);
      if (!match) continue;
      const module = { "index.js": "server", "config.js": "config", "services/decision-signing.js": "signing" }[match[1]];
      return `BOSTAN_DESKTOP_STARTUP_SITE ${module}:${match[2]}:${match[3]}`;
    }
  } catch { /* Optional diagnosis cannot replace the original startup failure. */ }
  return null;
}
function isStartupSiteLine(line) { return typeof line === "string" && !/[\r\n]/.test(line) && sitePattern.test(line); }
function isStartupDiagnosticLine(line) {
  if (typeof line !== "string") return false;
  if (isStartupSiteLine(line)) return true;
  const phasePrefix = "BOSTAN_DESKTOP_STARTUP_PHASE ";
  const phase = line.startsWith(phasePrefix) ? line.slice(phasePrefix.length) : null;
  if (phase !== null) return phases.has(phase);
  const prefix = "BOSTAN_DESKTOP_STARTUP_FAILURE ";
  return line.startsWith(prefix) && codes.has(line.slice(prefix.length));
}
module.exports = { startupPhaseLine, startupCode, startupErrorCode, startupFailureLine, startupFailureSite, isStartupSiteLine, isStartupDiagnosticLine };
