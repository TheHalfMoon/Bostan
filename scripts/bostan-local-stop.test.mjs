import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import {
  startPrivateStopControl, requestPrivateLocalStop, checkWindowsTempStopHome,
} from "./bostan-local-stop.mjs";
import { enforceWindowsQaPrivateAcl } from "./bostan-windows-acl.mjs";

const winTest = process.platform === "win32" ? test : test.skip;
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
