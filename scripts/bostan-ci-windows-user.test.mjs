import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Windows CI receipt allowlist admits only fixed startup failure codes", () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, "bostan-ci-windows-user.ps1"), "utf8");
  const match = source.match(/^\s*if \(\$line -match '([^']*BOSTAN_DESKTOP_STARTUP_FAILURE[^']*)'\) \{ return \$line \}$/m);
  assert.ok(match, "Windows CI startup failure receipt allowlist is present");
  const receiptPattern = new RegExp(match[1]);
  for (const code of [
    "STARTUP_FAILED", "STARTUP_TIMEOUT", "BACKEND_EXITED", "RUNTIME_MISSING", "ERR_MODULE_NOT_FOUND",
    "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_UNKNOWN_FILE_EXTENSION", "ERR_DLOPEN_FAILED", "ERR_REQUIRE_ESM",
    "ERR_INVALID_PACKAGE_CONFIG", "EACCES", "EPERM", "ENOENT", "EADDRINUSE", "POSTGRES_LIBRARY_MISSING",
    "POSTGRES_SIGNATURE_INVALID", "POSTGRES_LOCALE_INVALID", "POSTGRES_PERMISSION_DENIED", "POSTGRES_ROOT_REFUSED",
    "POSTGRES_INIT_FAILED", "POSTGRES_START_FAILED", "POSTGRES_DATABASE_FAILED", "POSTGRES_MIGRATION_FAILED",
    "POSTGRES_MIGRATION_CONNECTION_FAILED", "POSTGRES_MIGRATION_AUTH_FAILED", "POSTGRES_MIGRATION_SCHEMA_FAILED",
    "POSTGRES_MIGRATION_CONSTRAINT_FAILED", "POSTGRES_MIGRATION_FEATURE_UNSUPPORTED", "POSTGRES_MIGRATION_FILE_MISSING",
    "POSTGRES_BOOTSTRAP_FAILED", "DATABASE_BOOTSTRAP_FAILED", "DATABASE_MIGRATION_FAILED",
    "SERVER_INSTRUMENTATION_FAILED", "SERVER_ERROR_MONITORING_FAILED", "SERVER_SIGNING_SECRET_FAILED",
    "SERVER_CONFIG_FAILED", "SERVER_RUNTIME_INITIALIZATION_FAILED", "SERVER_STARTUP_FAILED",
  ]) assert.equal(receiptPattern.test(`BOSTAN_DESKTOP_STARTUP_FAILURE ${code}`), true, code);
  assert.equal(receiptPattern.test("BOSTAN_DESKTOP_STARTUP_FAILURE PRIVATE_SECRET"), false);
});

test("CI account launcher refuses an operator PC before any account or fixture creation", { skip: process.platform !== "win32" }, () => {
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-File", path.join(import.meta.dirname, "bostan-ci-windows-user.ps1")], {
    env: { ...process.env, CI: "false", GITHUB_ACTIONS: "false" }, windowsHide: true, encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 2, JSON.stringify({ error: result.error?.message, signal: result.signal, stderr: result.stderr }));
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /requires a disposable GitHub Actions runner/);
});
