import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  startPrivateStopControl, requestPrivateLocalStop, checkWindowsTempStopHome,
} from "./bostan-local-stop.mjs";
import { enforceWindowsQaPrivateAcl } from "./bostan-windows-acl.mjs";

const winTest = process.platform === "win32" ? test : test.skip;
const exec = promisify(execFile);
function fixture() {
  const originalQa = process.env.BOSTAN_WINDOWS_TEMP_QA;
  process.env.BOSTAN_WINDOWS_TEMP_QA = "1";
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-stop-qa-"));
  const root = path.join(home, ".bostan");
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  enforceWindowsQaPrivateAcl(home, { fresh: true });
  const lock = path.join(root, "app", "run.lock");
  fs.writeFileSync(lock, "bostan-managed-source-runtime-v1:" + process.pid + "\n",
    { mode: 0o600, flag: "wx" });
  return { home, lock, clean: () => {
    try { fs.rmSync(home, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 }); }
    finally {
      if (originalQa === undefined) delete process.env.BOSTAN_WINDOWS_TEMP_QA;
      else process.env.BOSTAN_WINDOWS_TEMP_QA = originalQa;
    }
  } };
}
winTest("local QA controller authenticates request and verifies stopped fake-empty database", async () => {
  const f = fixture();
  let ctl = null;
  try {
    let requests = 0;
    ctl = await startPrivateStopControl({ home: f.home, onStop: () => {
      requests++;
      fs.unlinkSync(f.lock);
    } });
    const result = await requestPrivateLocalStop({
      home: f.home, env: { BOSTAN_WINDOWS_TEMP_QA: "1" }, pgCtl: null, maxWaitMs: 5_000,
    });
    assert.equal(result.stopped, true);
    assert.equal(result.postgres, "not-initialized");
    assert.equal(requests, 1);
  } finally { if (ctl) await ctl.close(); f.clean(); }
});
winTest("stale control PID cannot signal a running but different Bostan owner", async () => {
  const f = fixture();
  let ctl = null;
  try {
    ctl = await startPrivateStopControl({ home: f.home, onStop: () => {}, pid: process.pid + 12345 });
    await assert.rejects(() => requestPrivateLocalStop({
      home: f.home, env: { BOSTAN_WINDOWS_TEMP_QA: "1" }, pgCtl: null, maxWaitMs: 500,
    }), /does not match/);
    assert.ok(fs.existsSync(f.lock));
  } finally { if (ctl) await ctl.close(); f.clean(); }
});
winTest("Windows stop refuses real HOME or missing opt-in", () => {
  const f = fixture();
  try {
    assert.throws(() => checkWindowsTempStopHome(os.homedir(), {
      BOSTAN_WINDOWS_TEMP_QA: "1",
    }), /outside disposable TEMP HOME/);
    assert.throws(() => checkWindowsTempStopHome(f.home, {}),
      /requires explicit disposable/);
  } finally { f.clean(); }
});
test("non-Windows user cannot open Bostan private stop control", () => {
  if (process.platform !== "win32") {
    assert.throws(() => checkWindowsTempStopHome(os.tmpdir()),
      /requires explicit disposable/);
  }
});

winTest("source CLI in a separate Windows process verifies completed stop and private state", { timeout: 20_000 }, async () => {
  const f = fixture();
  let ctl = null;
  try {
    ctl = await startPrivateStopControl({ home: f.home, onStop: () => fs.unlinkSync(f.lock) });
    const child = await exec(process.execPath, [
      fileURLToPath(new URL("../cli/src/bostan-preview.mjs", import.meta.url)),
      "app", "stop", "--local",
    ], {
      env: { ...process.env, HOME: f.home, BOSTAN_WINDOWS_TEMP_QA: "1" },
      timeout: 15_000, windowsHide: true,
    });
    assert.match(child.stdout, /Bostan local stop confirmed\. PostgreSQL: not-initialized/);
    assert.equal(fs.existsSync(f.lock), false);
  } finally { if (ctl) await ctl.close(); f.clean(); }
});

winTest("malformed secret in stop control fails closed without removing runtime lock", async () => {
  const f = fixture();
  let ctl = null;
  try {
    ctl = await startPrivateStopControl({ home: f.home, onStop: () => fs.unlinkSync(f.lock) });
    const metaFile = path.join(f.home, ".bostan", "app", "stop-control.json");
    const original = fs.readFileSync(metaFile, "utf8");
    const meta = JSON.parse(original);
    meta.token = "0".repeat(64);
    fs.writeFileSync(metaFile, JSON.stringify(meta) + "\n");
    await assert.rejects(() => requestPrivateLocalStop({
      home: f.home, pgCtl: null, env: { BOSTAN_WINDOWS_TEMP_QA: "1" },
      maxWaitMs: 1000,
    }), /rejected local stop/);
    assert.ok(fs.existsSync(f.lock));
    fs.writeFileSync(metaFile, original);
  } finally { if (ctl) await ctl.close(); f.clean(); }
});
