import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import diagnostics from "./startup-diagnostics.cjs";

test("startup sites disclose only a fixed module identity and bounded line numbers", () => {
  const root = path.resolve("synthetic runtime");
  const entry = pathToFileURL(path.join(root, "dist/index.js")).href;
  const error = { stack: `Error: https://user:secret@example.test\n    at privateFunction (${entry}:123:45)` };
  const line = diagnostics.startupFailureSite(error, root);
  assert.equal(line, "BOSTAN_DESKTOP_STARTUP_SITE server:123:45");
  assert.equal(diagnostics.isStartupDiagnosticLine(line), true);
  assert.equal(diagnostics.startupFailureSite({ stack: error.stack.replace("index.js", "private-file.js") }, root), null);
  assert.equal(diagnostics.startupFailureSite(error, path.resolve("different-root")), null);
  const bundled = pathToFileURL(path.join(root, "dist-runtime/server.mjs")).href;
  assert.equal(diagnostics.startupFailureSite({ stack: `Error: private\n    at privateFunction (${bundled}:234:56)` }, root),
    "BOSTAN_DESKTOP_STARTUP_SITE server:234:56");
  assert.equal(diagnostics.startupFailureSite({ get stack() { throw Error("private"); } }, root), null);
  for (const suffix of ["server:123:45 secret", "private:123:45", "server:0:1", "server:1234567:1", "server:1:1\nsecret", "server:1:1\n", "server:1:1\r"]) {
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_SITE " + suffix), false);
  }
});

test("startup receipts accept only fixed phases and failure codes", () => {
  assert.equal(diagnostics.startupPhaseLine("importing_server"), "BOSTAN_DESKTOP_STARTUP_PHASE importing_server");
  assert.equal(diagnostics.isStartupDiagnosticLine(diagnostics.startupPhaseLine("importing_server")), true);
  assert.equal(diagnostics.startupFailureLine("ERR_MODULE_NOT_FOUND"), "BOSTAN_DESKTOP_STARTUP_FAILURE ERR_MODULE_NOT_FOUND");
  assert.equal(diagnostics.isStartupDiagnosticLine(diagnostics.startupFailureLine("EPERM")), true);
  assert.equal(diagnostics.startupFailureLine("POSTGRES_START_FAILED"), "BOSTAN_DESKTOP_STARTUP_FAILURE POSTGRES_START_FAILED");
  assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_FAILURE POSTGRES_START_FAILED"), true);
  assert.equal(diagnostics.startupFailureStageLine("SERVER_CONFIG_FAILED"), "BOSTAN_DESKTOP_STARTUP_STAGE SERVER_CONFIG_FAILED");
  assert.equal(diagnostics.startupFailureStageLine("private stage"), "BOSTAN_DESKTOP_STARTUP_STAGE STARTUP_FAILED");
  assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_STAGE SERVER_CONFIG_FAILED"), true);
  assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_STAGE SERVER_CONFIG_FAILED\nprivate"), false);
  const postgresIssue = diagnostics.startupFailureIssue(Object.assign(
    new Error('Failed to start embedded PostgreSQL. Recent logs: FATAL: could not bind IPv4 address "127.0.0.1": Address already in use'),
    { code: "POSTGRES_START_FAILED" },
  ), "POSTGRES_START_FAILED");
  assert.equal(postgresIssue, "POSTGRES_START_ADDRESS_IN_USE");
  const processExitIssue = diagnostics.startupFailureIssue(Object.assign(
    new Error("Postgres server exited before readiness (exitCode=1, signal=none). Recent logs: selecting dynamic shared memory implementation \"windows\""),
    { code: "POSTGRES_START_FAILED", postgresStartupIssue: "POSTGRES_START_LOGS_UNCLASSIFIED" },
  ), "POSTGRES_START_FAILED");
  assert.equal(processExitIssue, "POSTGRES_START_PROCESS_EXIT_CODE_1");
  assert.equal(diagnostics.isStartupDiagnosticLine(diagnostics.startupFailureIssueLine(processExitIssue)), true);
  const sharedMemoryOsIssue = "POSTGRES_START_SHARED_MEMORY_OS_ERROR_1455";
  const sharedMemoryOsLine = diagnostics.startupFailureIssueLine(sharedMemoryOsIssue);
  assert.equal(sharedMemoryOsLine, `BOSTAN_DESKTOP_STARTUP_ISSUE ${sharedMemoryOsIssue}`);
  assert.equal(diagnostics.isStartupDiagnosticLine(sharedMemoryOsLine), true);
  assert.equal(diagnostics.startupFailureIssueLine("POSTGRES_START_SHARED_MEMORY_OS_ERROR_99999"), null);
  assert.equal(diagnostics.startupFailureIssue(Object.assign(new Error("Postgres server exited before readiness (exitCode=1, signal=none)."), {
    code: "POSTGRES_START_FAILED", postgresStartupIssue: "POSTGRES_START_LOGS_EMPTY",
  }), "POSTGRES_START_FAILED"), "POSTGRES_START_PROCESS_EXIT_CODE_1");
  const postgresLogCases = [
    ["Recent embedded Postgres logs: FATAL: The server must be started under an unprivileged user ID", "POSTGRES_START_ROOT_REFUSED"],
    ['Recent embedded Postgres logs: FATAL: could not access file "$libdir/private-extension"', "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING"],
    ["Recent embedded Postgres logs: FATAL: could not create shared memory segment", "POSTGRES_START_SHARED_MEMORY_FAILED"],
    ["Recent embedded Postgres logs: FATAL: invalid value for parameter \"private_setting\"", "POSTGRES_START_CONFIGURATION_INVALID"],
    ["Recent embedded Postgres logs: FATAL: database files are incompatible with server", "POSTGRES_START_CLUSTER_INCOMPATIBLE"],
    ["Recent embedded Postgres logs: FATAL: could not write file \"C:\\private\\base\": No space left on device", "POSTGRES_START_DISK_FULL"],
    ["Recent embedded Postgres logs: PANIC: could not locate a valid checkpoint record", "POSTGRES_START_RECOVERY_FAILED"],
  ];
  for (const [privateMessage, expectedIssue] of postgresLogCases) {
    const issue = diagnostics.startupFailureIssue(Object.assign(new Error(`${privateMessage}; host C:\\Users\\secret`), { code: "POSTGRES_START_FAILED" }), "POSTGRES_START_FAILED");
    assert.equal(issue, expectedIssue);
    const receipt = diagnostics.startupFailureIssueLine(issue);
    assert.equal(diagnostics.isStartupDiagnosticLine(receipt), true);
    assert.equal(receipt.includes("private"), false);
    assert.equal(receipt.includes("secret"), false);
  }
  assert.equal(diagnostics.startupFailureIssue(Object.assign(
    new Error("Postgres server exited before readiness (exitCode=1, signal=none)."),
    { code: "POSTGRES_START_FAILED" },
  ), "POSTGRES_START_FAILED"), "POSTGRES_START_PROCESS_EXIT_CODE_1");
  assert.equal(diagnostics.startupFailureIssueLine("POSTGRES_START_PROCESS_EXIT_CODE_1"),
    "BOSTAN_DESKTOP_STARTUP_ISSUE POSTGRES_START_PROCESS_EXIT_CODE_1");
  assert.equal(diagnostics.startupFailureIssueLine("POSTGRES_START_PROCESS_EXIT_CODE_9999"), null);
  assert.equal(diagnostics.startupFailureIssue(Object.assign(
    new Error("Postgres server failed to spawn (code ENOENT)."),
    { code: "POSTGRES_START_FAILED" },
  ), "POSTGRES_START_FAILED"), "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING");
  assert.equal(diagnostics.startupFailureIssue(Object.assign(
    new Error("Postgres server failed to spawn (code EACCES)."),
    { code: "POSTGRES_START_FAILED" },
  ), "POSTGRES_START_FAILED"), "POSTGRES_START_PROCESS_LAUNCH_FAILED");
  const postgresIssueLine = diagnostics.startupFailureIssueLine(postgresIssue);
  assert.equal(postgresIssueLine, "BOSTAN_DESKTOP_STARTUP_ISSUE POSTGRES_START_ADDRESS_IN_USE");
  assert.equal(diagnostics.isStartupDiagnosticLine(postgresIssueLine), true);
  assert.equal(diagnostics.startupFailureIssue(Object.assign(new Error("private C:\\Users\\secret"), { code: "POSTGRES_START_FAILED" }), "POSTGRES_START_FAILED"), "POSTGRES_START_UNCLASSIFIED");
  assert.equal(diagnostics.startupFailureIssue(new Error("private unexpected startup error"), undefined), "SERVER_STARTUP_ERROR_ERROR");
  assert.equal(diagnostics.startupFailureIssueLine("SERVER_STARTUP_ERROR_ERROR"), "BOSTAN_DESKTOP_STARTUP_ISSUE SERVER_STARTUP_ERROR_ERROR");
  const typedFailure = Object.assign(new TypeError("private C:\\Users\\secret"), { code: "UNSAFE_PRIVATE_CODE" });
  assert.equal(diagnostics.startupFailureIssue(typedFailure, undefined), "SERVER_STARTUP_ERROR_TYPEERROR");
  assert.equal(diagnostics.startupFailureIssueLine("SERVER_STARTUP_ERROR_TYPEERROR"), "BOSTAN_DESKTOP_STARTUP_ISSUE SERVER_STARTUP_ERROR_TYPEERROR");
  assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_ISSUE SERVER_STARTUP_ERROR_TYPEERROR"), true);
  assert.equal(diagnostics.startupFailureIssue({ name: "SecretCustomError", message: "private" }, undefined), "SERVER_STARTUP_UNCLASSIFIED");
  assert.equal(diagnostics.startupFailureIssueLine("SERVER_STARTUP_UNCLASSIFIED"), "BOSTAN_DESKTOP_STARTUP_ISSUE SERVER_STARTUP_UNCLASSIFIED");
  assert.equal(diagnostics.startupFailureIssueLine("POSTGRES_START_UNCLASSIFIED\nC:\\private"), null);
  assert.equal(diagnostics.startupErrorCode(Object.assign(new Error("private database detail"), { code: "POSTGRES_DATABASE_FAILED" })), "POSTGRES_DATABASE_FAILED");
  assert.equal(diagnostics.startupFailureLine("POSTGRES_MIGRATION_FAILED"), "BOSTAN_DESKTOP_STARTUP_FAILURE POSTGRES_MIGRATION_FAILED");
  const migrationLine = diagnostics.startupMigrationLine("0123_safe_name.sql");
  assert.equal(migrationLine, "BOSTAN_DESKTOP_STARTUP_MIGRATION 0123_safe_name.sql");
  assert.equal(diagnostics.isStartupDiagnosticLine(migrationLine), true);
  assert.equal(diagnostics.startupMigrationIssue({ message: 'could not open extension control file "private/path/fuzzystrmatch.control"' }, "0080_company_search_fuzzystrmatch.sql"), "POSTGRES_EXTENSION_CONTROL_FILE_MISSING");
  assert.equal(diagnostics.startupMigrationIssue({ message: 'could not access file "$libdir/fuzzystrmatch": No such file' }, "0080_company_search_fuzzystrmatch.sql"), "POSTGRES_EXTENSION_LIBRARY_MISSING");
  assert.equal(diagnostics.startupMigrationIssue({ message: "private detail" }, "0080_company_search_fuzzystrmatch.sql"), null);
  assert.equal(diagnostics.startupMigrationIssue({ code: "58P01", message: "opaque backend detail" }, "0080_company_search_fuzzystrmatch.sql"), "POSTGRES_EXTENSION_FILE_LOOKUP_FAILED");
  assert.equal(diagnostics.startupMigrationIssue({ message: 'could not open extension control file' }, "other_migration.sql"), null);
  assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_MIGRATION_ISSUE POSTGRES_EXTENSION_LIBRARY_MISSING"), true);
  for (const unsafe of ["../../secret.sql", "0123_name;SECRET.sql", "0123_Name.sql", "0123_name.sql\\nsecret"]) {
    assert.equal(diagnostics.startupMigrationLine(unsafe), null);
  }
  const frozenNativeFailure = Object.freeze({ code: "28P01" });
  assert.equal(diagnostics.startupErrorCode(frozenNativeFailure, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_AUTH_FAILED");
  assert.equal(diagnostics.startupErrorCode({ code: "08006" }, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_CONNECTION_FAILED");
  assert.equal(diagnostics.startupErrorCode({ code: "42P01" }, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_SCHEMA_FAILED");
  assert.equal(diagnostics.startupErrorCode({ code: "42601" }, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_FAILED");
  assert.equal(diagnostics.startupErrorCode({ code: "0A000" }, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_FEATURE_UNSUPPORTED");
  assert.equal(diagnostics.startupErrorCode({ code: "58P01" }, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_FILE_MISSING");
  assert.equal(diagnostics.startupErrorCode({ code: "23505" }, "POSTGRES_MIGRATION_FAILED"), "POSTGRES_MIGRATION_CONSTRAINT_FAILED");
  assert.equal(diagnostics.startupErrorCode({ code: "EACCES" }, "POSTGRES_MIGRATION_FAILED"), "EACCES");
});

test("wrapped PostgreSQL initialization failures disclose only a fixed reason", () => {
  const prefix = "Postgres init script exited with code 1. Recent embedded Postgres logs: ";
  const cases = [
    ["Library not loaded: /private/SECRET/lib.dylib", "POSTGRES_LIBRARY_MISSING"],
    ["code signature invalid in /private/SECRET/lib.dylib", "POSTGRES_SIGNATURE_INVALID"],
    ["invalid locale name: SECRET", "POSTGRES_LOCALE_INVALID"],
    ["cannot be run as root SECRET", "POSTGRES_ROOT_REFUSED"],
    ["Permission denied /private/SECRET", "POSTGRES_PERMISSION_DENIED"],
    ["arbitrary private SECRET diagnostic", "POSTGRES_INIT_FAILED"],
  ];
  for (const [message, expected] of cases) {
    const code = diagnostics.startupErrorCode(new Error(prefix + message));
    assert.equal(code, expected);
    const line = diagnostics.startupFailureLine(code);
    assert.equal(diagnostics.isStartupDiagnosticLine(line), true);
    assert.equal(line.includes("SECRET"), false);
  }
  assert.equal(diagnostics.startupErrorCode(Object.assign(new Error(prefix + "Permission denied /private/SECRET"), { code: "POSTGRES_INIT_FAILED" })), "POSTGRES_PERMISSION_DENIED");
  assert.equal(diagnostics.startupErrorCode(Object.assign(new Error(prefix + "arbitrary private SECRET diagnostic"), { code: "POSTGRES_INIT_FAILED" })), "POSTGRES_INIT_FAILED");
  assert.equal(diagnostics.startupErrorCode(new Error("Library not loaded: private unrelated failure")), "STARTUP_FAILED");
  assert.equal(diagnostics.startupErrorCode(Object.assign(new Error(prefix), { code: "ENOENT" })), "ENOENT");
});

test("PostgreSQL loader failure receipts expose only the missing library basename", () => {
  const cases = [
    ["Library not loaded: @loader_path/../lib/libicui18n.dylib, referenced from: /private/secret/postgres", "libicui18n.dylib"],
    ["dyld: library not loaded: '/private/secret/libpq.5.dylib'", "libpq.5.dylib"],
    ["dlopen failed: image not found for /private/secret/libintl.dylib", "libintl.dylib"],
  ];
  for (const [loaderLine, expected] of cases) {
    const failure = new Error("Postgres init script exited with code 1. Recent embedded Postgres logs: " + loaderLine);
    assert.equal(diagnostics.startupFailureLibrary(failure), expected);
  }
  assert.equal(diagnostics.startupFailureLibraryLine("libicui18n.dylib"), "BOSTAN_DESKTOP_STARTUP_LIBRARY libicui18n.dylib");
  assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_LIBRARY libicui18n.dylib"), true);
  assert.equal(diagnostics.startupFailureLibrary(new Error("private path /secret/libanything.dylib")), null);
  for (const value of ["../../secret.dylib", "libfoo.dylib\nsecret", "https://private.example/libfoo.dylib", "libfoo.dylib:/secret"]) {
    assert.equal(diagnostics.startupFailureLibraryLine(value), null);
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_LIBRARY " + value), false);
  }
});
test("arbitrary dependency errors and forged multiline receipts disclose no raw data", () => {
  for (const value of ["https://user:secret@example.test", "C:\\private\\fixture", "ERR_PRIVATE_SECRET", "ready\nsecret"]) {
    assert.equal(diagnostics.startupPhaseLine(value), null);
    assert.equal(diagnostics.startupCode(value), "STARTUP_FAILED");
    assert.equal(diagnostics.startupFailureLine(value).includes(value), false);
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_PHASE " + value), false);
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_FAILURE " + value), false);
  }
});
