import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { copyMacInstalledApp, MACOS_APP_COPY_TIMEOUT_MS } from "./macos-installed-copy.mjs";

function fakeChild({ closeAfterMs, output, exitCode = 0 } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killSignals = [];
  child.kill = signal => {
    child.killSignals.push(signal);
    if (signal === "SIGTERM" || signal === "SIGKILL") setImmediate(() => child.emit("close", null, signal));
    return true;
  };
  if (output) setTimeout(() => child.stderr.write(output), 1);
  if (closeAfterMs !== undefined) setTimeout(() => child.emit("close", exitCode), closeAfterMs);
  return child;
}

test("macOS installer copy emits bounded progress without exposing copied paths", async () => {
  const child = fakeChild({ closeAfterMs: 15, output: "/private/runner/secret/file\nsecond-entry\n" });
  const receipts = [];
  const result = await copyMacInstalledApp("/source/Bostan.app", "/isolated/Applications/Bostan.app", {
    command: "ditto-fixture", spawnChild: (...args) => { assert.deepEqual(args.slice(0, 2), ["ditto-fixture", ["-V", "/source/Bostan.app", "/isolated/Applications/Bostan.app"]]); return child; },
    timeoutMs: 100, heartbeatMs: 5, onProgress: line => receipts.push(line),
  });
  assert.equal(result.entriesCopied, 2);
  assert.equal(receipts.some(line => line.includes("progress=advanced")), true);
  assert.equal(receipts.some(line => line.includes("/private/runner/secret")), false);
});

test("macOS installer copy times out, terminates only its owned process, and reports stalled progress", async () => {
  const child = fakeChild();
  const receipts = [];
  await assert.rejects(copyMacInstalledApp("source", "destination", {
    spawnChild: () => child, timeoutMs: 25, heartbeatMs: 5, onProgress: line => receipts.push(line),
  }), /macos_app_copy_timeout/);
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assert.equal(receipts.some(line => line.includes("progress=stalled")), true);
});

test("macOS installed app copy keeps a bounded timeout below the job budget", () => {
  assert.equal(MACOS_APP_COPY_TIMEOUT_MS, 900_000);
  assert.ok(MACOS_APP_COPY_TIMEOUT_MS < 60 * 60_000);
});
