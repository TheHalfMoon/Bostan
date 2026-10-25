import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { qualifyDisposableFirstAgentScope, qualifyFreeQaModel, syntheticFreeAgentAdapterConfig, observeHeartbeatQaStatus, assertHeartbeatQaSucceeded, firstAgentLifecycleReadinessTimeoutMs, safeAgentLifecycleDiagnostic } from "./bostan-first-agent-free-e2e.mjs";

function fixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), "bostan-free-agent-guard-"));
  const p = path.join(home, ".bostan", "app");
  const cfg = path.join(p, "state", "instances", "local");
  mkdirSync(cfg, { recursive: true });
  writeFileSync(path.join(cfg, "config.json"), JSON.stringify({
    bostanManagedLocalRuntime: "bostan-managed-source-runtime-v1",
    server: { port: 41600, host: "127.0.0.1", bind: "loopback", exposure: "private" },
    telemetry: { enabled: false },
  }), { mode: 0o600 });
  writeFileSync(path.join(p, "run.lock"), "bostan-managed-source-runtime-v1:12345\n", { mode: 0o600 });
  const opts = { url: "http://127.0.0.1:41600/",
    home, confirmed: "1", onlineModelApproved: "1" };
  return { home, opts, clean: () => rmSync(home, { recursive: true, force: true }) };
}
test("scope accepts explicitly opted-in isolated localhost runtime", () => {
  const f = fixture();
  try { assert.equal(qualifyDisposableFirstAgentScope(f.opts).home, realpathSync(f.home)); }
  finally { f.clean(); }
});
test("scope rejects missing explicit confirmation or online-provider opt-in", () => {
  const f = fixture();
  try {
    assert.throws(() => qualifyDisposableFirstAgentScope({ ...f.opts, confirmed: "0" }), /Explicit/);
    assert.throws(() => qualifyDisposableFirstAgentScope({ ...f.opts, onlineModelApproved: undefined }), /Explicit/);
  } finally { f.clean(); }
});
test("scope refuses public endpoints or mismatched private port", () => {
  const f = fixture();
  try {
    for (const url of ["https://127.0.0.1:41600/", "http://example.com:41600/",
      "http://127.0.0.1:41601/", "http://127.0.0.1:41600/api", "http://user:pass@127.0.0.1:41600/"]) {
      assert.throws(() => qualifyDisposableFirstAgentScope({ ...f.opts, url }));
    }
  } finally { f.clean(); }
});
test("scope refuses a non-temp user HOME", () => {
  const f = fixture();
  try { assert.throws(() => qualifyDisposableFirstAgentScope({ ...f.opts, home: os.homedir() })); }
  finally { f.clean(); }
});
test("scope refuses non-Bostan or non-private config", () => {
  const f = fixture();
  try {
    const file = path.join(f.home, ".bostan", "app", "state", "instances", "local", "config.json");
    writeFileSync(file, JSON.stringify({ bostanManagedLocalRuntime: "foreign" }));
    assert.throws(() => qualifyDisposableFirstAgentScope(f.opts), /isolated/);
  } finally { f.clean(); }
});
test("scope refuses startup without a managed run lock", () => {
  const f = fixture();
  try {
    const file = path.join(f.home, ".bostan", "app", "run.lock");
    writeFileSync(file, "malformed");
    assert.throws(() => qualifyDisposableFirstAgentScope(f.opts), /ownership lock/);
  } finally { f.clean(); }
});

test("allowlisted QA models only; never attempt a paid or unknown model", () => {
  assert.equal(qualifyFreeQaModel(undefined), "opencode/deepseek-v4.1-flash-free");
  assert.equal(qualifyFreeQaModel("opencode/beam-free"), "opencode/beam-free");
  for (const model of ["openai/gpt-5.2", "opencode/claude-opus-5-5", "unknown/free",
    "opencode/deepseek-v4.1-flash-free\n--ignore-safety"]) {
    assert.throws(() => qualifyFreeQaModel(model), /Only explicitly permitted/);
  }
});

test("Windows synthetic agent uses exact admitted OpenCode executable, not a PATH shim", () => {
  const f = fixture();
  try {
    const fake = path.join(f.home, "opencode.exe");
    writeFileSync(fake, "synthetic");
    const model = "opencode/deepseek-v4.1-flash-free";
    const windows = syntheticFreeAgentAdapterConfig({
      model, workspace: f.home, binary: fake, platform: "win32",
    });
    assert.equal(windows.command, fake);
    assert.equal(windows.maxAgentSteps, 12);
    assert.equal(windows.timeoutSec, 120);
    assert.throws(() => syntheticFreeAgentAdapterConfig({
      model, workspace: f.home, platform: "win32",
    }), /absolute native OpenCode executable/);
    assert.throws(() => syntheticFreeAgentAdapterConfig({
      model, workspace: f.home, binary: "opencode.cmd", platform: "win32",
    }), /absolute native/);
    const mac = syntheticFreeAgentAdapterConfig({
      model, workspace: f.home, platform: "darwin",
    });
    assert.equal(mac.command, undefined);
  } finally { f.clean(); }
});

test("Windows CLI ESM import path fails promptly before network when the native executable is missing", () => {
  if (process.platform !== "win32") return;
  const f = fixture();
  try {
    const script = fileURLToPath(new URL("./bostan-first-agent-free-e2e.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], {
      env: {
        ...process.env,
        BOSTAN_E2E_URL: f.opts.url,
        BOSTAN_E2E_DISPOSABLE_HOME: f.home,
        BOSTAN_E2E_CONFIRM_TEMP_DATA: "1",
        BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
        BOSTAN_E2E_FREE_MODEL: "opencode/deepseek-v4.1-flash-free",
        BOSTAN_E2E_OPENCODE_EXE: "",
      },
      encoding: "utf8", timeout: 7_000, windowsHide: true,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Set BOSTAN_E2E_OPENCODE_EXE/);
    assert.doesNotMatch(result.stderr, /unsettled top-level await/i);
  } finally { f.clean(); }
});

test("terminal interrupted heartbeat fails immediately with safe stage/error evidence", () => {
  const run = {
    status: "interrupted", errorCode: "lease_released_before_terminal",
    executionStage: "preparing", id: "synthetic",
  };
  assert.deepEqual(observeHeartbeatQaStatus(run), { done: true, result: run });
  assert.throws(() => assertHeartbeatQaSucceeded(run),
    /interrupted.*lease_released_before_terminal.*preparing/);
});
test("queued or preparing live heartbeat is never considered finished", () => {
  for (const status of ["queued", "running", "preparing"]) {
    assert.deepEqual(observeHeartbeatQaStatus({ status }), { done: false });
  }
  for (const status of ["succeeded", "failed", "timed_out", "cancelled", "interrupted"]) {
    assert.equal(observeHeartbeatQaStatus({ status }).done, true);
  }
  assert.doesNotThrow(() => assertHeartbeatQaSucceeded({ status: "succeeded" }));
});
test("failed run diagnostics never echo arbitrary raw error content", () => {
  assert.throws(() => assertHeartbeatQaSucceeded({
    status: "failed", errorCode: "secret=private-credential\n",
    executionStage: "preparing",
  }), e => !e.message.includes("private-credential") && e.message.includes("failed"));
});

test("Windows agent readiness is bounded but tolerates native cold verification", () => {
  assert.equal(firstAgentLifecycleReadinessTimeoutMs("win32"), 240_000);
  assert.equal(firstAgentLifecycleReadinessTimeoutMs("darwin"), 90_000);
  assert.equal(firstAgentLifecycleReadinessTimeoutMs("linux"), 90_000);
  assert.equal(firstAgentLifecycleReadinessTimeoutMs("darwin", true), 180_000);
  assert.equal(firstAgentLifecycleReadinessTimeoutMs("linux", true), 180_000);
  assert.equal(firstAgentLifecycleReadinessTimeoutMs("win32", true), 240_000);
});

test("agent readiness diagnostics allow only safe status enums; never echo private config", () => {
  assert.deepEqual(safeAgentLifecycleDiagnostic({
    lifecycleState: "provisioning", status: "active", adapterConfig: { password: "private" },
  }), { lifecycleState: "provisioning", status: "active" });
  assert.deepEqual(safeAgentLifecycleDiagnostic({
    lifecycleState: "very-private-token=bad", status: "foo\nsecret=bad",
  }), { lifecycleState: null, status: null });
});

test("agent lifecycle harness-failure classification does not leak provider or credentials", () => {
  const payload = { lifecycleState: "verifying", status: "paused",
    lifecycleError: "Execution configuration check failed. Authentication failed. secret=private." };
  const observed = safeAgentLifecycleDiagnostic(payload);
  assert.deepEqual(observed, {
    lifecycleState: "verifying", status: "paused", failureCode: "harness_test_failed",
  });
  assert.doesNotMatch(JSON.stringify(observed), /Authentication|private|secret/);
});
