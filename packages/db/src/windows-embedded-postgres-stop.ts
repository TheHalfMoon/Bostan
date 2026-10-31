/** Native Windows test fixture: stop owned PostgreSQL and prove binary quiescence. */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(execFile);
type Runner = (binary: string, args: readonly string[]) => Promise<void>;
export type WindowsPostgresProcess = {
  ProcessId: number;
  ParentProcessId: number;
  ExecutablePath: string | null;
  CreationDate: string | null;
};
type Inspector = () => Promise<unknown>;
type Pause = (milliseconds: number) => Promise<void>;
const actualRun: Runner = async (binary, args) => {
  await execAsync(binary, [...args], {
    windowsHide: true, shell: false, timeout: 45_000, maxBuffer: 131_072,
  });
};
const actualInspect: Inspector = async () => {
  // No dynamic interpolation, command lines, environment or process output logs.
  // Collect only process identity fields; a denied CIM query must fail closed.
  const script = [
    "$ErrorActionPreference='Stop'",
    "$items=@(Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Select-Object ProcessId,ParentProcessId,ExecutablePath,@{Name='CreationDate';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}})",
    "ConvertTo-Json -InputObject $items -Compress -Depth 3",
  ].join("; ");
  try {
    const { stdout } = await execAsync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command", script,
    ], { windowsHide: true, shell: false, timeout: 10_000, maxBuffer: 131_072 });
    return JSON.parse(stdout);
  } catch {
    throw Error("Unable to inspect Windows PostgreSQL processes; retaining fixture");
  }
};
const actualPause: Pause = async (ms) => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};
// CIM may report the same executable through a Win32 extended-length path.
// Reject unresolvable device namespaces and dot-segments instead of mistaking
// an ambiguous PostgreSQL process for an unrelated one.
function normalizedExecutable(value: string): string | null {
  if (!value || value !== value.trim() || /[\x00-\x1f\x7f]/.test(value)) return null;
  let candidate = value.replace(/\//g, "\\");
  if (candidate.startsWith("\\\\?\\")) {
    const rest = candidate.slice(4);
    if (/^[a-z]:\\/i.test(rest)) candidate = rest;
    else if (/^UNC\\/i.test(rest)) candidate = "\\\\" + rest.slice(4);
    else return null;
  } else if (candidate.startsWith("\\\\.\\")) {
    return null;
  }
  if (candidate.split("\\").some(segment =>
    segment === "." || segment === ".." || /[. ]$/.test(segment))) return null;
  // win32.isAbsolute also accepts drive-less rooted paths (\\foo), which
  // depend on the caller's current drive and cannot identify a CIM binary.
  // A process queried by Name='postgres.exe' must resolve to that exact leaf.
  const driveRooted = /^[a-z]:\\/i.test(candidate);
  const uncRooted = /^\\\\[^\\]+\\[^\\]+\\/.test(candidate);
  // An extra colon is not a valid executable path segment (NTFS ADS).
  // Do not mistake it for an unrelated postgres.exe process.
  if ((driveRooted ? candidate.slice(2) : candidate).includes(":")) return null;
  if ((!driveRooted && !uncRooted) || candidate.endsWith("\\")
      || path.win32.basename(candidate).toLowerCase() !== "postgres.exe") return null;
  return path.win32.normalize(candidate).toLowerCase();
}
// Validate the original pg_ctl path before any shutdown request. Deriving
// postgres.exe via path.join would erase unsafe dot segments or drive-less
// roots before they could be rejected.
function normalizedPgCtlBinary(value: string): string | null {
  if (path.win32.basename(value).toLowerCase() !== "pg_ctl.exe"
      || !/pg_ctl\.exe$/i.test(value)) return null;
  return normalizedExecutable(value.replace(/pg_ctl\.exe$/i, "postgres.exe"));
}
function isValidProcess(value: unknown): value is WindowsPostgresProcess {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<WindowsPostgresProcess>;
  return Number.isSafeInteger(p.ProcessId) && (p.ProcessId ?? 0) > 0
    && Number.isSafeInteger(p.ParentProcessId) && (p.ParentProcessId ?? -1) >= 0
    && typeof p.ExecutablePath === "string" && p.ExecutablePath.trim().length > 0
    && typeof p.CreationDate === "string" && Number.isFinite(Date.parse(p.CreationDate));
}
/**
 * Conservative policy: a process from the pinned PostgreSQL executable is
 * ambiguous across simultaneous suites. Never delete a cluster until every
 * such process is gone; never terminate any process (including foreign ones).
 * Two consecutive clean independent snapshots are required.
 */
async function provePinnedBinaryQuiescent(
  pgCtlExe: string, inspect: Inspector, pause: Pause,
): Promise<void> {
  const expected = normalizedPgCtlBinary(pgCtlExe);
  if (!expected)
    throw Error("Ambiguous pinned Windows PostgreSQL binary identity; retaining fixture");
  let clean = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let snapshot: unknown;
    try { snapshot = await inspect(); } catch {
      throw Error("Unable to inspect Windows PostgreSQL processes; retaining fixture");
    }
    if (!Array.isArray(snapshot) || !snapshot.every(isValidProcess)) {
      throw Error("Ambiguous Windows PostgreSQL process identity; retaining fixture");
    }
    // A CIM process snapshot must have a unique PID per observed process.
    // Even two rows with the same metadata are ambiguous: a colliding/reused
    // ID could otherwise falsely prove the pinned executable is quiescent.
    const pids = new Set((snapshot as WindowsPostgresProcess[]).map(p => p.ProcessId));
    if (pids.size !== snapshot.length)
      throw Error("Ambiguous duplicate Windows PostgreSQL PID; retaining fixture");
    // Normalize every row before deciding the pinned binary is absent.
    // Unknown namespace/relative/whitespace paths cannot prove quiescence.
    const executables = (snapshot as WindowsPostgresProcess[])
      .map(p => normalizedExecutable(p.ExecutablePath!));
    if (executables.some(executable => executable === null))
      throw Error("Ambiguous Windows PostgreSQL process identity; retaining fixture");
    if (executables.includes(expected)) {
      clean = 0;
    } else if (++clean === 2) {
      return;
    }
    if (attempt < 19) await pause(250);
  }
  throw Error("Pinned PostgreSQL processes remain; retaining owned fixture");
}
function pidMarkerPresent(marker: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(marker);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw Error("Unable to inspect PostgreSQL PID marker; retaining fixture");
  }
  // existsSync follows links (including dangling links), so it cannot prove
  // that postmaster.pid is an ordinary marker owned by this scratch cluster.
  if (!stat.isFile() || stat.isSymbolicLink())
    throw Error("Ambiguous PostgreSQL PID marker; retaining fixture");
  return true;
}
// The existence of postmaster.pid alone is not authority to run pg_ctl.
// Verify a bounded, ordinary PostgreSQL PID line and the same opened file
// identity before issuing the native shutdown request. Never log PID bytes.
function assertValidPidMarkerBeforeStop(marker: string): void {
  let fd: number | undefined;
  try {
    const before = fs.lstatSync(marker);
    if (!before.isFile() || before.isSymbolicLink()
        || before.size < 2 || before.size > 4096) throw Error("invalid");
    fd = fs.openSync(marker, "r"); // fstat below detects a link/replacement race.
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev
        || opened.ino !== before.ino || opened.birthtimeMs !== before.birthtimeMs)
      throw Error("changed");
    const prefix = Buffer.alloc(32);
    const length = fs.readSync(fd, prefix, 0, prefix.length, 0);
    const newline = prefix.subarray(0, length).indexOf(10);
    if (newline < 1) throw Error("invalid");
    // Node Buffer "ascii" masks the high bit (0xB1 becomes "1"). Preserve
    // original byte values so the decimal-only PID check rejects non-ASCII.
    const pidLine = prefix.subarray(0, newline).toString("latin1").replace(/\r$/, "");
    if (!/^[1-9]\d{0,9}$/.test(pidLine)
        || !Number.isSafeInteger(Number(pidLine))) throw Error("invalid");
    const after = fs.fstatSync(fd);
    if (after.dev !== before.dev || after.ino !== before.ino
        || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      throw Error("changed");
    // An open descriptor can remain valid after its pathname is replaced.
    // Recheck the marker at its original path before authorizing pg_ctl.
    const atPath = fs.lstatSync(marker);
    if (!atPath.isFile() || atPath.isSymbolicLink()
        || atPath.dev !== opened.dev || atPath.ino !== opened.ino
        || atPath.birthtimeMs !== opened.birthtimeMs
        || atPath.size !== opened.size || atPath.mtimeMs !== opened.mtimeMs)
      throw Error("changed");
  } catch {
    throw Error("Ambiguous PostgreSQL PID marker identity; retaining fixture");
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {
        throw Error("Unable to close PostgreSQL PID marker; retaining fixture");
      }
    }
  }
}
// Read at most 33 bytes, including a sentinel byte for an oversized marker.
// The path may change between lstat and open; never read an unbounded file.
function readBoundedVersionMarker(marker: string): Buffer {
  let fd: number | undefined;
  try {
    fd = fs.openSync(marker, "r");
    const bytes = Buffer.alloc(33);
    const length = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (length < 1 || length > 32) throw Error("invalid");
    return bytes.subarray(0, length);
  } catch {
    throw Error("Unable to verify PostgreSQL version marker bytes; retaining fixture");
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {
        throw Error("Unable to close PostgreSQL version marker; retaining fixture");
      }
    }
  }
}
export async function stopOwnedWindowsEmbeddedPostgres(
  dataDir: string,
  pgCtlExe: string,
  run: Runner = actualRun,
  inspect: Inspector = actualInspect,
  pause: Pause = actualPause,
): Promise<"stopped" | "already-stopped"> {
  if (process.platform !== "win32" && run === actualRun)
    throw Error("Windows-only native database test teardown");
  // A missing cluster directory is not proof that its Windows io_worker
  // children exited: another cleanup/restart can remove the marker first.
  // With no PG_VERSION or owned marker left, identity cannot be established.
  // Fail closed rather than returning a verified "already-stopped" receipt.
  if (!fs.existsSync(dataDir))
    throw Error("Missing owned PostgreSQL data directory; retaining fixture");
  const temp = fs.realpathSync(os.tmpdir());
  const data = fs.realpathSync(dataDir);
  const rel = path.relative(temp, data);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)
      || fs.lstatSync(dataDir).isSymbolicLink())
    throw Error("Refusing database shutdown outside an owned scratch directory");
  // PG_VERSION must be an ordinary file, not a directory or symlink.
  // Capture its identity as well as the cluster directory identity: a new
  // PG_VERSION at the same path is not evidence of the original cluster.
  const versionMarker = path.join(data, "PG_VERSION");
  let initialVersion: fs.Stats;
  let initialVersionBytes: Buffer;
  try {
    initialVersion = fs.lstatSync(versionMarker);
    if (!initialVersion.isFile() || initialVersion.isSymbolicLink()
        || initialVersion.size < 1 || initialVersion.size > 32)
      throw Error("ambiguous");
    initialVersionBytes = readBoundedVersionMarker(versionMarker);
    if (initialVersionBytes.length !== initialVersion.size)
      throw Error("ambiguous");
  } catch {
    throw Error("Refusing non-PostgreSQL or ambiguous version marker; retaining fixture");
  }
  // A successful worker scan does not prove the scratch directory still
  // belongs to this invocation: another actor may rename or replace it.
  const initialDir = fs.lstatSync(dataDir);
  function assertClusterIdentityUnchanged(): void {
    try {
      const current = fs.lstatSync(dataDir);
      const currentVersion = fs.lstatSync(versionMarker);
      if (!current.isDirectory() || current.isSymbolicLink()
          || current.dev !== initialDir.dev || current.ino !== initialDir.ino
          || current.birthtimeMs !== initialDir.birthtimeMs
          || fs.realpathSync(dataDir) !== data
          || !currentVersion.isFile() || currentVersion.isSymbolicLink()
          || currentVersion.dev !== initialVersion.dev
          || currentVersion.ino !== initialVersion.ino
          || currentVersion.birthtimeMs !== initialVersion.birthtimeMs
          || currentVersion.size !== initialVersion.size
          || !readBoundedVersionMarker(versionMarker).equals(initialVersionBytes)) {
        throw Error("changed");
      }
    } catch {
      throw Error("Owned PostgreSQL cluster identity changed during worker verification; retaining fixture");
    }
  }
  if (!normalizedPgCtlBinary(pgCtlExe))
    throw Error("Refusing unknown PostgreSQL shutdown binary");
  const marker = path.join(data, "postmaster.pid");
  if (!pidMarkerPresent(marker)) {
    await provePinnedBinaryQuiescent(pgCtlExe, inspect, pause);
    if (pidMarkerPresent(marker))
      throw Error("PostgreSQL PID marker reappeared during worker verification; retaining fixture");
    assertClusterIdentityUnchanged();
    return "already-stopped";
  }
  assertValidPidMarkerBeforeStop(marker);
  await run(pgCtlExe, ["-D", data, "-m", "fast", "-w", "-t", "40", "stop"]);
  if (pidMarkerPresent(marker))
    throw Error("PostgreSQL PID marker survived graceful shutdown");
  await provePinnedBinaryQuiescent(pgCtlExe, inspect, pause);
  if (pidMarkerPresent(marker))
    throw Error("PostgreSQL PID marker reappeared during worker verification; retaining fixture");
  assertClusterIdentityUnchanged();
  return "stopped";
}
