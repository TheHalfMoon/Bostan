import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("optional native first-agent qualification runs against the verified installed Windows application", async () => {
  const source = await readFile(new URL("./qualify-windows-installer.mjs", import.meta.url), "utf8");
  assert.match(source, /BOSTAN_E2E_ENABLE_LOCAL_AGENT_QA === "1"/);
  assert.match(source, /process\.env\.BOSTAN_E2E_MODEL_MODE, "local-ollama"/);
  assert.match(source, /process\.env\.BOSTAN_E2E_ALLOW_LOCAL_MODEL, "1"/);
  assert.match(source, /process\.env\.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL, "1"/);
  assert.match(source, /BOSTAN_E2E_APP_EXE: executable, BOSTAN_E2E_OPENCODE_EXE: nativeOpenCode/);
  assert.match(source, /installed_native_agent_qualification_failed/);
});
