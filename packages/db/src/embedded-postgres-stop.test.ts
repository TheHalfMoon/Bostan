import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import EmbeddedPostgres from "embedded-postgres";

describe("embedded PostgreSQL stop after failed spawn", () => {
  it("does not wait for an exit event that already happened or delete persistent data", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bostan-postgres-stop-"));
    const markerPath = path.join(root, "persistent-marker.txt");
    await writeFile(markerPath, "preserve", "utf8");
    const instance = new EmbeddedPostgres({ databaseDir: root, persistent: true });
    const dependencySource = await readFile(new URL(import.meta.resolve("embedded-postgres")), "utf8");
    expect(dependencySource).toMatch(/!this\.process\.pid \|\| this\.process\.exitCode !== null \|\| this\.process\.signalCode !== null/);
    const internals = instance as unknown as {
      process?: { pid?: number; exitCode: number | null; signalCode: string | null };
    };
    // A PID is present, but the child already exited. The guard must return
    // before the Windows taskkill path can target any real process.
    internals.process = { pid: 1, exitCode: 1, signalCode: null };
    try {
      await instance.stop();
      expect(internals.process).toBeUndefined();
      expect(await readFile(markerPath, "utf8")).toBe("preserve");
    } finally {
      internals.process = undefined;
      await rm(root, { recursive: true, force: false });
    }
  });

  it("uses a bounded cluster shutdown on Windows and waits for all child streams to close", async () => {
    const dependencySource = await readFile(new URL(import.meta.resolve("embedded-postgres")), "utf8");

    expect(dependencySource).toMatch(/const pgCtlPath = platform\(\) === 'win32' \? \(yield bin\)\.pg_ctl : undefined/);
    expect(dependencySource).toMatch(/spawn\(pgCtlPath, \['stop', '-D', this\.options\.databaseDir, '-m', 'fast', '-w', '-t', '15'\]/);
    expect(dependencySource).toContain("processClosed = true;");
    expect(dependencySource).toContain("shutdown.once('close'");
  });
});
