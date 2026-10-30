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
function normalizedExecutable(value: string): string {
  return value.replace(/\//g, "\\").toLowerCase();
}
function isValidProcess(value: unknown): value is WindowsPostgresProcess {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<WindowsPostgresProcess>;
  return Number.isSafeInteger(p.ProcessId) && (p.ProcessId ?? 0) > 0
    && Number.isSafeInteger(p.ParentProcessId) && (p.ParentProcessId ?? -1) >= 0
    && typeof p.ExecutablePath === "string" && p.ExecutablePath.length > 0
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
  const expected = normalizedExecutable(path.join(path.dirname(pgCtlExe), "postgres.exe"));
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
    if (snapshot.some((p: WindowsPostgresProcess) =>
      normalizedExecutable(p.ExecutablePath!) === expected)) {
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
  try {
    initialVersion = fs.lstatSync(versionMarker);
    if (!initialVersion.isFile() || initialVersion.isSymbolicLink())
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
          || currentVersion.birthtimeMs !== initialVersion.birthtimeMs) {
        throw Error("changed");
      }
    } catch {
      throw Error("Owned PostgreSQL cluster identity changed during worker verification; retaining fixture");
    }
  }
  if (!path.isAbsolute(pgCtlExe) || path.basename(pgCtlExe).toLowerCase() !== "pg_ctl.exe")
    throw Error("Refusing unknown PostgreSQL shutdown binary");
  const marker = path.join(data, "postmaster.pid");
  if (!pidMarkerPresent(marker)) {
    await provePinnedBinaryQuiescent(pgCtlExe, inspect, pause);
    if (pidMarkerPresent(marker))
      throw Error("PostgreSQL PID marker reappeared during worker verification; retaining fixture");
    assertClusterIdentityUnchanged();
    return "already-stopped";
  }
  await run(pgCtlExe, ["-D", data, "-m", "fast", "-w", "-t", "40", "stop"]);
  if (pidMarkerPresent(marker))
    throw Error("PostgreSQL PID marker survived graceful shutdown");
  await provePinnedBinaryQuiescent(pgCtlExe, inspect, pause);
  if (pidMarkerPresent(marker))
    throw Error("PostgreSQL PID marker reappeared during worker verification; retaining fixture");
  assertClusterIdentityUnchanged();
  return "stopped";
}
