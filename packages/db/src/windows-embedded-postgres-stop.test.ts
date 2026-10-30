import { expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  stopOwnedWindowsEmbeddedPostgres,
  type WindowsPostgresProcess,
} from "./windows-embedded-postgres-stop.js";

const binary = path.resolve("pg_ctl.exe");
const pinnedExe = path.join(path.dirname(binary), "postgres.exe");
const clean = async () => [] as WindowsPostgresProcess[];
const noWait = async () => {};
const row = (exe = pinnedExe): WindowsPostgresProcess => ({
  ProcessId: 123, ParentProcessId: 456,
  ExecutablePath: exe, CreationDate: "2026-10-30T12:00:00Z",
});
async function fixture(run: (data: string) => Promise<void>) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-windows-pg-stop-"));
  fs.writeFileSync(path.join(data, "PG_VERSION"), "18");
  try { await run(data); } finally { fs.rmSync(data, { recursive: true, force: true }); }
}
it("requires two clean snapshots after fixed graceful shutdown", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), "123\n");
    let calls = 0;
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary, async (file, args) => {
      expect(file).toBe(binary);
      expect(args).toEqual(["-D", fs.realpathSync(data), "-m", "fast", "-w", "-t", "40", "stop"]);
      calls++;
      fs.unlinkSync(path.join(data, "postmaster.pid"));
    }, async () => { inspections++; return []; }, noWait)).toBe("stopped");
    expect(calls).toBe(1);
    expect(inspections).toBe(2);
  });
});
it("does not call pg_ctl when marker is absent, but still proves no workers", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => { inspections++; return []; }, noWait)).toBe("already-stopped");
    expect(inspections).toBe(2);
  });
});
it("waits for lingering pinned workers to exit before declaring success", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => (++inspections <= 2 ? [row()] : []), noWait)).toBe("already-stopped");
    expect(inspections).toBe(4);
  });
});
it("rejects a live pinned io_worker even without a PID marker", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => { inspections++; return [row()]; }, noWait))
      .rejects.toThrow(/processes remain/);
    expect(inspections).toBe(20);
  });
});
it("allows other inspectable PostgreSQL executables without terminating them", async () => {
  await fixture(async (data) => {
    const foreign = path.join(path.dirname(binary), "unrelated", "postgres.exe");
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => { inspections++; return [row(foreign)]; }, noWait))
      .toBe("already-stopped");
    expect(inspections).toBe(2);
  });
});
it("refuses ambiguous process metadata and failed inspection", async () => {
  await fixture(async (data) => {
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary, async () => {},
      async () => [{ ...row(), ExecutablePath: null }], noWait))
      .rejects.toThrow(/Ambiguous/);
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary, async () => {},
      async () => [{ ...row(), CreationDate: null }], noWait))
      .rejects.toThrow(/Ambiguous/);
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary, async () => {},
      async () => { throw Error("sensitive raw CIM output"); }, noWait))
      .rejects.toThrow(/Unable to inspect/);
  });
});
it("retains an absent-marker fixture when postmaster.pid reappears during verification", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => {
        if (++inspections === 2) fs.writeFileSync(marker, "999\\n");
        return [];
      }, noWait)).rejects.toThrow(/reappeared/);
    expect(inspections).toBe(2);
    expect(fs.existsSync(marker)).toBe(true);
  });
});
it("retains a stopped fixture when postmaster.pid reappears after pg_ctl", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, "123\\n");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(marker); },
      async () => {
        if (++inspections === 2) fs.writeFileSync(marker, "999\\n");
        return [];
      }, noWait)).rejects.toThrow(/reappeared/);
    expect(inspections).toBe(2);
    expect(fs.existsSync(marker)).toBe(true);
  });
});
it("fails closed when postmaster marker survives graceful stop", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), "123\n");
    let inspected = false;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary, async () => {},
      async () => { inspected = true; return []; }, noWait)).rejects.toThrow(/survived/);
    expect(inspected).toBe(false);
  });
});
it("refuses unrelated shutdown binary and incomplete database identity", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), "123\n");
    await expect(stopOwnedWindowsEmbeddedPostgres(data, path.resolve("different.exe"),
      async () => {}, clean, noWait)).rejects.toThrow(/binary/);
    fs.unlinkSync(path.join(data, "PG_VERSION"));
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => {}, clean, noWait)).rejects.toThrow(/non-PostgreSQL/);
  });
});
it("refuses symlinked scratch clusters", async () => {
  await fixture(async (data) => {
    const link = data + "-alias";
    try {
      fs.symlinkSync(data, link, "dir");
      await expect(stopOwnedWindowsEmbeddedPostgres(link, binary,
        async () => {}, clean, noWait)).rejects.toThrow(/owned scratch/);
    } catch (error) {
      if (process.platform === "win32" &&
          ["EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) return;
      throw error;
    } finally { try { fs.unlinkSync(link); } catch {} }
  });
});
