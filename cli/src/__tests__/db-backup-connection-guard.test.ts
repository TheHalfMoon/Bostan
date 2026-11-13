import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";
import { dbBackupCommand, resolveConnectionString } from "../commands/db-backup.js";

// Regression: an external DB without a connection URL must never silently
// produce a successful backup of the unrelated embedded instance.
// This file runs in the workspace Vitest suite, so register with Vitest.
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

test("db:backup connection resolution respects explicit targets and embedded port", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bostan-backup-targets-"));
  const config = path.join(dir, "config.json");
  const previousUrl = process.env.DATABASE_URL;
  const write = (database: Record<string, unknown>) => writeFileSync(config, JSON.stringify({
    $meta: { version: 1, updatedAt: "2026-01-01T00:00:00Z", source: "configure" },
    database,
    logging: { mode: "file" },
    server: {},
  }));
  try {
    delete process.env.DATABASE_URL;
    write({ mode: "postgres", connectionString: "postgres://synthetic.invalid/synthetic" });
    assert.deepEqual(resolveConnectionString(config), {
      value: "postgres://synthetic.invalid/synthetic",
      source: "config.database.connectionString",
    });
    process.env.DATABASE_URL = "postgres://override.invalid/override";
    assert.deepEqual(resolveConnectionString(config), {
      value: "postgres://override.invalid/override",
      source: "DATABASE_URL",
    });
    process.env.DATABASE_URL = "  \t  ";
    write({ mode: "postgres", connectionString: "postgres://synthetic.invalid/synthetic" });
    assert.deepEqual(resolveConnectionString(config), {
      value: "postgres://synthetic.invalid/synthetic",
      source: "config.database.connectionString",
    });
    write({ mode: "postgres", connectionString: "  " });
    assert.throws(() => resolveConnectionString(config), /Postgres backup requires a configured database connection string/);
    delete process.env.DATABASE_URL;
    write({ mode: "postgres", connectionString: "  " });
    assert.throws(() => resolveConnectionString(config), /Postgres backup requires a configured database connection string/);
    write({ mode: "embedded-postgres", embeddedPostgresPort: 55432 });
    assert.deepEqual(resolveConnectionString(config), {
      value: "postgres://paperclip:paperclip@127.0.0.1:55432/paperclip",
      source: "embedded-postgres@55432",
    });
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(dir, { recursive: true, force: true });
  }
});
