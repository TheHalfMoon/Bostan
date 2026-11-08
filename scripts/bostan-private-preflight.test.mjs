import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditBostanPrivatePreflight } from "./bostan-private-preflight.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("accepts both independently successful audits", () => {
  const called = [];
  const issues = auditBostanPrivatePreflight(root, [
    ["docs", (path) => { called.push(["docs", path]); return []; }],
    ["ui", (path) => { called.push(["ui", path]); return []; }],
  ]);
  assert.deepEqual(issues, []);
  assert.deepEqual(called, [["docs", root], ["ui", root]]);
});

test("fails closed on documentation regressions while still running the UI audit", () => {
  let inspectedUi = false;
  const issues = auditBostanPrivatePreflight(root, [
    ["docs", () => ["unsafe executable example"]],
    ["ui", () => { inspectedUi = true; return []; }],
  ]);
  assert.deepEqual(issues, ["docs: unsafe executable example"]);
  assert.equal(inspectedUi, true);
});

test("reports multiple UI errors without disguising them as docs failures", () => {
  assert.deepEqual(auditBostanPrivatePreflight(root, [
    ["docs", () => []],
    ["ui", () => ["old brand icon", "wrong manifest"]],
  ]), ["ui: old brand icon", "ui: wrong manifest"]);
});

test("rejects non-array audit results", () => {
  assert.deepEqual(auditBostanPrivatePreflight(root, [["docs", () => undefined]]),
    ["docs: invalid audit result"]);
});

test("rejects non-string findings without trusting their stringification", () => {
  assert.deepEqual(auditBostanPrivatePreflight(root, [["ui", () => [new Error("SECRET")]]]),
    ["ui: invalid audit result"]);
});

test("redacts internal exception text even when a checker throws a secret", () => {
  const issues = auditBostanPrivatePreflight(root, [["ui", () => { throw Error("MY_PRIVATE_CREDENTIAL"); }]]);
  assert.deepEqual(issues, ["ui: audit threw an exception"]);
  assert.doesNotMatch(JSON.stringify(issues), /MY_PRIVATE_CREDENTIAL/);
});

test("native CLI entry reports success on an admitted checkout", () => {
  const script = fileURLToPath(new URL("./bostan-private-preflight.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 8000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /BOSTAN_PRIVATE_PREFLIGHT=PASS/);
});
