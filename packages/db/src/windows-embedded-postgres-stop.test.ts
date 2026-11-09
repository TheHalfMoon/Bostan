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
// Pre-stop inspection proves PID 123 belongs to the pinned postgres.exe.
// Preserve the original post-stop callback counters in existing tests.
function withOwnedPostmaster(inspect: () => Promise<WindowsPostgresProcess[]>) {
  let first = true;
  return async () => {
    if (first) { first = false; return [row()]; }
    return inspect();
  };
}

async function fixture(run: (data: string) => Promise<void>) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-windows-pg-stop-"));
  fs.writeFileSync(path.join(data, "PG_VERSION"), "18");
  try { await run(data); } finally { fs.rmSync(data, { recursive: true, force: true }); }
}
// Real postmaster.pid includes its absolute data-directory path on line 2.
function validPidMarker(data: string, pid = 123): string {
  // PostgreSQL line 3 is the whole-second postmaster launch timestamp.
  const startEpoch = Math.floor(Date.parse("2026-10-30T12:00:00Z") / 1000);
  return `${pid}\n${fs.realpathSync(data)}\n${startEpoch}\n`;
}

it("refuses a hardlinked PG_VERSION before any process inspection or shutdown", async () => {
  await fixture(async (data) => {
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-owned-version-link-"));
    const external = path.join(externalRoot, "version-alias");
    try {
      fs.linkSync(path.join(data, "PG_VERSION"), external);
      let inspections = 0;
      let shutdowns = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; },
        async () => { inspections++; return []; }, noWait))
        .rejects.toThrow(/version marker/i);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
      expect(fs.readFileSync(external, "utf8")).toBe("18");
    } finally {
      fs.unlinkSync(external);
      fs.rmdirSync(externalRoot);
    }
  });
});

it("refuses a hardlinked postmaster.pid before signaling the pinned binary", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-owned-pid-link-"));
    const external = path.join(externalRoot, "pid-alias");
    try {
      fs.linkSync(marker, external);
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(marker); },
        async () => { inspections++; return inspections === 1 ? [row()] : []; }, noWait))
        .rejects.toThrow(/PID marker/i);
      expect(shutdowns).toBe(0);
      expect(fs.existsSync(marker)).toBe(true);
      expect(inspections).toBe(0);
      expect(fs.readFileSync(external, "utf8")).toBe(validPidMarker(data));
    } finally {
      fs.unlinkSync(external);
      fs.rmdirSync(externalRoot);
    }
  });
});

it("refuses a newly hardlinked PG_VERSION during asynchronous process inspection", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-owned-version-race-"));
    const external = path.join(externalRoot, "version-alias");
    try {
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(marker); },
        async () => {
          if (++inspections === 1) {
            fs.linkSync(path.join(data, "PG_VERSION"), external);
            return [row()];
          }
          return [];
        }, noWait))
        .rejects.toThrow(/cluster identity changed/i);
      expect(inspections).toBe(1);
      expect(shutdowns).toBe(0);
      expect(fs.existsSync(marker)).toBe(true);
    } finally {
      fs.unlinkSync(external);
      fs.rmdirSync(externalRoot);
    }
  });
});

it("refuses a newly hardlinked postmaster.pid during asynchronous process inspection", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-owned-pid-race-"));
    const external = path.join(externalRoot, "pid-alias");
    try {
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(marker); },
        async () => {
          if (++inspections === 1) {
            fs.linkSync(marker, external);
            return [row()];
          }
          return [];
        }, noWait))
        .rejects.toThrow(/PID marker/i);
      expect(inspections).toBe(1);
      expect(shutdowns).toBe(0);
      expect(fs.existsSync(marker)).toBe(true);
    } finally {
      fs.unlinkSync(external);
      fs.rmdirSync(externalRoot);
    }
  });
});

it("rejects a postmaster PID marker pointing to a different data directory before pg_ctl", async () => {
  await fixture(async (data) => {
    // PostgreSQL writes its data-directory path on the second PID-marker line.
    // A foreign marker must never authorize even a fake shutdown invocation.
    fs.writeFileSync(path.join(data, "postmaster.pid"),
      `123\n${fs.realpathSync(os.tmpdir())}\n`);
    let shutdowns = 0;
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { shutdowns++; },
      async () => { inspections++; return []; }, noWait))
      .rejects.toThrow(/PID marker/);
    expect(shutdowns).toBe(0);
    expect(inspections).toBe(0);
  });
});
it("rejects missing, relative and invalid-byte cluster paths in a PID marker", async () => {
  const invalid = [
    Buffer.from("123\n"),
    Buffer.from("123\nrelative-cluster\n"),
    Buffer.from([0x31, 0x32, 0x33, 0x0a, 0xff, 0x0a]),
  ];
  for (const bytes of invalid) {
    await fixture(async (data) => {
      fs.writeFileSync(path.join(data, "postmaster.pid"), bytes);
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
it("rejects a foreign PID in an otherwise valid owned cluster marker before shutdown", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data, 123));
    for (const processRow of [
      { ...row(), ProcessId: 999 },
      { ...row("C:\\foreign\\postgres.exe"), ProcessId: 123 },
    ]) {
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(marker); },
        async () => { inspections++; return [processRow]; }, noWait))
        .rejects.toThrow(/postmaster identity/i);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(1);
      expect(fs.existsSync(marker)).toBe(true);
    }
  });
});

it("refuses a reused PID from the pinned postgres.exe when CIM creation is stale", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    let shutdowns = 0;
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { shutdowns++; },
      async () => {
        inspections++;
        return [{ ...row(), CreationDate: "2026-10-30T11:00:00Z" }];
      }, noWait)).rejects.toThrow(/postmaster identity/i);
    expect(inspections).toBe(1);
    expect(shutdowns).toBe(0);
    expect(fs.existsSync(marker)).toBe(true);
  });
});

it("rejects a missing or malformed postmaster start timestamp before inspecting processes", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    for (const line3 of ["", "0", "not-a-timestamp", "0012345678", "9999999999999999999"]) {
      fs.writeFileSync(marker, `123\n${fs.realpathSync(data)}\n${line3}\n`);
      let shutdowns = 0;
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; },
        async () => { inspections++; return [row()]; }, noWait))
        .rejects.toThrow(/PID marker/i);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
    }
  });
});

it("rejects duplicate or ambiguous CIM process identities before pg_ctl", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    for (const snapshot of [
      [row(), { ...row(), CreationDate: "2026-10-30T12:00:01Z" }],
      [{ ...row(), ExecutablePath: null }],
    ]) {
      let shutdowns = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; },
        async () => snapshot, noWait)).rejects.toThrow(/Ambiguous/);
      expect(shutdowns).toBe(0);
      expect(fs.existsSync(marker)).toBe(true);
    }
  });
});
it("rejects postmaster PID marker replacement during asynchronous process inspection", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data, 123));
    let shutdowns = 0;
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { shutdowns++; },
      async () => {
        inspections++;
        fs.writeFileSync(marker, validPidMarker(data, 124));
        return [row()];
      }, noWait)).rejects.toThrow(/PID marker identity/);
    expect(inspections).toBe(1);
    expect(shutdowns).toBe(0);
    expect(fs.existsSync(marker)).toBe(true);
  });
});

it("requires two clean snapshots after fixed graceful shutdown", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
    let calls = 0;
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary, async (file, args) => {
      expect(file).toBe(binary);
      expect(args).toEqual(["-D", fs.realpathSync(data), "-m", "fast", "-w", "-t", "40", "stop"]);
      calls++;
      fs.unlinkSync(path.join(data, "postmaster.pid"));
    }, withOwnedPostmaster(async () => { inspections++; return []; }), noWait)).toBe("stopped");
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
    fs.writeFileSync(marker, validPidMarker(data));
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(marker); },
      withOwnedPostmaster(async () => {
        if (++inspections === 2) fs.writeFileSync(marker, "999\\n");
        return [];
      }), noWait)).rejects.toThrow(/reappeared/);
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
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
    let inspected = false;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary, async () => {},
      withOwnedPostmaster(async () => { inspected = true; return []; }), noWait)).rejects.toThrow(/survived/);
    expect(inspected).toBe(false);
  });
});
it("refuses malformed postmaster.pid before calling native pg_ctl", async () => {
  const invalid = ["", "not-a-pid\n", "0\n", "-42\n", " 123\n",
    "123\\n", "999999999999999999999999\n", "123", "123\n"];
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
    fs.writeFileSync(marker, validPidMarker(data));
    const realFstat = fs.fstatSync.bind(fs);
    let stats = 0;
    let swapped = false;
    let shutdowns = 0;
    let inspections = 0;
    const spy = vi.spyOn(fs, "fstatSync").mockImplementation((fd) => {
      const result = realFstat(fd);
      if (++stats === 2) {
        fs.renameSync(marker, marker + ".owned-original");
        fs.writeFileSync(marker, validPidMarker(data));
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
      fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
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
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
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
    fs.writeFileSync(marker, validPidMarker(data));
    const moved = data + "-owned-original";
    let scans = 0;
    try {
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { fs.unlinkSync(marker); },
        withOwnedPostmaster(async () => {
          if (++scans === 2) {
            fs.renameSync(data, moved);
            fs.mkdirSync(data);
            fs.writeFileSync(path.join(data, "PG_VERSION"), "18");
          }
          return [];
        }), noWait)).rejects.toThrow(/cluster identity changed/);
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
    fs.writeFileSync(marker, validPidMarker(data));
    let inspections = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(marker); },
      withOwnedPostmaster(async () => {
        if (++inspections === 2) fs.writeFileSync(version, "19");
        return [];
      }), noWait)).rejects.toThrow(/version|identity|cluster/i);
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

it("refuses PG_VERSION mutation during PID verification before issuing pg_ctl", async () => {
  await fixture(async (data) => {
    const pidMarker = path.join(data, "postmaster.pid");
    const versionMarker = path.join(data, "PG_VERSION");
    fs.writeFileSync(pidMarker, validPidMarker(data));
    const realFstat = fs.fstatSync.bind(fs);
    let fstats = 0;
    let mutated = false;
    let shutdowns = 0;
    let inspections = 0;
    const spy = vi.spyOn(fs, "fstatSync").mockImplementation((fd) => {
      const stat = realFstat(fd);
      if (++fstats === 2) {
        fs.writeFileSync(versionMarker, "17");
        mutated = true;
      }
      return stat;
    });
    try {
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { shutdowns++; fs.unlinkSync(pidMarker); },
        withOwnedPostmaster(async () => { inspections++; return []; }), noWait))
        .rejects.toThrow(/cluster identity changed/);
      expect(mutated).toBe(true);
      expect(shutdowns).toBe(0);
      expect(inspections).toBe(0);
      expect(fs.readFileSync(versionMarker, "utf8")).toBe("17");
    } finally {
      spy.mockRestore();
    }
  });
});

it("rejects ambiguous Windows CIM process creation dates before a clean receipt", async () => {
  // PowerShell's pinned inspector emits UTC round-trip ISO dates. JavaScript's
  // Date.parse accepts unrelated strings such as "1" and normalizes invalid days.
  for (const creationDate of [
    "1",
    "2026-02-31T12:00:00Z",
    "2026-10-30T12:00:00",
    "2026-10-30T12:00:00+03:00",
    "2026-10-30",
  ]) {
    await fixture(async (data) => {
      let inspections = 0;
      await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
        async () => { throw Error("must not stop any PostgreSQL process"); },
        async () => {
          inspections++;
          return [{ ...row("C:\\foreign\\postgres.exe"), CreationDate: creationDate }];
        }, noWait)).rejects.toThrow(/Ambiguous Windows PostgreSQL process identity/);
      expect(inspections).toBe(1);
    });
  }
});

it("accepts the actual PowerShell UTC round-trip CIM date precision", async () => {
  await fixture(async (data) => {
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("must not run pg_ctl"); },
      async () => {
        inspections++;
        return [{ ...row("C:\\foreign\\postgres.exe"), CreationDate: "2026-10-30T12:00:00.1234567Z" }];
      }, noWait)).toBe("already-stopped");
    expect(inspections).toBe(2);
  });
});

it("rechecks one transient missing CIM executable before verified owned postmaster shutdown", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    let inspections = 0, shutdowns = 0, pauses = 0;
    const result = await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { shutdowns++; fs.unlinkSync(marker); },
      async () => {
        inspections++;
        if (inspections === 1) return [{...row(), ExecutablePath: null}];
        if (inspections === 2) return [row()];
        return [];
      }, async () => { pauses++; });
    expect(result).toBe("stopped");
    expect(shutdowns).toBe(1);
    expect(inspections).toBe(4);
    expect(pauses).toBe(2); // one bounded reinspection, one clean-snapshot interval
  });
});
it("rechecks transient missing CIM creation timestamp without authorizing pg_ctl", async () => {
  await fixture(async (data) => {
    let inspections = 0, pauses = 0;
    const result = await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { throw Error("no postmaster marker: must not issue pg_ctl"); },
      async () => {
        inspections++;
        return inspections === 1 ? [{...row(), CreationDate: null}] : [];
      }, async () => { pauses++; });
    expect(result).toBe("already-stopped");
    expect(inspections).toBe(3);
    expect(pauses).toBe(2);
  });
});
it("never shuts down or deletes when every retry has ambiguous CIM metadata", async () => {
  await fixture(async (data) => {
    const marker = path.join(data, "postmaster.pid");
    fs.writeFileSync(marker, validPidMarker(data));
    let inspections = 0, shutdowns = 0, pauses = 0;
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { shutdowns++; },
      async () => { inspections++; return [{...row(), ExecutablePath: null}]; },
      async () => { pauses++; })).rejects.toThrow(/Ambiguous Windows PostgreSQL process identity/);
    expect(inspections).toBe(4);
    expect(pauses).toBe(3);
    expect(shutdowns).toBe(0);
    expect(fs.existsSync(marker)).toBe(true);
  });
});

// #234: after a graceful stop, wait only for the stopped cluster's processes.
const ownedChild = (pid: number, parent = 123, created = "2026-10-30T12:00:05Z"): WindowsPostgresProcess => ({
  ProcessId: pid, ParentProcessId: parent, ExecutablePath: pinnedExe, CreationDate: created,
});
it("does not wait for another suite's cluster from the same pinned binary after pg_ctl", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
    const otherSuite = [ownedChild(900, 1), ownedChild(901, 900)];
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(path.join(data, "postmaster.pid")); },
      withOwnedPostmaster(async () => { inspections++; return otherSuite; }), noWait)).toBe("stopped");
    expect(inspections).toBe(2);
  });
});
it("waits for an orphaned io_worker of the stopped postmaster before declaring success", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
    let inspections = 0;
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(path.join(data, "postmaster.pid")); },
      withOwnedPostmaster(async () => (++inspections <= 2 ? [ownedChild(124)] : [])), noWait)).toBe("stopped");
    expect(inspections).toBe(4);
  });
});
it("retains the fixture while an orphaned child of the stopped postmaster never exits", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
    await expect(stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(path.join(data, "postmaster.pid")); },
      withOwnedPostmaster(async () => [ownedChild(124)]), noWait)).rejects.toThrow(/processes remain/);
  });
});
it("ignores a process whose parent PID was held by an earlier process before this postmaster started", async () => {
  await fixture(async (data) => {
    fs.writeFileSync(path.join(data, "postmaster.pid"), validPidMarker(data));
    expect(await stopOwnedWindowsEmbeddedPostgres(data, binary,
      async () => { fs.unlinkSync(path.join(data, "postmaster.pid")); },
      withOwnedPostmaster(async () => [ownedChild(124, 123, "2026-10-30T11:00:00Z")]), noWait)).toBe("stopped");
  });
});
