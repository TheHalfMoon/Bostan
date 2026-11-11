import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

for (const platform of ["windows", "macos"]) {
  test(`${platform} installer qualification refuses an operator environment before touching state`, () => {
    const env = { ...process.env, CI: "false" };
    delete env.BOSTAN_DESKTOP_INSTALLER_QA;
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./qualify-${platform}-installer.mjs`, import.meta.url))], {
      env, encoding: "utf8", timeout: 10000, windowsHide: true,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Installer qualification requires an explicitly selected disposable/);
    assert.doesNotMatch(result.stdout, /_PASS/);
  });
}
