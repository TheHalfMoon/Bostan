import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { dbBackupCommand } from "../commands/db-backup.js";

// Regression: an external DB without a connection URL must never silently
// produce a successful backup of the unrelated embedded instance.
test("db:backup fails closed for an external database without a URL", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bostan-backup-guard-"));
  const config = path.join(dir, "config.json");
  const previousUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    writeFileSync(config, JSON.stringify({
      $meta: { version: 1, updatedAt: "2026-01-01T00:00:00Z", source: "configure" },
      database: { mode: "postgres" },
      logging: { mode: "file" },
      server: {},
    }));
    await assert.rejects(
      dbBackupCommand({ config, dir: path.join(dir, "backups") }),
      /Postgres backup requires a configured database connection string or DATABASE_URL/,
    );
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(dir, { recursive: true, force: true });
  }
});
