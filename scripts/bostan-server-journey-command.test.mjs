import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { serverJourneyCommand } from "./bostan-server-journey-command.mjs";

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
