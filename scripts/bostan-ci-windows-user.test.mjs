import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("CI account launcher refuses an operator PC before any account or fixture creation", { skip: process.platform !== "win32" }, () => {
  const powershell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-File", path.join(import.meta.dirname, "bostan-ci-windows-user.ps1")], {
    env: { ...process.env, CI: "false", GITHUB_ACTIONS: "false" }, windowsHide: true, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /requires a disposable GitHub Actions runner/);
});
