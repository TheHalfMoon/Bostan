import { expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  stopOwnedWindowsEmbeddedPostgres,
  type WindowsPostgresProcess,
} from "./windows-embedded-postgres-stop.js";

// Exercise native Win32 executable paths even when the synthetic test runs on macOS.
const binary = process.platform === "win32" ? path.resolve("pg_ctl.exe") : "C:\\bostan-test\\pg_ctl.exe";
const pinnedExe = path.win32.join(path.win32.dirname(binary), "postgres.exe");
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
it("never calls missing data directory an already-stopped verified cluster", async () => {
  // A concurrent cleanup or failed partial initialization may remove the
  // directory while the pinned postgres.exe worker is still running.
  // Do not infer quiescence from filesystem absence or delete foreign files.
  const missing = path.join(os.tmpdir(), "bostan-windows-pg-absent-" +
    process.pid + "-b172");
  expect(fs.existsSync(missing)).toBe(false);
  let runs = 0;
  let inspections = 0;
  await expect(stopOwnedWindowsEmbeddedPostgres(missing, binary,
    async () => { runs++; }, async () => {
      inspections++;
      return [row()];
    }, noWait)).rejects.toThrow(/Missing owned PostgreSQL/);
  expect(runs).toBe(0);
  expect(inspections).toBe(0);
  expect(fs.existsSync(missing)).toBe(false);
});
it("missing data directory never passes even if a separate process scan is clean", async () => {
  const missing = path.join(os.tmpdir(), "bostan-windows-pg-absent-" +
    process.pid + "-clean-b172");
  expect(fs.existsSync(missing)).toBe(false);
  await expect(stopOwnedWindowsEmbeddedPostgres(missing, binary,
    async () => { throw Error("must never run pg_ctl"); },
    clean, noWait)).rejects.toThrow(/Missing owned PostgreSQL/);
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
    const foreign = path.win32.join(path.win32.dirname(binary), "unrelated", "postgres.exe");
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => { inspections++; return [row(foreign)]; }, noWait))
      .toBe("already-stopped");
    expect(inspections).toBe(2);
  });
});
it("rejects duplicate Windows process IDs with contradictory identity fields", async () => {
  await fixture(async (data) => {
    const foreignA = path.win32.join(path.win32.dirname(binary), "foreign-a", "postgres.exe");
    const foreignB = path.win32.join(path.win32.dirname(binary), "foreign-b", "postgres.exe");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop an unidentified process"); },
      async () => {
        inspections++;
        return [row(foreignA), row(foreignB)];
      }, noWait)).rejects.toThrow(/Ambiguous|duplicate/);
    expect(inspections).toBe(1);
  });
});
it("rejects duplicate Windows PIDs even if their other fields match", async () => {
  await fixture(async (data) => {
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run"); },
      async () => [row(path.win32.join(path.win32.dirname(binary), "foreign", "postgres.exe")),
        row(path.win32.join(path.win32.dirname(binary), "foreign", "postgres.exe"))], noWait))
      .rejects.toThrow(/Ambiguous|duplicate/);
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
    fs.writeFileSync(marker, "123\n");
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
it.skipIf(process.platform === "win32")("rejects a dangling postmaster.pid symlink before issuing a clean receipt", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.symlinkSync(path.join(data, "absent-pid-target"), marker);
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run pg_ctl"); },
      async () => { inspections++; return []; }, noWait))
      .rejects.toThrow(/PID marker/);
    expect(inspections).toBe(0);
    expect(fs.lstatSync(marker).isSymbolicLink()).toBe(true);
  });
});
it.skipIf(process.platform === "win32")("rejects a live postmaster.pid symlink before invoking pg_ctl", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(path.join(data, "other-pid"), "456\n");
    fs.symlinkSync(path.join(data, "other-pid"), marker);
    let calls = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { calls++; }, clean, noWait)).rejects.toThrow(/PID marker/);
    expect(calls).toBe(0);
  });
});
it("rejects a directory masquerading as postmaster.pid", async () => {
  await fixture(async (data) => {
    fs.mkdirSync(path.join(data, "postmaster.pid"));
    let calls = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { calls++; }, clean, noWait)).rejects.toThrow(/PID marker/);
    expect(calls).toBe(0);
  });
});
it.skipIf(process.platform === "win32")("rejects a dangling PID symlink introduced during process inspection", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run pg_ctl"); },
      async () => {
        if (++inspections === 2)
          fs.symlinkSync(path.join(data, "absent-pid-target"), marker);
        return [];
      }, noWait)).rejects.toThrow(/PID marker/);
    expect(inspections).toBe(2);
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
it("refuses malformed postmaster.pid before calling native pg_ctl", async () => {
  const invalid = ["", "not-a-pid\n", "0\n", "-42\n", " 123\n",
    "123\\n", "999999999999999999999999\n", "123"];
  for (const contents of invalid) {
    await fixture(async (data) => {
      fs.writeFileSync(path.join(data, "postmaster.pid"), contents);
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(path.join(data, "postmaster.pid")); },
        async () => { inspections++; return []; }, noWait))
        .rejects.toThrow(/PID marker/);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
    });
  }
});

it.skipIf(process.platform === "win32")("rejects postmaster PID path replacement during opened-file validation", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, "123\n");
    const realFstat = fs.fstatSync.bind(fs);
    let stats = 0;
    let swapped = false;
    let shutdowns = 0;
    let inspections = 0;
    const spy = vi.spyOn(fs, "fstatSync").mockImplementation((fd) => {
      const result = realFstat(fd);
      if (++stats === 2) {
        fs.renameSync(marker, marker + ".owned-original");
        fs.writeFileSync(marker, "123\n");
        swapped = true;
      }
      return result;
    });
    try {
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(marker); },
        async () => { inspections++; return []; }, noWait))
        .rejects.toThrow(/PID marker/);
      expect(swapped).toBe(true);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

it("rejects high-bit PID bytes before invoking pg_ctl or process inspection", async () => {
  // Buffer.toString("ascii") silently clears bit 7; 0xB1 maps to "1".
  // A malformed marker must never authorize a native stop request.
  for (const bytes of [
    [0xb1, 0x32, 0x33, 0x0a],
    [0x31, 0xb2, 0x33, 0x0a],
    [0xb1, 0xb2, 0xb3, 0x0a],
  ]) {
    await fixture(async (data) => {
      fs.writeFileSync(path.join(data, "postmaster.pid"), Buffer.from(bytes));
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; },
        async () => { inspections++; return []; }, noWait))
        .rejects.toThrow(/PID marker/);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
    });
  }
});

it("rejects ambiguous pg_ctl paths before invoking shutdown or process inspection", async () => {
  const unsafeBinaries = [
    "\\unanchored\\pg_ctl.exe",
    "C:\\owned\\..\\pg_ctl.exe",
    "\\\\.\\C:\\owned\\pg_ctl.exe",
  ];
  for (const unsafe of unsafeBinaries) {
    await fixture(async (data) => {
      fs.writeFileSync(path.join(data, "postmaster.pid"), "123\n");
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, unsafe,
        async () => { shutdowns++; },
        async () => { inspections++; return []; }, noWait))
        .rejects.toThrow(/shutdown binary/);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
    });
  }
});

it("preserves valid extended-length and UNC pg_ctl paths for quiescence proof", async () => {
  for (const valid of [
    "\\\\?\\C:\\bostan-test\\pg_ctl.exe",
    "\\\\server\\share\\pg_ctl.exe",
  ]) {
    await fixture(async (data) => {
      let inspections = 0;
      expect(await stopOwnedWindowsEmbeddedPostgres(data, valid,
        async () => { throw Error("must not stop without a PID marker"); },
        async () => { inspections++; return []; }, noWait)).toBe("already-stopped");
      expect(inspections).toBe(2);
    });
  }
});

it("refuses unrelated shutdown binary and incomplete database identity", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), "123\n");
    await expect(stopOwnedWindowsEmbeddedPostgres(data, path.win32.join(path.win32.dirname(binary), "different.exe"),
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

it("rejects a scratch directory removed during worker verification", async () => {
  await fixture(async (data) => {
    const moved = data + "-owned-moved";
    let scans = 0;
    try {
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { throw Error("must not run pg_ctl"); },
        async () => {
          if (++scans === 2) fs.renameSync(data, moved);
          return [];
        }, noWait)).rejects.toThrow(/cluster|directory|identity/i);
      expect(scans).toBe(2);
    } finally {
      if (fs.existsSync(moved)) fs.renameSync(moved, data);
    }
  });
});
it("rejects a replaced scratch directory with a fresh PG_VERSION", async () => {
  await fixture(async (data) => {
    const moved = data + "-owned-original";
    let scans = 0;
    try {
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { throw Error("must not run pg_ctl"); },
        async () => {
          if (++scans === 2) {
            fs.renameSync(data, moved);
            fs.mkdirSync(data);
            fs.writeFileSync(path.join(data, "PG_VERSION"), "18");
          }
          return [];
        }, noWait)).rejects.toThrow(/cluster|directory|identity/i);
      expect(scans).toBe(2);
    } finally {
      if (fs.existsSync(moved)) {
        if (fs.existsSync(data)) fs.rmSync(data, { recursive: true, force: true });
        fs.renameSync(moved, data);
      }
    }
  });
});


it("rejects cluster replacement after pg_ctl stop but before worker proof completes", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, "123\n");
    const moved = data + "-owned-original";
    let scans = 0;
    try {
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { fs.unlinkSync(marker); },
        async () => {
          if (++scans === 2) {
            fs.renameSync(data, moved);
            fs.mkdirSync(data);
            fs.writeFileSync(path.join(data, "PG_VERSION"), "18");
          }
          return [];
        }, noWait)).rejects.toThrow(/cluster identity changed/);
      expect(scans).toBe(2);
    } finally {
      if (fs.existsSync(moved)) {
        if (fs.existsSync(data)) fs.rmSync(data, { recursive: true, force: true });
        fs.renameSync(moved, data);
      }
    }
  });
});
it("rejects PG_VERSION disappearing during worker verification", async () => {
  await fixture(async (data) => {
    let scans = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run pg_ctl"); },
      async () => {
        if (++scans === 2) fs.unlinkSync(path.join(data, "PG_VERSION"));
        return [];
      }, noWait)).rejects.toThrow(/cluster identity changed/);
    expect(scans).toBe(2);
  });
});

it("rejects a PG_VERSION directory before issuing a clean teardown receipt", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    fs.unlinkSync(version);
    fs.mkdirSync(version);
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not invoke pg_ctl"); },
      async () => { inspections++; return []; }, noWait))
      .rejects.toThrow(/PostgreSQL|PG_VERSION|identity/i);
    expect(inspections).toBe(0);
  });
});

it("rejects PG_VERSION replaced by a different regular file during worker proof", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    const original = path.join(data, "PG_VERSION-original");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not invoke pg_ctl"); },
      async () => {
        if (++inspections === 2) {
          fs.renameSync(version, original);
          fs.writeFileSync(version, "18");
        }
        return [];
      }, noWait)).rejects.toThrow(/identity|PG_VERSION/i);
    expect(inspections).toBe(2);
    expect(fs.existsSync(original)).toBe(true);
  });
});

it.skipIf(process.platform === "win32")("rejects a dangling PG_VERSION symlink before inspecting processes", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    fs.unlinkSync(version);
    fs.symlinkSync(path.join(data, "nonexistent-version"), version);
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not invoke pg_ctl"); },
      async () => { inspections++; return []; }, noWait))
      .rejects.toThrow(/PostgreSQL|PG_VERSION|identity/i);
    expect(inspections).toBe(0);
  });
});

it.skipIf(process.platform === "win32")("rejects PG_VERSION changed into a symlink during worker proof", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    const original = path.join(data, "PG_VERSION-original");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not invoke pg_ctl"); },
      async () => {
        if (++inspections === 2) {
          fs.renameSync(version, original);
          fs.symlinkSync(original, version);
        }
        return [];
      }, noWait)).rejects.toThrow(/identity|PG_VERSION/i);
    expect(inspections).toBe(2);
  });
});

it("rejects PG_VERSION changed in place while workers are inspected", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    const originalIdentity = fs.lstatSync(version);
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run pg_ctl"); },
      async () => {
        if (++inspections === 2) fs.writeFileSync(version, "19");
        return [];
      }, noWait)).rejects.toThrow(/version|identity|cluster/i);
    expect(inspections).toBe(2);
    expect(fs.lstatSync(version).ino).toBe(originalIdentity.ino);
  });
});

it("rejects PG_VERSION rewritten with non-version bytes at the same inode", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run pg_ctl"); },
      async () => {
        if (++inspections === 2) fs.writeFileSync(version, "XX");
        return [];
      }, noWait)).rejects.toThrow(/version|identity|cluster/i);
    expect(inspections).toBe(2);
  });
});

it("rejects PG_VERSION in-place modification after a real stop request", async () => {
  await fixture(async (data) => {
    const version = path.join(data, "PG_VERSION");
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, "123\n");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(marker); },
      async () => {
        if (++inspections === 2) fs.writeFileSync(version, "19");
        return [];
      }, noWait)).rejects.toThrow(/version|identity|cluster/i);
    expect(inspections).toBe(2);
  });
});


it("rejects whitespace-only CIM executable paths instead of accepting a clean scan", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop unknown processes"); },
      async () => { inspections++; return [row("   ")]; }, noWait))
      .rejects.toThrow(/Ambiguous/);
    expect(inspections).toBe(1);
  });
});

it("rejects ambiguous dot-segment CIM executable paths instead of treating them as foreign", async () => {
  await fixture(async (data) => {
    const ambiguous = pinnedExe.replace(/postgres\.exe$/i, "other\\..\\postgres.exe");
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop unknown processes"); },
      async () => { inspections++; return [row(ambiguous)]; }, noWait))
      .rejects.toThrow(/Ambiguous/);
    expect(inspections).toBe(1);
  });
});

it.skipIf(process.platform !== "win32")("recognizes native Windows extended-length path alias as pinned postgres.exe", async () => {
  await fixture(async (data) => {
    const extended = "\\\\?\\" + pinnedExe;
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop foreign processes"); },
      async () => { inspections++; return [row(extended)]; }, noWait))
      .rejects.toThrow(/processes remain/);
    expect(inspections).toBe(20);
  });
});

it("rejects drive-less rooted CIM executable paths rather than treating them as foreign", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop unknown processes"); },
      async () => { inspections++; return [row("\\unanchored\\postgres.exe")]; }, noWait))
      .rejects.toThrow(/Ambiguous/);
    expect(inspections).toBe(1);
  });
});

it("rejects CIM executable paths inconsistent with the postgres.exe process name", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    const inconsistent = path.win32.join("C:\\", "foreign", "not-postgres.exe");
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop unknown processes"); },
      async () => { inspections++; return [row(inconsistent)]; }, noWait))
      .rejects.toThrow(/Ambiguous/);
    expect(inspections).toBe(1);
  });
});

it("accepts a fully anchored foreign UNC postgres.exe without terminating it", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    const foreign = "\\\\server\\share\\postgres.exe";
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop foreign processes"); },
      async () => { inspections++; return [row(foreign)]; }, noWait))
      .toBe("already-stopped");
    expect(inspections).toBe(2);
  });
});

it("rejects a CIM executable path ending in a directory separator", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    const ambiguous = path.win32.join("C:\\", "foreign", "postgres.exe") + "\\";
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop unknown processes"); },
      async () => { inspections++; return [row(ambiguous)]; }, noWait))
      .rejects.toThrow(/Ambiguous/);
    expect(inspections).toBe(1);
  });
});

it("rejects ambiguous device namespace CIM paths", async () => {
  await fixture(async (data) => {
    const ambiguous = "\\\\.\\C:\\untrusted\\postgres.exe";
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not stop unknown processes"); },
      async () => [row(ambiguous)], noWait))
      .rejects.toThrow(/Ambiguous/);
  });
});

it("rejects Windows CIM executable paths containing forbidden control characters or alternate streams", async () => {
  const ambiguousPaths = [
    path.win32.join("C:\\", "foreign", "bad\tsegment", "postgres.exe"),
    path.win32.join("C:\\", "foreign", "bad\u0007segment", "postgres.exe"),
    path.win32.join("C:\\", "foreign:stream", "postgres.exe"),
  ];
  for (const ambiguous of ambiguousPaths) {
    await fixture(async (data) => {
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { throw Error("must not stop an ambiguous process"); },
        async () => { inspections++; return [row(ambiguous)]; }, noWait))
        .rejects.toThrow(/Ambiguous/);
      expect(inspections).toBe(1);
    });
  }
});
