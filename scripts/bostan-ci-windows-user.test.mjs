import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Windows CI receipt allowlist admits only fixed startup failure codes", () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, "bostan-ci-windows-user.ps1"), "utf8");
  const match = source.match(/^\s*if \(\$line -match '([^']*BOSTAN_DESKTOP_STARTUP_FAILURE[^']*)'\) \{ return \$line \}$/m);
  const stageMatch = source.match(/^\s*if \(\$line -match '([^']*BOSTAN_DESKTOP_STARTUP_STAGE[^']*)'\) \{ return \$line \}$/m);
  assert.ok(match, "Windows CI startup failure receipt allowlist is present");
  assert.ok(stageMatch, "Windows CI startup stage receipt allowlist is present");
  const receiptPattern = new RegExp(match[1]);
  const stagePattern = new RegExp(stageMatch[1]);
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
  ]) {
    assert.equal(receiptPattern.test(`BOSTAN_DESKTOP_STARTUP_FAILURE ${code}`), true, code);
    assert.equal(stagePattern.test(`BOSTAN_DESKTOP_STARTUP_STAGE ${code}`), true, code);
  }
  assert.equal(receiptPattern.test("BOSTAN_DESKTOP_STARTUP_FAILURE PRIVATE_SECRET"), false);
  assert.equal(stagePattern.test("BOSTAN_DESKTOP_STARTUP_STAGE PRIVATE_SECRET"), false);
});

test("native model setup exposes only bounded fixed phase, failure and progress receipts", () => {
  const wrapper = fs.readFileSync(path.join(import.meta.dirname, "bostan-ci-windows-user.ps1"), "utf8");
  const setup = fs.readFileSync(path.join(import.meta.dirname, "bostan-windows-local-native-qa.ps1"), "utf8");
  const phaseMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_PHASE[^']*)'\) \{ return \$line \}$/m);
  const failureMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_FAILURE[^']*)'\) \{ return \$line \}$/m);
  const progressMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_MODEL_PULL_WAIT[^']*)'\) \{ return \$line \}$/m);
  assert.ok(phaseMatch, "native setup phase allowlist is present");
  assert.ok(failureMatch, "native setup failure allowlist is present");
  assert.ok(progressMatch, "native model pull progress allowlist is present");
  const phasePattern = new RegExp(phaseMatch[1]);
  const failurePattern = new RegExp(failureMatch[1]);
  const progressPattern = new RegExp(progressMatch[1]);
  for (const phase of [
    "ollama_download_begin", "ollama_download_complete", "ollama_archive_verified", "ollama_server_ready",
    "qwen_model_pull_begin", "qwen_model_pull_complete", "qwen_model_manifest_verified", "qwen_model_license_verified",
  ]) assert.equal(phasePattern.test(`BOSTAN_NATIVE_WINDOWS_PHASE ${phase}`), true, phase);
  assert.equal(phasePattern.test("BOSTAN_NATIVE_WINDOWS_PHASE C:\\Users\\secret"), false);
  for (const stage of [
    "ollama_download", "ollama_archive_verify", "ollama_server_start", "qwen_model_pull",
    "qwen_model_manifest_verify", "qwen_model_license_verify", "host_resource_verify", "installed_app_qualification",
  ]) assert.equal(failurePattern.test(`BOSTAN_NATIVE_WINDOWS_FAILURE ${stage}`), true, stage);
  assert.equal(failurePattern.test("BOSTAN_NATIVE_WINDOWS_FAILURE C:\\Users\\secret"), false);
  assert.equal(progressPattern.test("BOSTAN_NATIVE_MODEL_PULL_WAIT elapsedSeconds=120 outputProgress=advanced"), true);
  assert.equal(progressPattern.test("BOSTAN_NATIVE_MODEL_PULL_WAIT elapsedSeconds=120 outputProgress=stalled"), true);
  assert.equal(progressPattern.test("BOSTAN_NATIVE_MODEL_PULL_WAIT elapsedSeconds=120 outputProgress=C:\\secret"), false);
  for (const phase of [
    "ollama_download_begin", "ollama_download_complete", "ollama_archive_verified", "ollama_server_ready",
    "qwen_model_pull_begin", "qwen_model_pull_complete", "qwen_model_manifest_verified", "qwen_model_license_verified",
  ]) assert.match(setup, new RegExp(`BOSTAN_NATIVE_WINDOWS_PHASE ${phase}`), phase);
  for (const stage of [
    "ollama_download", "ollama_archive_verify", "ollama_server_start", "qwen_model_pull",
    "qwen_model_manifest_verify", "qwen_model_license_verify", "host_resource_verify", "installed_app_qualification",
  ]) assert.ok(setup.includes(`$stage = '${stage}'`), stage);
  assert.ok(setup.includes('Write-Output "BOSTAN_NATIVE_WINDOWS_FAILURE $stage"'));
  assert.match(setup, /outputLength -gt 1048576/, "model pull log collection stays capped");
  assert.match(setup, /taskkill\.exe \/PID \$modelPull\.Id \/T \/F/, "cleanup targets only the owned pull process tree");
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
