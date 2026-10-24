import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectRuntimeLock, databaseStatus, recoverStoppedLocalRuntime, removeStoppedRuntimeLock, RUNTIME_MARKER } from "./bostan-runtime-recovery.mjs";

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-recovery-"));
  const app = path.join(home, ".bostan", "app");
  fs.mkdirSync(path.join(app, "postgres"), { recursive: true, mode: 0o700 });
  return { home, app, lock: path.join(app, "run.lock"),
    data: path.join(app, "postgres", "data"), pg: path.join(home, "fake-pgctl.sh"),
    clean: () => fs.rmSync(home, { recursive: true, force: true }) };
}
function lock(f, pid = 12345) {
  fs.writeFileSync(f.lock, RUNTIME_MARKER + ":" + pid + "\n", { flag: "wx", mode: 0o600 });
}
function pg(f, code) {
  fs.writeFileSync(f.pg, "#!/bin/sh\nexit " + code + "\n", { mode: 0o700 });
}
function dead() { const error = new Error("No process"); error.code = "ESRCH"; throw error; }
function alive() {}
function recover(f, probe = dead) { return recoverStoppedLocalRuntime({ home: f.home, pgCtl: f.pg, probe }); }
function withFixture(fn) { const f = fixture(); try { fn(f); } finally { f.clean(); } }

// The portable Windows qualification uses real PostgreSQL 17 and direct
// databaseStatus probes. These six historical fixtures rely on Unix /bin/sh,
// POSIX mode bits or the symlink privilege unavailable on ordinary Windows.
const posixFixture = process.platform === "win32" ? test.skip : test;

test("read-only inspection does not create a lock", () => withFixture(f => {
  assert.deepEqual(inspectRuntimeLock(f.lock), { state: "absent" });
  assert.equal(fs.existsSync(f.lock), false);
}));
test("active owner blocks recovery with no database cluster", () => withFixture(f => {
  lock(f); assert.throws(() => recover(f, alive), /owner is alive/); assert.ok(fs.existsSync(f.lock));
}));
test("EPERM is an alive PID, not permission to recover", () => withFixture(f => {
  lock(f); const probe = () => { const e = new Error(); e.code = "EPERM"; throw e; };
  assert.equal(inspectRuntimeLock(f.lock, probe).state, "alive");
}));
test("only the stale Bostan lock is removed, not adjacent files", () => withFixture(f => {
  lock(f); const sentinel = path.join(f.app, "sentinel"); fs.writeFileSync(sentinel, "protected");
  assert.equal(recover(f).changed, true);
  assert.equal(fs.readFileSync(sentinel, "utf8"), "protected");
  assert.equal(fs.existsSync(f.lock), false);
}));
posixFixture("running PostgreSQL keeps the stale lock", () => withFixture(f => {
  lock(f); fs.mkdirSync(f.data); pg(f, 0);
  assert.equal(databaseStatus(f.pg, f.data), "running");
  assert.throws(() => recover(f), /running/); assert.ok(fs.existsSync(f.lock));
}));
test("unknown pg_ctl results keep the stale lock", () => withFixture(f => {
  lock(f); fs.mkdirSync(f.data); pg(f, 4);
  assert.equal(databaseStatus(f.pg, f.data), "unknown");
  assert.throws(() => recover(f), /cannot be verified/);
  assert.throws(() => recoverStoppedLocalRuntime({home:f.home,pgCtl:null,probe:dead}), /cannot be verified/);
}));
posixFixture("pg_ctl code 3 confirms stopped and allows recovery", () => withFixture(f => {
  lock(f); fs.mkdirSync(f.data); pg(f, 3);
  assert.equal(databaseStatus(f.pg, f.data), "stopped");
  assert.equal(recover(f).changed, true);
}));
posixFixture("normal shutdown must own the lock PID", () => withFixture(f => {
  lock(f); fs.mkdirSync(f.data); pg(f, 3);
  const args = {lockPath:f.lock, pgData:f.data, pgCtl:f.pg, mode:"shutdown"};
  assert.throws(() => removeStoppedRuntimeLock({...args,expectedPid:9}), /changed ownership/);
  assert.equal(removeStoppedRuntimeLock({...args,expectedPid:12345}).changed, true);
}));
test("malformed lock is never removed", () => withFixture(f => {
  fs.writeFileSync(f.lock, "foreign", {mode:0o600});
  assert.throws(() => recover(f), /Unrecognized/); assert.ok(fs.existsSync(f.lock));
}));
posixFixture("symlinked lock cannot modify target", () => withFixture(f => {
  const target = path.join(f.home, "protected");
  fs.writeFileSync(target,"protected"); fs.symlinkSync(target,f.lock);
  assert.throws(() => recover(f), /Unsafe/);
  assert.equal(fs.readFileSync(target,"utf8"), "protected");
}));
posixFixture("group-readable lock or symlinked database is refused", () => withFixture(f => {
  lock(f); fs.chmodSync(f.lock,0o644);
  assert.throws(() => recover(f), /readable/);
  fs.chmodSync(f.lock,0o600); fs.symlinkSync(f.home,f.data);
  assert.throws(() => recover(f), /Unsafe/);
}));
test("current process PID cannot be recovered", () => withFixture(f => {
  lock(f,process.pid); assert.throws(() => recoverStoppedLocalRuntime({home:f.home,pgCtl:null}), /owner is alive/);
}));
posixFixture("symlinked app directory and relative HOME are rejected", () => withFixture(f => {
  lock(f); fs.rmSync(f.app,{recursive:true}); fs.symlinkSync(f.home,f.app);
  assert.throws(() => recover(f), /Unsafe/);
  assert.throws(() => recoverStoppedLocalRuntime({home:".",pgCtl:null,probe:dead}), /normalized/);
}));
