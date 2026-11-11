import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { installedAppPhase } from "./installed-app-phase.mjs";

test("a stalled installed-app phase fails and stops only its actual owned child", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const sentinel = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const sentinelExited = once(sentinel, "exit");
  const exited = once(child, "exit");
  let forced = false;
  try {
    await assert.rejects(installedAppPhase({ process: () => child }, "synthetic_stall", () => new Promise(() => {}), {
      timeoutMs: 100, onForcedStop: () => { forced = true; },
    }), /phase timed out: synthetic_stall/);
    await Promise.race([exited, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Owned child did not exit")), 5000);
      timer.unref();
    })]);
    assert.equal(forced, true);
    assert.notEqual(child.exitCode === null && child.signalCode === null, true);
    assert.equal(sentinel.exitCode, null);
    assert.equal(sentinel.signalCode, null);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    sentinel.kill("SIGKILL"); await sentinelExited;
  }
});

test("a completed installed-app phase cancels its timer without stopping the child", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  const exited = once(child, "exit");
  try {
    assert.equal(await installedAppPhase({ process: () => child }, "synthetic_ready", async () => "ready", { timeoutMs: 100 }), "ready");
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(child.exitCode, null);
    assert.equal(child.signalCode, null);
  } finally { child.kill("SIGKILL"); await exited; }
});

test("invalid bounds and missing process ownership refuse before executing work", async () => {
  let called = false;
  const work = () => { called = true; };
  await assert.rejects(installedAppPhase({ process: () => null }, "missing", work), /ownership unavailable/);
  await assert.rejects(installedAppPhase({ process: () => null }, "invalid", work, { timeoutMs: 0 }), /Invalid/);
  assert.equal(called, false);
});
