import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { serverJourneyCommand, serverJourneyEnvironment } from "./bostan-server-journey-command.mjs";

test("compiled qualification requires the built entry and never falls back to tsx", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-journey-command-"));
  try {
    fs.mkdirSync(path.join(repo, "server/src"), { recursive: true });
    fs.writeFileSync(path.join(repo, "server/src/index.ts"), "export {};");
    assert.throws(() => serverJourneyCommand(repo, true), /compiled server entry is missing/);
    fs.mkdirSync(path.join(repo, "server/dist"));
    fs.writeFileSync(path.join(repo, "server/dist/index.js"), "export {};");
    assert.deepEqual(serverJourneyCommand(repo, true), [
      "--conditions=bostan-compiled", path.join(repo, "server/dist/index.js"),
    ]);
    assert.deepEqual(serverJourneyCommand(repo), [
      path.join(repo, "server/node_modules/tsx/dist/cli.mjs"), path.join(repo, "server/src/index.ts"),
    ]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("synthetic server refuses inherited provider keys, DB, config and Node preloads", () => {
  const home = path.resolve(os.tmpdir(), "bostan-journey-environment");
  const inherited = {
    SystemRoot: "C:\\Windows", DATABASE_URL: "postgres://never-use",
    PAPERCLIP_CONFIG: "never-use", NODE_OPTIONS: "--import never-use",
    OPENAI_API_KEY: "never-use", ANTHROPIC_API_KEY: "never-use", CUSTOM_SECRET: "never-use",
    HOME: "never-use", PATH: "never-use", BOSTAN_OFFLINE: "0",
  };
  const env = serverJourneyEnvironment({ home, base: "http://127.0.0.1:43117", port: 43117, compiled: true, inherited });
  assert.equal(JSON.stringify(env).includes("never-use"), false);
  for (const key of ["DATABASE_URL", "NODE_OPTIONS", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CUSTOM_SECRET"]) {
    assert.equal(Object.hasOwn(env, key), false);
  }
  assert.equal(env.PAPERCLIP_HOME, home);
  assert.equal(env.PAPERCLIP_CONFIG, path.join(home, "config.json"));
  assert.equal(env.PAPERCLIP_DISABLE_CWD_ENV_FILE, "true");
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.BOSTAN_OFFLINE, "1");
  assert.match(env.BETTER_AUTH_SECRET, /^[a-f0-9]{64}$/);
});
