import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { evaluateBostanWindowsReadiness, inspectBostanWindowsHost,
  WINDOWS_QUALIFICATION_BUDGET } from "./bostan-windows-host-readiness.mjs";

const GiB = 1024 ** 3;
const ready = () => ({
  platform: "win32", arch: "x64", nodeVersion: "24.19.0",
  totalMemoryBytes: 16 * GiB, freeMemoryBytes: 8 * GiB,
  stagingFreeBytes: 20 * GiB, tempFreeBytes: 20 * GiB,
});

test("good native Windows host is capacity-ready but never release-qualified", () => {
  const x = evaluateBostanWindowsReadiness(ready());
  assert.equal(x.hostCapacityReady, true);
  assert.equal(x.installedAppQualified, false);
  assert.equal(x.releaseQualified, false);
  assert.equal(x.checks.length, 7);
  assert.deepEqual(x.blocked, []);
});

test("Win32 architecture and Node.js 24.11 minimum strictly enforced", () => {
  for (const patch of [
    { platform: "darwin" }, { arch: "ia32" }, { nodeVersion: "24.10.9" },
    { nodeVersion: "23.100.0" }, { nodeVersion: "24.11" },
    { nodeVersion: "24.11.0-secret" },
  ]) assert.equal(evaluateBostanWindowsReadiness({ ...ready(), ...patch }).hostCapacityReady, false);
  assert.equal(evaluateBostanWindowsReadiness({ ...ready(),
    nodeVersion: "24.11.0", arch: "arm64" }).hostCapacityReady, true);
  assert.equal(evaluateBostanWindowsReadiness({ ...ready(),
    nodeVersion: "26.0.0" }).hostCapacityReady, true);
});

test("memory and disk shortfalls fail closed without installing or deleting", () => {
  for (const patch of [
    { totalMemoryBytes: 8 * GiB }, { freeMemoryBytes: 3 * GiB },
    { stagingFreeBytes: 9 * GiB }, { tempFreeBytes: 9 * GiB },
  ]) {
    const report = evaluateBostanWindowsReadiness({ ...ready(), ...patch });
    assert.equal(report.hostCapacityReady, false);
    assert.ok(report.blocked.length);
    assert.equal(report.releaseQualified, false);
  }
  assert.deepEqual(WINDOWS_QUALIFICATION_BUDGET, {
    totalMemoryGiB: 12, freeMemoryGiB: 6,
    stagingFreeGiB: 12, nodeMinimum: [24, 11, 0],
  });
});

test("missing/broken resource observations never count as sufficient", () => {
  for (const value of [null, undefined, NaN, Infinity, -1, "20", 0.5]) {
    assert.equal(evaluateBostanWindowsReadiness({
      ...ready(), tempFreeBytes: value,
    }).hostCapacityReady, false);
  }
});

test("host inspector is query-only, produces no user-specific paths or secrets", () => {
  let calls = 0;
  const report = inspectBostanWindowsHost({
    ...ready(), stagingPath: path.resolve(os.tmpdir(), "private-account-token"),
    tempPath: path.resolve(os.tmpdir(), "private-credential"), disk: () => { calls += 1; return 20 * GiB; },
  });
  assert.equal(report.hostCapacityReady, true);
  assert.equal(calls, 2);
  assert.doesNotMatch(JSON.stringify(report), /private-account-token|private-credential/);
});

test("failed disk probes are sanitized and never permit qualification", () => {
  const report = inspectBostanWindowsHost({
    ...ready(), stagingPath: path.resolve(os.tmpdir(), "synthetic"),
    tempPath: path.resolve(os.tmpdir(), "synthetic-tmp"),
    disk: () => { throw Error("C:\\Users\\SecretAccount\\token.txt"); },
  });
  assert.equal(report.hostCapacityReady, false);
  assert.deepEqual(report.blocked.sort(),
    ["qualification_staging_disk", "qualification_temp_disk"]);
  assert.doesNotMatch(JSON.stringify(report), /SecretAccount|token\.txt/);
});

test("macOS host never triggers Windows disk probes", () => {
  const report = inspectBostanWindowsHost({
    ...ready(), platform: "darwin",
    disk: () => { throw Error("must not be called"); },
  });
  assert.equal(report.hostCapacityReady, false);
  assert.ok(report.blocked.includes("windows_os"));
});
