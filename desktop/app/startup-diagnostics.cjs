const phases = new Set([
  "window_loaded", "data_protected", "runtime_valid", "child_spawned",
  "utility_bootstrap", "importing_server", "starting_server", "ready",
]);
const codes = new Set([
  "STARTUP_FAILED", "STARTUP_TIMEOUT", "BACKEND_EXITED", "RUNTIME_MISSING",
  "ERR_MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_UNKNOWN_FILE_EXTENSION",
  "ERR_DLOPEN_FAILED", "ERR_REQUIRE_ESM", "ERR_INVALID_PACKAGE_CONFIG",
  "EACCES", "EPERM", "ENOENT", "EADDRINUSE",
]);
function startupPhaseLine(phase) {
  return phases.has(phase) ? `BOSTAN_DESKTOP_STARTUP_PHASE ${phase}` : null;
}
function startupCode(code) { return codes.has(code) ? code : "STARTUP_FAILED"; }
function startupFailureLine(code) { return `BOSTAN_DESKTOP_STARTUP_FAILURE ${startupCode(code)}`; }
function isStartupDiagnosticLine(line) {
  if (typeof line !== "string") return false;
  const phasePrefix = "BOSTAN_DESKTOP_STARTUP_PHASE ";
  const phase = line.startsWith(phasePrefix) ? line.slice(phasePrefix.length) : null;
  if (phase !== null) return phases.has(phase);
  const prefix = "BOSTAN_DESKTOP_STARTUP_FAILURE ";
  return line.startsWith(prefix) && codes.has(line.slice(prefix.length));
}
module.exports = { startupPhaseLine, startupCode, startupFailureLine, isStartupDiagnosticLine };
