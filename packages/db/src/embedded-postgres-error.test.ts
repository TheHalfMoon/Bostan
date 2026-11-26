import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { classifyEmbeddedPostgresStartIssue, createEmbeddedPostgresLogBuffer, formatEmbeddedPostgresError, summarizeEmbeddedPostgresRuntimeDependency, summarizeEmbeddedPostgresStartDiagnostic } from "./embedded-postgres-error.js";

describe("classifyEmbeddedPostgresStartIssue", () => {
  it("returns only fixed startup issues and distinguishes absent from unknown logs", () => {
    const cases = [
      [[], "POSTGRES_START_LOGS_EMPTY"],
      [["FATAL: could not bind IPv4 address: Address already in use"], "POSTGRES_START_ADDRESS_IN_USE"],
      [["LOG:  selecting dynamic shared memory implementation \"windows\""], "POSTGRES_START_LOGS_UNCLASSIFIED"],
      [["FATAL: could not create shared memory segment"], "POSTGRES_START_SHARED_MEMORY_FAILED"],
      [["LOG: could not create shared memory segment: error code 1455"], "POSTGRES_START_SHARED_MEMORY_OS_ERROR_1455"],
      [["LOG: could not create shared memory segment: error code 8 (paging file limit)"], "POSTGRES_START_SHARED_MEMORY_OS_ERROR_8"],
      [["FATAL: could not create shared memory segment: Cannot allocate memory"], "POSTGRES_START_SHARED_MEMORY_RESOURCE_LIMIT"],
      [["FATAL: invalid value for parameter \"private-setting\""], "POSTGRES_START_CONFIGURATION_INVALID"],
      [["FATAL: database files are incompatible with server"], "POSTGRES_START_CLUSTER_INCOMPATIBLE"],
      [["FATAL: could not write file C:\\private\\base: No space left on device"], "POSTGRES_START_DISK_FULL"],
      [["PANIC: could not locate a valid checkpoint record"], "POSTGRES_START_RECOVERY_FAILED"],
      [["FATAL: private unrecognized reason at C:\\Users\\secret"], "POSTGRES_START_LOGS_UNCLASSIFIED"],
    ] as const;
    for (const [logs, expected] of cases) {
      const issue = classifyEmbeddedPostgresStartIssue([...logs]);
      expect(issue).toBe(expected);
      expect(issue).not.toContain("private");
      expect(issue).not.toContain("secret");
    }
  });
});

describe("summarizeEmbeddedPostgresStartDiagnostic", () => {
  it("extracts only allowlisted shared-memory system facts", () => {
    const summary = summarizeEmbeddedPostgresStartDiagnostic([
      "FATAL: could not create shared memory segment: error code 1455",
      "DETAIL: Failed system call was CreateFileMapping.",
      "DETAIL: private path C:\\Users\\secret\\AppData\\Local\\temp\\db",
    ]);

    expect(summary).toEqual({
      sharedMemoryFailureKind: "CREATE_FAILED",
      sharedMemoryEvidence: ["FATAL", "DETAIL", "CREATE", "OS_ERROR"],
      sharedMemorySystemCall: "CreateFileMapping",
      sharedMemoryOsErrorCode: 1455,
      sharedMemoryLogLines: [
        { severity: "FATAL", kind: "CREATE_SEGMENT" },
        { severity: "DETAIL", kind: "SYSTEM_CALL" },
      ],
      postgresLogLines: [
        { severity: "FATAL", kind: "SHARED_MEMORY", dataDirectoryCause: null },
        { severity: "DETAIL", kind: "OTHER", dataDirectoryCause: null },
        { severity: "DETAIL", kind: "OTHER", dataDirectoryCause: null },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("Users");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  it("returns no sensitive details for missing or unrecognized diagnostics", () => {
    expect(summarizeEmbeddedPostgresStartDiagnostic([])).toEqual({
      sharedMemoryFailureKind: null,
      sharedMemoryEvidence: [],
      sharedMemorySystemCall: null,
      sharedMemoryOsErrorCode: null,
      sharedMemoryLogLines: [],
      postgresLogLines: [],
    });
    expect(summarizeEmbeddedPostgresStartDiagnostic([
      "FATAL: pre-existing shared memory block is still in use",
      "DETAIL: Failed system call was PrivateApi at C:\\private\\value",
    ])).toEqual({
      sharedMemoryFailureKind: "PRE_EXISTING_BLOCK_IN_USE",
      sharedMemoryEvidence: ["FATAL", "DETAIL", "EXISTING_OBJECT"],
      sharedMemorySystemCall: null,
      sharedMemoryOsErrorCode: null,
      sharedMemoryLogLines: [
        { severity: "FATAL", kind: "MENTION_ONLY" },
        { severity: "DETAIL", kind: "SYSTEM_CALL" },
      ],
      postgresLogLines: [
        { severity: "FATAL", kind: "SHARED_MEMORY", dataDirectoryCause: null },
        { severity: "DETAIL", kind: "OTHER", dataDirectoryCause: null },
      ],
    });
  });

  it("keeps informational dynamic shared-memory logs without calling them a failure", () => {
    expect(summarizeEmbeddedPostgresStartDiagnostic([
      "LOG:  selecting dynamic shared memory implementation \"windows\"",
    ])).toEqual({
      sharedMemoryFailureKind: null,
      sharedMemoryEvidence: [],
      sharedMemorySystemCall: null,
      sharedMemoryOsErrorCode: null,
      sharedMemoryLogLines: [{ severity: "LOG", kind: "DYNAMIC_SHARED_MEMORY" }],
      postgresLogLines: [{ severity: "LOG", kind: "SHARED_MEMORY", dataDirectoryCause: null }],
    });
  });

  it("recognizes allocation language without exposing log text", () => {
    expect(summarizeEmbeddedPostgresStartDiagnostic([
      "FATAL: could not allocate shared memory for worker",
    ])).toEqual({
      sharedMemoryFailureKind: "RESOURCE_LIMIT",
      sharedMemoryEvidence: ["FATAL", "ALLOCATE", "RESOURCE_LIMIT"],
      sharedMemorySystemCall: null,
      sharedMemoryOsErrorCode: null,
      sharedMemoryLogLines: [{ severity: "FATAL", kind: "ALLOCATION" }],
      postgresLogLines: [{ severity: "FATAL", kind: "SHARED_MEMORY", dataDirectoryCause: null }],
    });
  });

  it("summarizes only the severity and fixed class for other PostgreSQL errors", () => {
    const summary = summarizeEmbeddedPostgresStartDiagnostic([
      "2026-11-23 00:00:00 UTC [42] FATAL: private failure at C:\\Users\\secret\\db",
    ]);
    expect(summary.postgresLogLines).toEqual([{ severity: "FATAL", kind: "ERROR_OTHER", dataDirectoryCause: null }]);
    expect(JSON.stringify(summary)).not.toContain("Users");
    expect(JSON.stringify(summary)).not.toContain("private");
  });

  it("reports fixed data-directory causes without exposing the directory path", () => {
    const summary = summarizeEmbeddedPostgresStartDiagnostic([
      'FATAL: data directory "C:\\Users\\secret\\data" has invalid permissions',
    ]);
    expect(summary.postgresLogLines).toEqual([{
      severity: "FATAL",
      kind: "DATA_DIRECTORY",
      dataDirectoryCause: "INVALID_PERMISSIONS",
    }]);
    expect(JSON.stringify(summary)).not.toContain("Users");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });
});

describe("summarizeEmbeddedPostgresRuntimeDependency", () => {
  it("classifies Windows loader failures using only a safe DLL basename", () => {
    const logs = ["The code execution cannot proceed because C:\\private\\runtime\\VCRUNTIME140.dll was not found."];
    expect(classifyEmbeddedPostgresStartIssue(logs)).toBe("POSTGRES_START_RUNTIME_DEPENDENCY_MISSING");
    expect(summarizeEmbeddedPostgresRuntimeDependency(logs)).toEqual({
      kind: "MISSING_DLL",
      libraryBasename: "VCRUNTIME140.dll",
    });
    expect(JSON.stringify(summarizeEmbeddedPostgresRuntimeDependency(logs))).not.toContain("private");
    expect(summarizeEmbeddedPostgresRuntimeDependency(["The procedure entry point was not found. 0xc0000139"]))
      .toEqual({ kind: "MISSING_ENTRY_POINT", libraryBasename: null });
    expect(summarizeEmbeddedPostgresRuntimeDependency(["The application is not designed to run on Windows. 0xc000007b"]))
      .toEqual({ kind: "INVALID_IMAGE", libraryBasename: null });
    expect(summarizeEmbeddedPostgresRuntimeDependency(["generic startup failure"])).toBeNull();
  });
});

describe("formatEmbeddedPostgresError", () => {
  it("adds a shared-memory hint when initdb logs expose the real cause", () => {
    const error = formatEmbeddedPostgresError("Postgres init script exited with code 1.", {
      fallbackMessage: "Failed to initialize embedded PostgreSQL cluster",
      recentLogs: [
        "running bootstrap script ...",
        "FATAL:  could not create shared memory segment: Cannot allocate memory",
        "DETAIL:  Failed system call was shmget(key=123, size=56, 03600).",
      ],
    });

    expect(error.message).toContain("could not allocate shared memory");
    expect(error.message).toContain("kern.sysv.shm");
    expect(error.message).toContain("could not create shared memory segment");
  });

  it("keeps only recent non-empty log lines in the collector", () => {
    const buffer = createEmbeddedPostgresLogBuffer(2);
    buffer.append("line one\n\n");
    buffer.append("line two");
    buffer.append("line three");

    expect(buffer.getRecentLogs()).toEqual(["line two", "line three"]);
  });

  it("clears earlier phase logs before collecting a new startup boundary", () => {
    const buffer = createEmbeddedPostgresLogBuffer();
    buffer.append("LOG: initdb completed");
    buffer.clear();
    buffer.append("ERROR: server startup failed");

    expect(buffer.getRecentLogs()).toEqual(["ERROR: server startup failed"]);
  });

  it("clears successful initdb logs before classifying a server-start failure", async () => {
    const migrationRuntime = await readFile(new URL("./migration-runtime.ts", import.meta.url), "utf8");
    expect(migrationRuntime).toMatch(/logBuffer\.clear\(\);\s*await instance\.start\(\)/);
  });
});
