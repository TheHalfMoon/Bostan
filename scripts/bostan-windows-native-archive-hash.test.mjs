import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const helperPath = path.join(import.meta.dirname, "bostan-windows-native-archive-hash.ps1");
const probePath = path.join(import.meta.dirname, "bostan-windows-native-archive-hash-probe.ps1");
const nativeSetupPath = path.join(import.meta.dirname, "bostan-windows-local-native-qa.ps1");
const wrapperPath = path.join(import.meta.dirname, "bostan-ci-windows-user.ps1");
const workerPath = path.join(import.meta.dirname, "bostan-ci-windows-user-worker.ps1");

test("native archive hashing streams bounded input and preserves the pinned verifier", () => {
  const helper = fs.readFileSync(helperPath, "utf8");
  const nativeSetup = fs.readFileSync(nativeSetupPath, "utf8");
  assert.match(helper, /\$sha256\.ComputeHash\(\$stream\)/);
  assert.match(helper, /\$sha256\.Dispose\(\)/);
  assert.match(helper, /\$stream\.Dispose\(\)/);
  assert.doesNotMatch(helper, /ReadAllBytes|Get-Content|Get-FileHash/);
  assert.match(nativeSetup, /\$ollamaSha256 = '3dd80f6e3a9699f2eadf4ac418f00529cee594df9557541806eda1f1f3f5588a'/);
  assert.match(nativeSetup, /\$ollamaArchiveBytes = 1618522644L/);
  assert.match(nativeSetup, /Get-BostanArchiveSha256 -LiteralPath \$zipPath/);
  assert.doesNotMatch(nativeSetup, /Get-FileHash/);
});

test("standard-user wrapper exposes bounded archive hash fixture receipts", () => {
  const wrapper = fs.readFileSync(wrapperPath, "utf8");
  const worker = fs.readFileSync(workerPath, "utf8");
  const probe = fs.readFileSync(probePath, "utf8");
  assert.match(wrapper, /ArchiveHashProbe/);
  assert.equal(wrapper.includes("BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=(?:valid|corruption_detected|missing_file|access_denied|digest_mismatch|stream_disposed)"), true);
  assert.equal(wrapper.includes("BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_PROBE_FAILURE phase=(?:standard_user|fixtures) cause=(?:access_denied|path_missing|io_error|invalid_argument|other)"), true);
  assert.match(worker, /bostan-windows-native-archive-hash-probe\.ps1'\) -RequireStandardUser/);
  assert.match(probe, /WindowsBuiltInRole\]::Administrator/);
});

test("Windows PowerShell 5.1 hash fixtures classify failure cases under the current token", { skip: process.platform !== "win32" }, () => {
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-File", probePath], {
    env: process.env,
    windowsHide: true,
    encoding: "utf8",
    timeout: 60000,
  });
  assert.equal(result.error, undefined, JSON.stringify({ error: result.error?.message, signal: result.signal }));
  assert.equal(result.status, 0, JSON.stringify({ stdout: result.stdout, stderr: result.stderr, signal: result.signal }));
  for (const phase of ["valid", "corruption_detected", "missing_file", "access_denied", "digest_mismatch", "stream_disposed"]) {
    assert.match(result.stdout, new RegExp(`BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_FIXTURE_PASS phase=${phase}`));
  }
  assert.match(result.stdout, /BOSTAN_NATIVE_WINDOWS_ARCHIVE_HASH_PROBE_PASS/);
  assert.doesNotMatch(result.stdout, /[A-Z]:\\|Users\\|Temp\\/i);
});
