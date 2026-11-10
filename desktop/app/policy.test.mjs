import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { desktopEnvironment, isApplicationNavigation, persistentAuthSecret } from "./policy.mjs";

test("renderer navigation stays inside its exact uncredentialed application origin", () => {
  const origin = "http://127.0.0.1:41321";
  assert.equal(isApplicationNavigation(origin + "/ABC/agents?view=all", origin), true);
  for (const url of ["https://example.test", "http://127.0.0.1:41322", "http://user@127.0.0.1:41321", "file:///tmp/test", "javascript:alert(1)"]) {
    assert.equal(isApplicationNavigation(url, origin), false);
  }
});

test("backend authentication survives restarts and ambient secrets/config cannot redirect it", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-desktop-policy-"));
  try {
    const inherited = { PATH: "synthetic-provider-bin", DATABASE_URL: "never-use", NODE_OPTIONS: "never-use", PAPERCLIP_CONFIG: "never-use", OPENAI_API_KEY: "never-use" };
    const env = desktopEnvironment({ dataDir, port: 41321, inherited });
    assert.equal(JSON.stringify(env).includes("never-use"), false);
    assert.equal(env.PATH, inherited.PATH);
    assert.equal(env.PAPERCLIP_CONFIG, path.join(dataDir, "config.json"));
    assert.equal(env.PAPERCLIP_DISABLE_CWD_ENV_FILE, "true");
    assert.equal(env.PAPERCLIP_DEPLOYMENT_MODE, "authenticated");
    assert.equal(env.BETTER_AUTH_SECRET, persistentAuthSecret(dataDir));
    assert.equal(env.BETTER_AUTH_SECRET, desktopEnvironment({ dataDir, port: 41322 }).BETTER_AUTH_SECRET);
    fs.writeFileSync(path.join(dataDir, "desktop-auth-secret"), "broken");
    assert.throws(() => persistentAuthSecret(dataDir), /unsafe/);
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});
