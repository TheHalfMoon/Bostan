import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createWindowsPostgresInspectorSession, type SpawnInspector } from "./windows-postgres-inspector-session.js";

vi.mock("./windows-postgres-inspector-binary.mjs", () => ({
  resolveWindowsPostgresInspectorBinary: () => "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
}));

function fakePowerShell(answer: (request: number) => string | null) {
  const spawned: Array<{ binary: string; args: readonly string[] }> = [];
  const children: Array<EventEmitter & { kill: () => void; killed: boolean }> = [];
  const spawnInspector: SpawnInspector = (binary, args) => {
    spawned.push({ binary, args });
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), killed: false,
      kill() { this.killed = true; },
    });
    let requests = 0;
    child.stdin.on("data", () => {
      const line = answer(++requests);
      if (line !== null) child.stdout.write(`${line}\r\n`);
    });
    children.push(child);
    return child as never;
  };
  return { spawned, children, spawnInspector };
}

describe("Windows PostgreSQL inspector session", () => {
  it("reuses one pinned PowerShell process across scans", async () => {
    const fake = fakePowerShell((n) => `ok [{"ProcessId":${n}}]`);
    const session = createWindowsPostgresInspectorSession(fake.spawnInspector);
    expect(await session.inspect()).toEqual([{ ProcessId: 1 }]);
    expect(await session.inspect()).toEqual([{ ProcessId: 2 }]);
    expect(fake.spawned).toHaveLength(1);
    expect(fake.spawned[0]!.binary).toMatch(/WindowsPowerShell\v1\.0\powershell\.exe$/);
    expect(fake.spawned[0]!.args).toEqual(expect.arrayContaining(["-NoProfile", "-NonInteractive", "-EncodedCommand"]));
    session.close();
    expect(fake.children[0]!.killed).toBe(true);
  });

  it("serializes concurrent scans", async () => {
    const fake = fakePowerShell((n) => `ok [${n}]`);
    const session = createWindowsPostgresInspectorSession(fake.spawnInspector);
    expect(await Promise.all([session.inspect(), session.inspect(), session.inspect()])).toEqual([[1], [2], [3]]);
    session.close();
  });

  it("fails closed on a query error or malformed output", async () => {
    const fake = fakePowerShell((n) => (n === 1 ? "error" : "ok {not json"));
    const session = createWindowsPostgresInspectorSession(fake.spawnInspector);
    await expect(session.inspect()).rejects.toThrow(/query failed/);
    await expect(session.inspect()).rejects.toThrow(/invalid JSON/);
    session.close();
  });

  it("discards the session and fails when PowerShell exits mid-scan, then restarts", async () => {
    let first = true;
    const fake = fakePowerShell(() => null);
    const session = createWindowsPostgresInspectorSession((binary, args) => {
      const child = fake.spawnInspector(binary, args) as unknown as EventEmitter & { stdout: PassThrough; stdin: PassThrough };
      if (first) {
        first = false;
        child.stdin.on("data", () => child.emit("exit", 1));
      } else {
        child.stdin.on("data", () => child.stdout.write("ok []\n"));
      }
      return child as never;
    });
    await expect(session.inspect()).rejects.toThrow(/session ended/);
    expect(await session.inspect()).toEqual([]);
    expect(fake.spawned).toHaveLength(2);
    session.close();
  });
});
