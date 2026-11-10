/**
 * Test-only native Windows PostgreSQL process inspector that reuses one
 * PowerShell process. Starting PowerShell costs roughly 2.5 s per call on a
 * typical Windows host; the graceful stop proof needs at least three scans,
 * which pushed every embedded-cluster teardown past Vitest's hook timeout.
 *
 * Every scan is still a fresh CIM query. Any protocol error, timeout or exit
 * discards the session and fails closed; the caller retains its fixture.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolveWindowsPostgresInspectorBinary } from "./windows-postgres-inspector-binary.mjs";

const SCAN_TIMEOUT_MS = 10_000;
const IDLE_CLOSE_MS = 5_000;
const MAX_LINE_BYTES = 131_072;

// Reads one request line per scan and answers with one JSON line. Only
// process identity fields are collected; no command lines or environment.
const SESSION_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  "while ($null -ne ($request = [Console]::In.ReadLine())) {",
  "  try {",
  "    $items=@(Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Select-Object ProcessId,ParentProcessId,ExecutablePath,@{Name='CreationDate';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}})",
  "    [Console]::Out.WriteLine('ok ' + (ConvertTo-Json -InputObject $items -Compress -Depth 3))",
  "  } catch { [Console]::Out.WriteLine('error') }",
  "  [Console]::Out.Flush()",
  "}",
].join("\n");

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };

export type SpawnInspector = (binary: string, args: readonly string[]) => ChildProcessWithoutNullStreams;

const defaultSpawn: SpawnInspector = (binary, args) =>
  spawn(binary, [...args], { windowsHide: true, shell: false, stdio: ["pipe", "pipe", "ignore"] }) as unknown as ChildProcessWithoutNullStreams;

export function createWindowsPostgresInspectorSession(spawnInspector: SpawnInspector = defaultSpawn) {
  let child: ChildProcessWithoutNullStreams | null = null;
  let buffer = "";
  let pending: Pending | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let idle: NodeJS.Timeout | null = null;

  function discard(): void {
    const current = child;
    child = null;
    buffer = "";
    if (current) {
      current.removeAllListeners();
      current.stdout.removeAllListeners();
      current.stdin.removeAllListeners();
      current.stdin.on("error", () => {});
      try { current.kill(); } catch { /* already exited */ }
    }
    if (pending) {
      clearTimeout(pending.timer);
      const failed = pending;
      pending = null;
      failed.reject(Error("Windows PostgreSQL inspector session ended"));
    }
  }

  function start(): ChildProcessWithoutNullStreams {
    const encoded = Buffer.from(SESSION_SCRIPT, "utf16le").toString("base64");
    const created = spawnInspector(resolveWindowsPostgresInspectorBinary(), [
      "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded,
    ]);
    created.stdout.setEncoding("utf8");
    created.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > MAX_LINE_BYTES) { discard(); return; }
      const newline = buffer.indexOf("\n");
      if (newline < 0 || !pending) return;
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      const current = pending;
      pending = null;
      clearTimeout(current.timer);
      if (!line.startsWith("ok ")) { current.reject(Error("Windows PostgreSQL inspector query failed")); return; }
      try { current.resolve(JSON.parse(line.slice(3))); } catch { current.reject(Error("Windows PostgreSQL inspector returned invalid JSON")); }
    });
    created.on("exit", discard);
    created.on("error", discard);
    created.stdin.on("error", discard);
    return created;
  }

  function scan(): Promise<unknown> {
    if (idle) { clearTimeout(idle); idle = null; }
    if (!child) child = start();
    const session = child;
    return new Promise<unknown>((resolve, reject) => {
      pending = {
        resolve,
        reject,
        timer: setTimeout(() => { discard(); }, SCAN_TIMEOUT_MS),
      };
      session.stdin.write("scan\n");
    }).finally(() => {
      // Close an idle session so it never keeps a test worker alive.
      if (child === session) {
        idle = setTimeout(() => { if (child === session && !pending) discard(); }, IDLE_CLOSE_MS);
        idle.unref();
      }
    });
  }

  return {
    /** Serialized CIM scan returning the parsed JSON array (or a failure). */
    inspect(): Promise<unknown> {
      const next = queue.then(scan, scan);
      queue = next.catch(() => {});
      return next;
    },
    close(): void {
      if (idle) { clearTimeout(idle); idle = null; }
      discard();
    },
  };
}
