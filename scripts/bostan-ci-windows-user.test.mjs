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

test("Windows CI forwards only bounded packaged first-agent stage and failure receipts", () => {
  const wrapper = fs.readFileSync(path.join(import.meta.dirname, "bostan-ci-windows-user.ps1"), "utf8");
  const harness = fs.readFileSync(path.join(import.meta.dirname, "bostan-windows-packaged-free-first-agent-qa.mjs"), "utf8");
  const match = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_PACKAGED_FIRST_AGENT_FAIL[^']*)'\) \{ return \$line \}$/m);
  assert.ok(match, "packaged first-agent failure receipt allowlist is present");
  const receiptPattern = new RegExp(match[1]);
  for (const stage of [
    "model_admission", "desktop_startup", "signup", "first_admin", "company_create", "agent_create",
    "agent_readiness", "first_task_create", "first_task_assignment", "first_task_execution",
    "first_task_persistence", "restart_recovery", "second_task_create", "second_task_assignment",
    "second_task_execution", "second_task_persistence", "cancellation_create", "cancellation_settlement",
    "recovery_task_create", "recovery_task_assignment", "recovery_task_execution", "recovery_task_persistence",
    "shutdown", "cleanup", "unclassified",
  ]) {
    assert.equal(receiptPattern.test(`BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=${stage} code=synthetic_company_create_failed_http_500`), true, stage);
  }
  assert.equal(receiptPattern.test("BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=company_create code=heartbeat_not_succeeded"), true);
  assert.equal(receiptPattern.test("BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=agent_readiness code=native_agent_setup_harness_test_failed"), true);
  assert.equal(receiptPattern.test("BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=agent_readiness code=native_agent_readiness_timeout"), true);
  assert.equal(receiptPattern.test("BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=cleanup code=qa_process_still_owns_temp_profile"), true);
  assert.equal(receiptPattern.test("BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=company_create code=sk_private_token"), false);
  assert.equal(receiptPattern.test("BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=C:\\Users\\private code=secret"), false);
  assert.match(harness, /console\.log\(receipt\)/, "safe failure receipt goes through the wrapper's stdout filter");
  assert.match(harness, /captureFirstAgentFailure\(firstFailure, qualificationStage, error\)/, "the original failure stage is captured before shutdown and cleanup");
  assert.match(harness, /packagedFirstAgentFailureReceipt\(firstFailure\.stage, firstFailure\.error\)/, "the first failure stage and safe code reach the bounded classifier");
});

test("native model setup exposes only bounded fixed phase, failure and progress receipts", () => {
  const wrapper = fs.readFileSync(path.join(import.meta.dirname, "bostan-ci-windows-user.ps1"), "utf8");
  const setup = fs.readFileSync(path.join(import.meta.dirname, "bostan-windows-local-native-qa.ps1"), "utf8");
  const modelPullRunner = fs.readFileSync(path.join(import.meta.dirname, "bostan-windows-native-model-pull.mjs"), "utf8");
  const phaseMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_PHASE[^']*)'\) \{ return \$line \}$/m);
  const failureMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_FAILURE[^']*)'\) \{ return \$line \}$/m);
  const progressMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_MODEL_PULL_WAIT[^']*)'\) \{ return \$line \}$/m);
  const resultMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_MODEL_PULL_RESULT[^']*)'\) \{ return \$line \}$/m);
  const cleanupIncompleteMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_CLEANUP_INCOMPLETE[^']*)'\) \{ return \$line \}$/m);
  const operationFailureMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE[^']*)'\) \{ return \$line \}$/m);
  const archiveMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_ARCHIVE_VERIFY[^']*)'\) \{ return \$line \}$/m);
  const archiveSizeMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_ARCHIVE_SIZE[^']*)'\) \{ return \$line \}$/m);
  const archiveStatFailureMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_ARCHIVE_STAT_FAILURE[^']*)'\) \{ return \$line \}$/m);
  const archiveHashFailureMatch = wrapper.match(/^\s*if \(\$line -match '([^']*BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FAILURE[^']*)'\) \{ return \$line \}$/m);
  assert.ok(phaseMatch, "native setup phase allowlist is present");
  assert.ok(failureMatch, "native setup failure allowlist is present");
  assert.ok(progressMatch, "native model pull progress allowlist is present");
  assert.ok(resultMatch, "native model pull result allowlist is present");
  assert.ok(cleanupIncompleteMatch, "incomplete owned-temp cleanup receipt allowlist is present");
  assert.ok(operationFailureMatch, "native model pull operation failure receipt allowlist is present");
  assert.ok(archiveMatch, "native archive verification receipt allowlist is present");
  assert.ok(archiveSizeMatch, "native archive size receipt allowlist is present");
  assert.ok(archiveStatFailureMatch, "native archive stat failure allowlist is present");
  assert.ok(archiveHashFailureMatch, "native archive hash failure receipt allowlist is present");
  const phasePattern = new RegExp(phaseMatch[1]);
  const failurePattern = new RegExp(failureMatch[1]);
  const progressPattern = new RegExp(progressMatch[1]);
  const resultPattern = new RegExp(resultMatch[1]);
  const cleanupIncompletePattern = new RegExp(cleanupIncompleteMatch[1]);
  const operationFailurePattern = new RegExp(operationFailureMatch[1]);
  const archivePattern = new RegExp(archiveMatch[1]);
  const archiveSizePattern = new RegExp(archiveSizeMatch[1]);
  const archiveStatFailurePattern = new RegExp(archiveStatFailureMatch[1]);
  const archiveHashFailurePattern = new RegExp(archiveHashFailureMatch[1]);
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
  for (const diagnostic of ["access_denied", "authorization", "disk_space", "model_unavailable", "network", "other", "output_limit", "resource"]) {
    assert.equal(resultPattern.test(`BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=1 diagnostic=${diagnostic} failureClass=process_exit outputBytes=24 childClose=closed`), true, diagnostic);
  }
  assert.equal(resultPattern.test("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=0 diagnostic=other failureClass=none outputBytes=12 childClose=closed"), true, "successful pull receipts confirm direct-child close");
  assert.equal(resultPattern.test("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=unavailable diagnostic=other failureClass=process_launch outputBytes=0 childClose=unconfirmed"), true, "unknown exit state and direct-child close state are explicit");
  assert.equal(resultPattern.test("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=-1073741819 diagnostic=resource failureClass=process_exit outputBytes=1048576 childClose=closed"), true, "signed Windows process failure codes are preserved");
  assert.equal(resultPattern.test("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=429496729600 diagnostic=other failureClass=other outputBytes=24 childClose=closed"), false, "oversized process codes remain rejected");
  assert.equal(resultPattern.test("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=1 diagnostic=secret failureClass=process_exit outputBytes=24 childClose=closed"), false);
  assert.equal(resultPattern.test("BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=1 diagnostic=network failureClass=token-secret outputBytes=24 childClose=closed"), false);
  assert.equal(cleanupIncompletePattern.test("BOSTAN_NATIVE_WINDOWS_CLEANUP_INCOMPLETE task_owned_temp_preserved=true reason=child_close_unconfirmed"), true);
  assert.equal(cleanupIncompletePattern.test("BOSTAN_NATIVE_WINDOWS_CLEANUP_INCOMPLETE C:\\Users\\secret"), false);
  for (const cause of ["access_denied", "io_error", "other", "output_limit", "process_launch", "process_state"]) {
    assert.equal(operationFailurePattern.test(`BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=${cause} childAlive=false failureClass=process_exit exitCode=unavailable diagnostic=other outputBytes=1024`), true, cause);
  }
  assert.equal(operationFailurePattern.test("BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=other childAlive=false failureClass=process_exit exitCode=-1073741819 diagnostic=network outputBytes=7478"), true, "operation failures preserve signed exit state and a bounded log category");
  assert.equal(operationFailurePattern.test("BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=secret childAlive=false failureClass=process_exit exitCode=unavailable diagnostic=other outputBytes=1024"), false);
  assert.equal(archivePattern.test(`BOSTAN_NATIVE_WINDOWS_ARCHIVE_VERIFY sizeBytes=1618522644 sha256=${"a".repeat(64)} sizeMatches=true digestMatches=false`), true);
  assert.equal(archivePattern.test(`BOSTAN_NATIVE_WINDOWS_ARCHIVE_VERIFY sizeBytes=1618522644 sha256=${"A".repeat(64)} sizeMatches=true digestMatches=false`), false);
  assert.equal(archivePattern.test(`BOSTAN_NATIVE_WINDOWS_ARCHIVE_VERIFY sizeBytes=1618522644 sha256=${"a".repeat(64)} sizeMatches=true digestMatches=false C:\\secret`), false);
  assert.equal(archiveSizePattern.test("BOSTAN_NATIVE_WINDOWS_ARCHIVE_SIZE sizeBytes=1618522644 sizeMatches=true"), true);
  assert.equal(archiveSizePattern.test("BOSTAN_NATIVE_WINDOWS_ARCHIVE_SIZE sizeBytes=private sizeMatches=true"), false);
  for (const failure of ["access_denied", "path_missing", "io_error", "invalid_argument", "other"]) {
    assert.equal(archiveStatFailurePattern.test(`BOSTAN_NATIVE_WINDOWS_ARCHIVE_STAT_FAILURE ${failure}`), true, failure);
  }
  assert.equal(archiveStatFailurePattern.test("BOSTAN_NATIVE_WINDOWS_ARCHIVE_STAT_FAILURE C:\\secret"), false);
  for (const failure of ["access_denied", "path_missing", "io_error", "invalid_argument", "other"]) {
    assert.equal(archiveHashFailurePattern.test(`BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FAILURE ${failure}`), true, failure);
  }
  assert.equal(archiveHashFailurePattern.test("BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FAILURE C:\\secret"), false);
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
  assert.match(setup, /BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=.*diagnostic=.*failureClass=.*outputBytes=.*childClose=/, "model pull failures emit bounded sanitized classification and direct-child close state");
  assert.match(setup, /if \(\$stage -eq 'qwen_model_pull'\) \{[\s\S]*?BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=\$pullCause childAlive=.*failureClass=.*exitCode=.*diagnostic=.*outputBytes=/, "the outer stage handler emits the terminal receipt for every model-pull failure");
  assert.match(setup, /bostan-windows-native-model-pull\.mjs/, "the bounded Node runner captures the actual Ollama child exit code under Windows PowerShell 5.1");
  assert.match(setup, /\$modelPullExitCode = if \(\$matches\[1\] -eq 'unavailable'\)/, "the PowerShell catch path preserves unavailable exit state");
  assert.match(setup, /if \(\$pullChildAlive\).*?elseif \(\$null -eq \$pullExitCode -and \$modelPullFailureClass -in @\('access_denied','io_error','output_limit','process_launch','process_state'\)\)/s, "an unavailable child exit is classified from the captured failure before a null PowerShell process object");
  assert.match(modelPullRunner, /child\.once\("close", \(code, signal\) => resolve\(\{ code, signal \}\)\)/, "the runner receives the child close event and numeric exit code");
  assert.match(modelPullRunner, /await outputFile\.write\(chunk\.subarray\(0, written\)\)/, "the runner caps combined stdout and stderr bytes while draining both streams");
  assert.match(modelPullRunner, /return child\.kill\(\)/, "termination uses the owned child process handle instead of a reusable numeric PID");
  assert.doesNotMatch(modelPullRunner, /taskkill\.exe|String\(child\.pid\)/, "the supervisor never targets an unrelated process through a recycled PID");
  assert.ok(setup.includes("bostan-windows-native-model-diagnostics.ps1"), "the bounded dual-stream diagnostic reader is loaded");
  const diagnostics = fs.readFileSync(path.join(import.meta.dirname, "bostan-windows-native-model-diagnostics.ps1"), "utf8");
  assert.match(diagnostics, /\$stream\.Position = \[Math\]::Max\(0L, \$stream\.Length - 32768L\)/, "each model log stream is classified from a bounded tail");
  assert.match(diagnostics, /\$streamCharacters -lt 32768/, "diagnostic tail reads remain capped per stream");
  assert.match(setup, /if \(\$pullOutputLimitExceeded\) \{[\s\S]*?BOSTAN_NATIVE_MODEL_PULL_OPERATION_FAILURE cause=output_limit[\s\S]*?\} elseif \(\$pullOutputReadFailed\)/, "the output cap takes precedence over exit-code text classification");
  assert.match(diagnostics, /OutputLimitExceeded = \(\$outputBytes -gt 1048576\)/, "an exactly 1 MiB log remains distinct from an exceeded cap");
  assert.doesNotMatch(setup, /modelPullResultReported/, "nested catches cannot suppress the outer terminal model-pull receipt");
  for (const diagnostic of ["disk_space", "authorization", "model_unavailable", "network", "resource", "access_denied"]) {
    assert.ok(diagnostics.includes("$diagnostic = '" + diagnostic + "'"), "model pull classifier detects " + diagnostic);
  }
  assert.doesNotMatch(setup, /pullDiagnosticText/, "terminal classification uses the bounded dual-stream reader");
});

test("native model diagnostics retain terminal errors across bounded stdout and stderr tails", { skip: process.platform !== "win32" }, () => {
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const probe = path.join(import.meta.dirname, "bostan-windows-native-model-diagnostics-probe.ps1");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-File", probe], {
    env: process.env, windowsHide: true, encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 0, JSON.stringify({ error: result.error?.message, signal: result.signal, stdout: result.stdout, stderr: result.stderr }));
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /BOSTAN_NATIVE_MODEL_DIAGNOSTICS_PROBE_PASS cases=dual_stream_tail,terminal_stdout_tail,exact_combined_limit,output_limit,missing_files/);
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
