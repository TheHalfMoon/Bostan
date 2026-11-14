import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

test.skipIf(process.platform === "win32")("backup wrapper routes to local CLI without invoking upstream packages", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bostan-wrapper-"));
  const fakePnpm = path.join(dir, "pnpm");
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  try {
    writeFileSync(fakePnpm, "#!/bin/sh\nprintf '%s\\n' \"$PWD\" \"$@\"\n");
    chmodSync(fakePnpm, 0o755);
    const result = spawnSync("bash", [path.join(repoRoot, "scripts/backup-db.sh"), "--json", "--dir", "synthetic backup"], {
      cwd: dir,
      env: { ...process.env, PATH: dir + path.delimiter + (process.env.PATH ?? "") },
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split("\n"), [
      repoRoot, "--dir", "cli", "exec", "tsx", "src/index.ts",
      "db:backup", "--json", "--dir", "synthetic backup",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("db:backup refuses malformed and invalid configuration before opening a database", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bostan-invalid-backup-config-"));
  const config = path.join(dir, "config.json");
  const previousUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    for (const contents of [
      "{broken-json",
      "null",
      "[]",
      JSON.stringify({ database: { mode: "unknown" } }),
      JSON.stringify({ database: { mode: "postgres", connectionString: 42 } }),
      ...[0, -1, 1.5, 65536, "54329", null].map((port) =>
        JSON.stringify({ database: { mode: "embedded-postgres", embeddedPostgresPort: port } }),
      ),
    ]) {
      writeFileSync(config, contents);
      await assert.rejects(
        dbBackupCommand({ config, dir: path.join(dir, "backups") }),
        /Failed to parse JSON|Invalid config/,
      );
    }
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(dir, { recursive: true, force: true });
  }
});
