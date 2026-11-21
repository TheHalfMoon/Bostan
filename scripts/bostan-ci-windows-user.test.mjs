import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Windows CI receipt allowlist admits only fixed startup failure codes", () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, "bostan-ci-windows-user.ps1"), "utf8");
  const match = source.match(/^\s*if \(\$line -match '([^']*BOSTAN_DESKTOP_STARTUP_FAILURE[^']*)'\) \{ return \$line \}$/m);
  assert.ok(match, "Windows CI startup failure receipt allowlist is present");
  const receiptPattern = new RegExp(match[1]);
  assert.equal(receiptPattern.test("BOSTAN_DESKTOP_STARTUP_FAILURE POSTGRES_START_FAILED"), true);
  assert.equal(receiptPattern.test("BOSTAN_DESKTOP_STARTUP_FAILURE STARTUP_FAILED"), true);
  assert.equal(receiptPattern.test("BOSTAN_DESKTOP_STARTUP_FAILURE PRIVATE_SECRET"), false);
});

test("CI account launcher refuses an operator PC before any account or fixture creation", { skip: process.platform !== "win32" }, () => {
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-File", path.join(import.meta.dirname, "bostan-ci-windows-user.ps1")], {
    env: { ...process.env, CI: "false", GITHUB_ACTIONS: "false" }, windowsHide: true, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /requires a disposable GitHub Actions runner/);
});
