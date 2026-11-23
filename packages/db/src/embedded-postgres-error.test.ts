import { describe, expect, it } from "vitest";
import { classifyEmbeddedPostgresStartIssue, createEmbeddedPostgresLogBuffer, formatEmbeddedPostgresError, summarizeEmbeddedPostgresStartDiagnostic } from "./embedded-postgres-error.js";

describe("classifyEmbeddedPostgresStartIssue", () => {
  it("returns only fixed startup issues and distinguishes absent from unknown logs", () => {
    const cases = [
      [[], "POSTGRES_START_LOGS_EMPTY"],
      [["FATAL: could not bind IPv4 address: Address already in use"], "POSTGRES_START_ADDRESS_IN_USE"],
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
    });
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
});
