import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";
import { runDatabaseBackup } from "./backup-lib.js";

test("library rejects unsafe backup filename prefixes before filesystem or database access", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bostan-library-prefix-"));
  const backupDir = path.join(root, "backups");
  try {
    for (const filenamePrefix of ["", " ", "../escape", "sub/path", "sub\\path", ".", "..", "-leading", "foo bar"]) {
      await assert.rejects(
        runDatabaseBackup({
          connectionString: "postgres://synthetic.invalid/synthetic",
          backupDir,
          retention: { dailyDays: 1, weeklyWeeks: 1, monthlyMonths: 1 },
          filenamePrefix,
        }),
        /Invalid backup filename prefix/,
        filenamePrefix,
      );
      assert.equal(existsSync(backupDir), false, "invalid prefix must not create a backup directory");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
