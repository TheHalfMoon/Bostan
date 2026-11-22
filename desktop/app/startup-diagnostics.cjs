const path = require("node:path");
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
  "POSTGRES_START_FAILED", "POSTGRES_DATABASE_FAILED", "POSTGRES_MIGRATION_FAILED",
  "POSTGRES_MIGRATION_CONNECTION_FAILED", "POSTGRES_MIGRATION_AUTH_FAILED",
  "POSTGRES_MIGRATION_SCHEMA_FAILED", "POSTGRES_MIGRATION_CONSTRAINT_FAILED",
  "POSTGRES_MIGRATION_FEATURE_UNSUPPORTED", "POSTGRES_MIGRATION_FILE_MISSING",
  "POSTGRES_BOOTSTRAP_FAILED", "DATABASE_BOOTSTRAP_FAILED", "DATABASE_MIGRATION_FAILED",
  "SERVER_INSTRUMENTATION_FAILED",
  "SERVER_ERROR_MONITORING_FAILED", "SERVER_SIGNING_SECRET_FAILED", "SERVER_CONFIG_FAILED",
  "SERVER_RUNTIME_INITIALIZATION_FAILED", "SERVER_STARTUP_FAILED",
]);
const postgresStartupIssues = new Set([
  "POSTGRES_START_ADDRESS_IN_USE", "POSTGRES_START_DATA_DIRECTORY_DENIED",
  "POSTGRES_START_LOCALE_INVALID", "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING",
  "POSTGRES_START_EXTENSION_MISSING", "POSTGRES_START_SHARED_MEMORY_FAILED",
  "POSTGRES_START_CONFIGURATION_INVALID", "POSTGRES_START_CLUSTER_INCOMPATIBLE",
  "POSTGRES_START_DISK_FULL", "POSTGRES_START_RECOVERY_FAILED",
  "POSTGRES_START_LOGS_EMPTY", "POSTGRES_START_LOGS_UNCLASSIFIED",
  "POSTGRES_START_PROCESS_EXITED", "POSTGRES_START_PROCESS_LAUNCH_FAILED",
  "POSTGRES_START_UNCLASSIFIED",
]);
function startupPhaseLine(phase) {
  return phases.has(phase) ? `BOSTAN_DESKTOP_STARTUP_PHASE ${phase}` : null;
}
function startupCode(code) { return codes.has(code) ? code : "STARTUP_FAILED"; }
function startupErrorCode(error, fallbackCode) {
  const code = startupCode(error?.code);
  if (code !== "STARTUP_FAILED" && code !== "POSTGRES_INIT_FAILED") return code;
  // The dependency wraps initdb exits as a message. Match only its fixed prefix;
  // classify buffered stderr locally, never emit any of its text or paths.
  try {
    const text = typeof error?.message === "string" ? error.message.slice(0, 65536) : "";
    if (text.startsWith("Postgres init script exited with code ")) {
      if (/code signature|signature.*invalid|not valid for use in process/i.test(text)) return "POSTGRES_SIGNATURE_INVALID";
      if (/Library not loaded:|image not found|cannot open shared object file/i.test(text)) return "POSTGRES_LIBRARY_MISSING";
      if (/invalid locale|locale.*not supported|could not set locale/i.test(text)) return "POSTGRES_LOCALE_INVALID";
      if (/cannot be run as root/i.test(text)) return "POSTGRES_ROOT_REFUSED";
      if (/permission denied|operation not permitted/i.test(text)) return "POSTGRES_PERMISSION_DENIED";
      return "POSTGRES_INIT_FAILED";
    }
  } catch { /* Fall through to a fixed stage code. */ }
  if (code === "POSTGRES_INIT_FAILED") {
    return code;
  }
  const stageCode = startupCode(fallbackCode);
  if (stageCode === "POSTGRES_MIGRATION_FAILED") {
    const sqlState = typeof error?.code === "string" ? error.code : "";
    if (/^08[A-Z0-9]{3}$/.test(sqlState)) return "POSTGRES_MIGRATION_CONNECTION_FAILED";
    if (/^28[A-Z0-9]{3}$/.test(sqlState)) return "POSTGRES_MIGRATION_AUTH_FAILED";
    if (/^(?:42P01|42703|42704|42883|3D000|3F000)$/.test(sqlState)) return "POSTGRES_MIGRATION_SCHEMA_FAILED";
    if (/^23[A-Z0-9]{3}$/.test(sqlState)) return "POSTGRES_MIGRATION_CONSTRAINT_FAILED";
    if (sqlState === "0A000") return "POSTGRES_MIGRATION_FEATURE_UNSUPPORTED";
    if (sqlState === "58P01") return "POSTGRES_MIGRATION_FILE_MISSING";
  }
  return stageCode === "STARTUP_FAILED" ? code : stageCode;
}
function startupFailureLine(code) { return `BOSTAN_DESKTOP_STARTUP_FAILURE ${startupCode(code)}`; }
function startupFailureIssue(error, fallbackCode) {
  if (startupCode(error?.code ?? fallbackCode) !== "POSTGRES_START_FAILED") return null;
  try {
    if (postgresStartupIssues.has(error?.postgresStartupIssue)) return error.postgresStartupIssue;
    const message = typeof error?.message === "string" ? error.message.slice(0, 65536) : "";
    // The backend attaches only a bounded in-memory tail of PostgreSQL output
    // to its startup error. Convert recognized causes to fixed codes here;
    // never include log text, paths, or connection details in the receipt.
    if (/address already in use|could not bind.*(?:socket|address)/i.test(message)) return "POSTGRES_START_ADDRESS_IN_USE";
    if (/permission denied|access is denied|could not access the data directory|could not open.*(?:directory|postmaster\.pid)/i.test(message)) return "POSTGRES_START_DATA_DIRECTORY_DENIED";
    if (/invalid locale|locale.*not supported|could not set locale/i.test(message)) return "POSTGRES_START_LOCALE_INVALID";
    if (/could not load library|could not access file|entry point.*not found|module could not be found/i.test(message)) return "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING";
    if (/pg_trgm|fuzzystrmatch|extension control file|extension script file/i.test(message)) return "POSTGRES_START_EXTENSION_MISSING";
    if (/shared memory|could not create.*memory/i.test(message)) return "POSTGRES_START_SHARED_MEMORY_FAILED";
    if (/no space left on device|not enough space|disk is full/i.test(message)) return "POSTGRES_START_DISK_FULL";
    if (/database files are incompatible with server|database system identifier differs|wrong database system identifier/i.test(message)) return "POSTGRES_START_CLUSTER_INCOMPATIBLE";
    if (/invalid value for parameter|unrecognized configuration parameter|could not open configuration file|configuration file contains errors/i.test(message)) return "POSTGRES_START_CONFIGURATION_INVALID";
    if (/could not locate a valid checkpoint record|invalid primary checkpoint record|redo is not required/i.test(message)) return "POSTGRES_START_RECOVERY_FAILED";
    const processExit = message.match(/Postgres server exited before readiness \(exitCode=(null|0|[1-9]\d{0,2}), signal=(?:none|SIG[A-Z]+)\)/);
    if (processExit) return `POSTGRES_START_PROCESS_EXIT_CODE_${processExit[1]}`;
    if (/Postgres server failed to spawn \(code ENOENT\)/i.test(message)) return "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING";
    if (/Postgres server failed to spawn \(code (?:EACCES|EPERM)\)/i.test(message)) return "POSTGRES_START_PROCESS_LAUNCH_FAILED";
    if (/start script exited|process exited before|server process.*exited|server exited before readiness/i.test(message)) return "POSTGRES_START_PROCESS_EXITED";
  } catch { /* Keep startup reporting on the fixed fallback classification. */ }
  return "POSTGRES_START_UNCLASSIFIED";
}
function startupFailureIssueLine(issue) {
  return postgresStartupIssues.has(issue) || /^POSTGRES_START_PROCESS_EXIT_CODE_(?:null|0|[1-9]\d{0,2})$/.test(issue)
    ? `BOSTAN_DESKTOP_STARTUP_ISSUE ${issue}` : null;
}
function startupFailureLibrary(error) {
  if (startupErrorCode(error) !== "POSTGRES_LIBRARY_MISSING") return null;
  try {
    const text = typeof error?.message === "string" ? error.message.slice(0, 65536) : "";
    // macOS versions and nested loaders vary in how they phrase dyld failures.
    // Inspect only the loader line that caused the fixed POSTGRES_LIBRARY_MISSING
    // classification, then emit a library basename (never a path or stderr).
    const line = text.split(/\r?\n/).find(value => /Library not loaded:|image not found|cannot open shared object file/i.test(value));
    const basename = line?.match(/\blib[A-Za-z0-9_.+-]{1,100}\.dylib\b/i)?.[0];
    return typeof basename === "string" && /^lib[A-Za-z0-9_.+-]{1,100}\.dylib$/i.test(basename) ? basename : null;
  } catch { return null; }
}
function startupFailureLibraryLine(library) {
  return typeof library === "string" && /^lib[A-Za-z0-9_.+-]{1,100}\.dylib$/.test(library)
    ? `BOSTAN_DESKTOP_STARTUP_LIBRARY ${library}` : null;
}
function startupMigrationLine(migration) {
  return typeof migration === "string" && /^\d{4}_[a-z0-9_]+\.sql$/.test(migration)
    ? `BOSTAN_DESKTOP_STARTUP_MIGRATION ${migration}` : null;
}
function startupMigrationIssue(error, migration) {
  if (migration !== "0080_company_search_fuzzystrmatch.sql") return null;
  let message = "";
  try {
    const fields = [error?.message, error?.detail, error?.hint, error?.file, error?.routine];
    message = fields.filter(value => typeof value === "string").join("\n").slice(0, 8192);
  }
  catch { return null; }
  if (/fuzzystrmatch\.control|extension control file/i.test(message)) return "POSTGRES_EXTENSION_CONTROL_FILE_MISSING";
  if (/fuzzystrmatch[^\r\n]*\.sql|extension script file/i.test(message)) return "POSTGRES_EXTENSION_SQL_FILE_MISSING";
  if (/fuzzystrmatch\.dll|\$libdir|could not access file|could not load library/i.test(message)) return "POSTGRES_EXTENSION_LIBRARY_MISSING";
  if (/could not open file/i.test(message)) return "POSTGRES_MIGRATION_FILE_MISSING";
  if (error?.code === "58P01") return "POSTGRES_EXTENSION_FILE_LOOKUP_FAILED";
  return null;
}
const migrationIssues = new Set([
  "POSTGRES_EXTENSION_CONTROL_FILE_MISSING", "POSTGRES_EXTENSION_SQL_FILE_MISSING",
  "POSTGRES_EXTENSION_LIBRARY_MISSING", "POSTGRES_MIGRATION_FILE_MISSING",
  "POSTGRES_EXTENSION_FILE_LOOKUP_FAILED",
]);
function startupMigrationIssueLine(migration, issue) {
  return startupMigrationLine(migration) && migrationIssues.has(issue)
    ? `BOSTAN_DESKTOP_STARTUP_MIGRATION_ISSUE ${issue}` : null;
}
const sitePattern = /^BOSTAN_DESKTOP_STARTUP_SITE (?:server|config|signing):[1-9]\d{0,5}:[1-9]\d{0,5}$/;
function startupFailureSite(error, runtimeRoot) {
  // Only code locations in three known startup modules may leave this process.
  // Never expose the raw message, stack, function names or absolute paths.
  try {
    if (typeof error?.stack !== "string") return null;
    const prefixes = ["dist", "dist-runtime"].map(directory =>
      pathToFileURL(path.join(runtimeRoot, directory) + path.sep).href
        .replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"));
    const frame = new RegExp(`^\\s+at (?:[^\\r\\n]*?\\()?(${prefixes.join("|")})(index\\.js|server\\.mjs|config\\.js|services/decision-signing\\.js):([1-9]\\d{0,5}):([1-9]\\d{0,5})\\)?$`);
    for (const line of error.stack.slice(0, 8192).split(/\r?\n/).slice(0, 32)) {
      const match = frame.exec(line);
      if (!match) continue;
      const module = { "index.js": "server", "server.mjs": "server", "config.js": "config", "services/decision-signing.js": "signing" }[match[2]];
      return `BOSTAN_DESKTOP_STARTUP_SITE ${module}:${match[3]}:${match[4]}`;
    }
  } catch { /* Optional diagnosis cannot replace the original startup failure. */ }
  return null;
}
function isStartupSiteLine(line) { return typeof line === "string" && !/[\r\n]/.test(line) && sitePattern.test(line); }
function isStartupDiagnosticLine(line) {
  if (typeof line !== "string") return false;
  if (isStartupSiteLine(line)) return true;
  if (line.startsWith("BOSTAN_DESKTOP_STARTUP_ISSUE ")
      && startupFailureIssueLine(line.slice("BOSTAN_DESKTOP_STARTUP_ISSUE ".length)) === line) return true;
  if (startupMigrationLine(line.startsWith("BOSTAN_DESKTOP_STARTUP_MIGRATION ") ? line.slice("BOSTAN_DESKTOP_STARTUP_MIGRATION ".length) : null) === line) return true;
  if (line.startsWith("BOSTAN_DESKTOP_STARTUP_MIGRATION_ISSUE ")
      && migrationIssues.has(line.slice("BOSTAN_DESKTOP_STARTUP_MIGRATION_ISSUE ".length))) return true;
  const phasePrefix = "BOSTAN_DESKTOP_STARTUP_PHASE ";
  const phase = line.startsWith(phasePrefix) ? line.slice(phasePrefix.length) : null;
  if (phase !== null) return phases.has(phase);
  const prefix = "BOSTAN_DESKTOP_STARTUP_FAILURE ";
  if (line.startsWith(prefix) && codes.has(line.slice(prefix.length))) return true;
  const libraryPrefix = "BOSTAN_DESKTOP_STARTUP_LIBRARY ";
  return line.startsWith(libraryPrefix) && startupFailureLibraryLine(line.slice(libraryPrefix.length)) === line;
}
module.exports = { startupPhaseLine, startupCode, startupErrorCode, startupFailureLine, startupFailureIssue, startupFailureIssueLine, startupFailureLibrary, startupFailureLibraryLine, startupMigrationLine, startupMigrationIssue, startupMigrationIssueLine, startupFailureSite, isStartupSiteLine, isStartupDiagnosticLine };
