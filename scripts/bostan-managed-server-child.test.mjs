import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
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

test("real interprocess Node IPC finishes synthetic server shutdown with exit zero", { timeout: 15_000 }, async () => {
  const moduleUri = new URL("./bostan-managed-server-child.mjs", import.meta.url).href;
  const code = `import { superviseManagedServer } from ${JSON.stringify(moduleUri)};
await superviseManagedServer(async () => {
  process.send({type:"fake:ready"});
  return {shutdown: async () => {}};
});`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const messages = [];
  let stderr = "";
  child.stderr.on("data", b => { stderr += b.toString().slice(0, 200); });
  child.on("message", v => { messages.push(v); });
  try {
    await new Promise((resolve, reject) => {
      const fail = setTimeout(() => reject(new Error("Fake child never became ready")), 8000);
      child.on("message", value => {
        if (value?.type === "fake:ready") { clearTimeout(fail); resolve(); }
      });
      child.once("error", reject);
    });
    child.send({type: "bostan:managed:stop"});
    const [exitCode, signal] = await once(child, "exit");
    assert.equal(exitCode, 0, stderr);
    assert.equal(signal, null);
    assert.ok(messages.some(v => v?.type === "bostan:managed:stopped"));
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
test("unexpected launcher IPC disconnection triggers graceful teardown", async () => {
  const proc = fakeProcess();
  let closed = 0;
  await superviseManagedServer(async () => ({shutdown: async () => {closed++;}}), proc);
  proc.emit("disconnect");
  await new Promise(r => setImmediate(r));
  assert.equal(closed, 1);
  assert.deepEqual(proc.exits, [0]);
});
