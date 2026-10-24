import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { superviseManagedServer } from "./bostan-managed-server-child.mjs";

function fakeProcess() {
  const proc = new EventEmitter();
  proc.messages = [];
  proc.exits = [];
  proc.send = (m) => proc.messages.push(m);
  proc.exit = (code) => proc.exits.push(code);
  return proc;
}
test("child requests graceful application teardown on parent IPC, then reports success", async () => {
  const proc = fakeProcess();
  let closed = 0;
  const server = { shutdown: async (sig) => {
    assert.equal(sig, "SIGTERM");
    closed++;
  } };
  await superviseManagedServer(async () => server, proc);
  proc.emit("message", { type: "bostan:managed:stop" });
  await new Promise(r => setImmediate(r));
  assert.equal(closed, 1);
  assert.deepEqual(proc.messages, [{ type: "bostan:managed:stopped" }]);
  assert.deepEqual(proc.exits, [0]);
});
test("duplicate and unrelated messages never trigger duplicate shutdown", async () => {
  const proc = fakeProcess();
  let closed = 0;
  await superviseManagedServer(async () => ({ shutdown: async () => { closed++; } }), proc);
  proc.emit("message", { type: "unrelated" });
  proc.emit("message", { type: "bostan:managed:stop" });
  proc.emit("message", { type: "bostan:managed:stop" });
  await new Promise(r => setImmediate(r));
  assert.equal(closed, 1);
  assert.deepEqual(proc.exits, [0]);
});
test("early IPC request is drained when slow server startup resolves", async () => {
  const proc = fakeProcess();
  let resolveStartup;
  const startPromise = new Promise(r => { resolveStartup = r; });
  const started = superviseManagedServer(() => startPromise, proc);
  proc.emit("message", { type: "bostan:managed:stop" });
  let closed = false;
  resolveStartup({ shutdown: async () => { closed = true; } });
  await started;
  await new Promise(r => setImmediate(r));
  assert.equal(closed, true);
  assert.deepEqual(proc.exits, [0]);
});
test("failed child shutdown cannot be misrepresented as clean", async () => {
  const proc = fakeProcess();
  await superviseManagedServer(async () => ({
    shutdown: async () => { throw Error("synthetic shutdown fail"); },
  }), proc);
  proc.emit("message", { type: "bostan:managed:stop" });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(proc.messages, [{ type: "bostan:managed:stop-failed" }]);
  assert.deepEqual(proc.exits, [1]);
});
