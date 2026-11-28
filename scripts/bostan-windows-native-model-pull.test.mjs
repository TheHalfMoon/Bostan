import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { MAX_MODEL_PULL_OUTPUT_BYTES, classifyModelPullDiagnostic, runBoundedModelPull } from "./bostan-windows-native-model-pull.mjs";

async function makeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "bostan-native-model-pull-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  return {
    root,
    stdoutPath: path.join(root, "stdout.log"),
    stderrPath: path.join(root, "stderr.log"),
  };
}

test("model-pull process runner preserves actual nonzero child exit with bounded stdout and stderr", async (t) => {
  const fixture = await makeFixture(t);
  const result = await runBoundedModelPull({
    executable: process.execPath,
    args: ["-e", "process.stdout.write('pull model manifest unknown'); process.stderr.write('synthetic'); process.exit(17)"],
    ...fixture,
  });

  assert.equal(result.exitCode, 17);
  assert.equal(result.failureClass, "process_exit");
  assert.equal(result.diagnostic, "model_unavailable");
  assert.equal(result.childClosed, true);
  assert.equal(result.outputLimitExceeded, false);
  assert.equal(result.outputBytes, (await stat(fixture.stdoutPath)).size + (await stat(fixture.stderrPath)).size);
  assert.match(await readFile(fixture.stdoutPath, "utf8"), /manifest unknown/);
});

test("successful child exit remains successful", async (t) => {
  const fixture = await makeFixture(t);
  const result = await runBoundedModelPull({
    executable: process.execPath,
    args: ["-e", "process.stdout.write('pull complete')"],
    ...fixture,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.failureClass, "none");
  assert.equal(result.childClosed, true);
  assert.equal(result.outputLimitExceeded, false);
});

test("output cap terminates only the owned child and keeps combined logs bounded", async (t) => {
  const fixture = await makeFixture(t);
  const result = await runBoundedModelPull({
    executable: process.execPath,
    args: ["-e", "function w(s){let n=0;const b=Buffer.alloc(65536,97);function p(){while(n<2097152){n+=b.length;if(!s.write(b)){s.once('drain',p);return}}}p()}w(process.stdout);w(process.stderr)"],
    maxOutputBytes: 4096,
    ...fixture,
  });

  assert.equal(result.failureClass, "output_limit");
  assert.equal(result.diagnostic, "output_limit");
  assert.equal(result.outputLimitExceeded, true);
  assert.equal(result.childClosed, true);
  assert.ok(result.outputBytes <= 4096);
  assert.equal((await stat(fixture.stdoutPath)).size + (await stat(fixture.stderrPath)).size, result.outputBytes);
});

test("output-cap cleanup uses only the owned child process handle", async (t) => {
  const fixture = await makeFixture(t);
  const realSpawn = (await import("node:child_process")).spawn;
  let spawnCount = 0;
  const result = await runBoundedModelPull({
    executable: process.execPath,
    args: ["-e", "process.stdout.write(Buffer.alloc(65536));setInterval(()=>{},100000)"],
    maxOutputBytes: 4096,
    spawnProcess(executable, args, options) {
      spawnCount += 1;
      return realSpawn(executable, args, options);
    },
    ...fixture,
  });

  assert.equal(result.failureClass, "output_limit");
  assert.equal(result.terminationAccepted, true);
  assert.equal(result.childClosed, true);
  assert.equal(spawnCount, 1, "no PID-based cleanup helper is launched");
  assert.ok(result.outputBytes <= 4096);
});

test("refused direct-child termination returns a bounded unconfirmed result", async (t) => {
  const fixture = await makeFixture(t);
  const realSpawn = (await import("node:child_process")).spawn;
  let ownedChild;
  const result = await runBoundedModelPull({
    executable: process.execPath,
    args: ["-e", "process.stdout.write(Buffer.alloc(65536));setInterval(()=>{},100000)"],
    maxOutputBytes: 4096,
    terminationTimeoutMs: 20,
    spawnProcess(executable, args, options) {
      ownedChild = realSpawn(executable, args, options);
      const terminate = ownedChild.kill.bind(ownedChild);
      ownedChild.kill = () => false;
      ownedChild.terminateForFixtureCleanup = terminate;
      return ownedChild;
    },
    ...fixture,
  });

  assert.equal(result.failureClass, "output_limit");
  assert.equal(result.terminationAccepted, false);
  assert.equal(result.childClosed, false);
  const childClosed = new Promise((resolve) => ownedChild.once("close", resolve));
  ownedChild.terminateForFixtureCleanup();
  await childClosed;
});

test("post-exit inherited pipe is bounded and reported as unconfirmed", async (t) => {
  const fixture = await makeFixture(t);
  const childScript = path.join(fixture.root, "parent-with-inherited-pipe.cjs");
  const childPidFile = path.join(fixture.root, "descendant.pid");
  await fs.promises.writeFile(childScript, "const fs = require('node:fs'); const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 100000)'], { stdio: 'inherit', detached: true, windowsHide: true }); fs.writeFileSync(process.argv[2], String(child.pid)); process.stdout.write('descendant=' + child.pid + '\\n'); process.exit(0);", "utf8");
  let descendantPid;
  try {
    const result = await runBoundedModelPull({
      executable: process.execPath,
      args: [childScript, childPidFile],
      terminationTimeoutMs: 30,
      ...fixture,
    });

    const output = await readFile(fixture.stdoutPath, "utf8");
    descendantPid = Number(output.match(/descendant=(\d+)/)?.[1]);
    assert.ok(Number.isInteger(descendantPid) && descendantPid > 0, "fixture reports its task-owned descendant PID");
    assert.equal(result.exitCode, 0);
    assert.equal(result.childClosed, false);
    assert.equal(result.terminationAccepted, false);
  } finally {
    if (!Number.isInteger(descendantPid)) {
      try { descendantPid = Number(await readFile(childPidFile, "utf8")); } catch { /* child did not launch */ }
    }
    if (Number.isInteger(descendantPid) && descendantPid > 0) {
      try { process.kill(descendantPid); } catch { /* it already exited with the fixture */ }
    }
  }
});

test("missing executable is a process-launch failure with no user-data cleanup", async (t) => {
  const fixture = await makeFixture(t);
  const result = await runBoundedModelPull({
    executable: path.join(fixture.root, "missing-ollama.exe"),
    args: ["pull", "qwen2.5-coder:1.5b"],
    ...fixture,
  });

  assert.ok(result.exitCode === null || Number.isInteger(result.exitCode));
  assert.equal(result.failureClass, "process_launch");
  assert.equal(result.childClosed, true);
  assert.equal(result.outputBytes, 0);
});

test("Windows PowerShell 5.1 preserves the bounded helper receipt and child exit code", { skip: process.platform !== "win32" }, (t) => {
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const probe = path.join(import.meta.dirname, "bostan-windows-native-model-pull-powershell-probe.ps1");
  const root = requireTempDirectory();
  try {
    const result = spawnSync(powershell, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-File", probe,
      "-HelperPath", path.join(import.meta.dirname, "bostan-windows-native-model-pull.mjs"),
      "-NodePath", process.execPath,
      "-StdoutPath", path.join(root, "stdout.log"),
      "-StderrPath", path.join(root, "stderr.log"),
    ], { windowsHide: true, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, JSON.stringify({ error: result.error?.message, signal: result.signal, stdout: result.stdout, stderr: result.stderr }));
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /BOSTAN_NATIVE_MODEL_PULL_RESULT exitCode=1 diagnostic=[a-z_]+ failureClass=process_exit outputBytes=[0-9]+ childClose=closed/);
    assert.match(result.stdout, /BOSTAN_WINDOWS_POWERSHELL5_MODEL_PULL_PASS child_exit=1 runner_exit=1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("failure diagnostics classify common bounded Ollama errors", () => {
  assert.equal(classifyModelPullDiagnostic("pull model manifest: 404 not found"), "model_unavailable");
  assert.equal(classifyModelPullDiagnostic("context deadline exceeded while resolving registry"), "network");
  assert.equal(classifyModelPullDiagnostic("HTTP 403 Forbidden"), "authorization");
  assert.equal(classifyModelPullDiagnostic("no space left on device"), "disk_space");
  assert.equal(classifyModelPullDiagnostic("permission denied opening model path"), "access_denied");
  assert.equal(MAX_MODEL_PULL_OUTPUT_BYTES, 1024 * 1024);
});

function requireTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bostan-native-pull-powershell-"));
}
