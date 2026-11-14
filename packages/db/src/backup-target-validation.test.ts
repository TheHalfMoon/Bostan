import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { runDatabaseBackup } from "./backup-lib.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("rejects ambiguous library backup targets before creating files or connecting", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bostan-backup-target-"));
  dirs.push(root);
  const destination = path.join(root, "backups");
  const valid = {
    connectionString: "postgres://synthetic.invalid/synthetic",
    backupDir: destination,
    retention: { dailyDays: 1, weeklyWeeks: 1, monthlyMonths: 1 },
  };
  for (const connectionString of ["", "   ", null, undefined, 123]) {
    await expect(runDatabaseBackup({ ...valid, connectionString } as typeof valid))
      .rejects.toThrow(/Invalid backup connection string/);
    expect(existsSync(destination)).toBe(false);
  }
  for (const backupDir of ["", " \t ", null, undefined, 123]) {
    await expect(runDatabaseBackup({ ...valid, backupDir } as typeof valid))
      .rejects.toThrow(/Invalid backup directory/);
    expect(existsSync(destination)).toBe(false);
  }
});
