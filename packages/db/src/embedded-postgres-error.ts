const DEFAULT_RECENT_LOG_LIMIT = 40;
const RECENT_LOG_SUMMARY_LINES = 8;

export type EmbeddedPostgresStartIssue =
  | "POSTGRES_START_ADDRESS_IN_USE"
  | "POSTGRES_START_DATA_DIRECTORY_DENIED"
  | "POSTGRES_START_LOCALE_INVALID"
  | "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING"
  | "POSTGRES_START_EXTENSION_MISSING"
  | "POSTGRES_START_SHARED_MEMORY_FAILED"
  | "POSTGRES_START_SHARED_MEMORY_RESOURCE_LIMIT"
  | `POSTGRES_START_SHARED_MEMORY_OS_ERROR_${number}`
  | "POSTGRES_START_DISK_FULL"
  | "POSTGRES_START_CLUSTER_INCOMPATIBLE"
  | "POSTGRES_START_CONFIGURATION_INVALID"
  | "POSTGRES_START_RECOVERY_FAILED"
  | "POSTGRES_START_LOGS_EMPTY"
  | "POSTGRES_START_LOGS_UNCLASSIFIED";

export interface EmbeddedPostgresStartDiagnostic {
  sharedMemoryFailureKind: "PRE_EXISTING_BLOCK_IN_USE" | "CREATE_FAILED" | "MAP_FAILED" | "RESOURCE_LIMIT" | "SHARED_MEMORY_UNKNOWN" | null;
  sharedMemoryEvidence: Array<"FATAL" | "DETAIL" | "HINT" | "EXISTING_OBJECT" | "CREATE" | "ALLOCATE" | "RESERVE" | "MAP" | "OS_ERROR" | "ACCESS_DENIED" | "RESOURCE_LIMIT">;
  sharedMemorySystemCall: "CreateFileMapping" | "MapViewOfFile" | "VirtualAlloc" | "shmget" | "mmap" | null;
  sharedMemoryOsErrorCode: number | null;
  sharedMemoryLogLines: Array<{
    severity: "FATAL" | "PANIC" | "ERROR" | "WARNING" | "LOG" | "DETAIL" | "HINT" | "OTHER";
    kind: "CREATE_SEGMENT" | "OPEN_SEGMENT" | "MAP_SEGMENT" | "SYSTEM_CALL" | "ALLOCATION" | "RESERVATION" | "DYNAMIC_SHARED_MEMORY" | "MENTION_ONLY";
  }>;
}

/** Return only fixed, allowlisted facts from bounded PostgreSQL log lines. */
function summarizeSharedMemoryLogLines(recentLogs: string[]): EmbeddedPostgresStartDiagnostic["sharedMemoryLogLines"] {
  const summaries: EmbeddedPostgresStartDiagnostic["sharedMemoryLogLines"] = [];
  const severityNames = new Set(["FATAL", "PANIC", "ERROR", "WARNING", "LOG", "DETAIL", "HINT"]);
  for (const line of recentLogs.slice(-DEFAULT_RECENT_LOG_LIMIT)) {
    if (!/shared memory|failed system call was/i.test(line)) continue;
    const severityMatch = /^\s*([A-Z]+):/i.exec(line);
    const severityCandidate = severityMatch?.[1]?.toUpperCase() ?? "OTHER";
    const severity = (severityNames.has(severityCandidate) ? severityCandidate : "OTHER") as EmbeddedPostgresStartDiagnostic["sharedMemoryLogLines"][number]["severity"];
    const kind: EmbeddedPostgresStartDiagnostic["sharedMemoryLogLines"][number]["kind"] = /failed system call was/i.test(line)
      ? "SYSTEM_CALL"
      : /could not create.{0,64}shared memory/i.test(line)
        ? "CREATE_SEGMENT"
        : /could not open.{0,64}shared memory/i.test(line)
          ? "OPEN_SEGMENT"
          : /could not map.{0,64}shared memory/i.test(line)
            ? "MAP_SEGMENT"
            : /allocat.{0,64}shared memory|shared memory.{0,64}allocat/i.test(line)
              ? "ALLOCATION"
              : /reserv.{0,64}shared memory|shared memory.{0,64}reserv/i.test(line)
                ? "RESERVATION"
                : /dynamic shared memory/i.test(line)
                  ? "DYNAMIC_SHARED_MEMORY"
                  : "MENTION_ONLY";
    summaries.push({ severity, kind });
    if (summaries.length > 8) summaries.shift();
  }
  return summaries;
}

/** Extract only allowlisted shared-memory facts; never return PostgreSQL log text. */
export function summarizeEmbeddedPostgresStartDiagnostic(recentLogs: string[]): EmbeddedPostgresStartDiagnostic {
  const haystack = recentLogs.join("\n").slice(-65536);
  if (!/shared memory|could not create.*memory/i.test(haystack)) {
    return { sharedMemoryFailureKind: null, sharedMemoryEvidence: [], sharedMemorySystemCall: null, sharedMemoryOsErrorCode: null, sharedMemoryLogLines: [] };
  }

  const errorMatch = haystack.match(/shared memory[\s\S]{0,256}?error code\s+(\d{1,5})\b/i);
  const systemCallMatch = haystack.match(/failed system call was\s+(CreateFileMapping|MapViewOfFile|VirtualAlloc|shmget|mmap)\b/i);
  const parsedErrorCode = errorMatch ? Number(errorMatch[1]) : null;
  const sharedMemoryFailureKind = /pre-existing shared memory block is still in use/i.test(haystack)
    ? "PRE_EXISTING_BLOCK_IN_USE"
    : /could not (?:create|open) shared memory segment/i.test(haystack)
      ? "CREATE_FAILED"
      : /could not map shared memory segment/i.test(haystack)
        ? "MAP_FAILED"
        : /not enough (?:system )?(?:memory|resources)|paging file|commit(?:ment)? limit|out of memory|cannot allocate memory|could not allocate.{0,64}shared memory/i.test(haystack)
          ? "RESOURCE_LIMIT"
          : "SHARED_MEMORY_UNKNOWN";
  const sharedMemoryEvidence: EmbeddedPostgresStartDiagnostic["sharedMemoryEvidence"] = [];
  if (/\bFATAL:/i.test(haystack)) sharedMemoryEvidence.push("FATAL");
  if (/\bDETAIL:/i.test(haystack)) sharedMemoryEvidence.push("DETAIL");
  if (/\bHINT:/i.test(haystack)) sharedMemoryEvidence.push("HINT");
  if (/pre-existing|already exists|still in use/i.test(haystack)) sharedMemoryEvidence.push("EXISTING_OBJECT");
  if (/\bcreate(?:d|s|ing)?\b/i.test(haystack)) sharedMemoryEvidence.push("CREATE");
  if (/\ballocat(?:e|ed|es|ing|ion)\b/i.test(haystack)) sharedMemoryEvidence.push("ALLOCATE");
  if (/\breserv(?:e|ed|es|ing|ation)\b/i.test(haystack)) sharedMemoryEvidence.push("RESERVE");
  if (/\bmap(?:ped|ping)?\b/i.test(haystack)) sharedMemoryEvidence.push("MAP");
  if (/error code\s+\d|windows error\s+\d/i.test(haystack)) sharedMemoryEvidence.push("OS_ERROR");
  if (/permission denied|access is denied/i.test(haystack)) sharedMemoryEvidence.push("ACCESS_DENIED");
  if (/not enough (?:system )?(?:memory|resources)|paging file|commit(?:ment)? limit|out of memory|cannot allocate memory|could not allocate.{0,64}shared memory/i.test(haystack)) {
    sharedMemoryEvidence.push("RESOURCE_LIMIT");
  }
  return {
    sharedMemoryFailureKind,
    sharedMemoryEvidence,
    sharedMemorySystemCall: (systemCallMatch?.[1] as EmbeddedPostgresStartDiagnostic["sharedMemorySystemCall"]) ?? null,
    sharedMemoryOsErrorCode: parsedErrorCode !== null && parsedErrorCode > 0 && parsedErrorCode <= 65535
      ? parsedErrorCode
      : null,
    sharedMemoryLogLines: summarizeSharedMemoryLogLines(recentLogs),
  };
}

/** Classify bounded PostgreSQL startup output without returning any log text. */
export function classifyEmbeddedPostgresStartIssue(recentLogs: string[]): EmbeddedPostgresStartIssue {
  const haystack = recentLogs.join("\n").slice(-65536);
  if (!haystack.trim()) return "POSTGRES_START_LOGS_EMPTY";
  if (/address already in use|could not bind.*(?:socket|address)|could not create any tcp\/ip sockets/i.test(haystack)) return "POSTGRES_START_ADDRESS_IN_USE";
  if (/permission denied|access is denied|could not access the data directory|could not open.*(?:directory|postmaster\.pid)/i.test(haystack)) return "POSTGRES_START_DATA_DIRECTORY_DENIED";
  if (/invalid locale|locale.*not supported|could not set locale/i.test(haystack)) return "POSTGRES_START_LOCALE_INVALID";
  if (/pg_trgm|fuzzystrmatch|extension control file|extension script file|could not access file.*extension/i.test(haystack)) return "POSTGRES_START_EXTENSION_MISSING";
  if (/could not load library|entry point.*not found|module could not be found|could not open.*\.(?:dll|so|dylib)/i.test(haystack)) return "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING";
  if (/shared memory|could not create.*memory/i.test(haystack)) {
    const osError = haystack.match(/shared memory[\s\S]{0,256}?error code\s+(\d{1,5})\b/i)?.[1];
    if (osError && Number(osError) > 0 && Number(osError) <= 65535) {
      return `POSTGRES_START_SHARED_MEMORY_OS_ERROR_${Number(osError)}`;
    }
    if (/error code (?:8|1455)\b|paging file|commit(?:ment)? limit|not enough (?:system )?(?:memory|resources)|cannot allocate memory|out of memory/i.test(haystack)) {
      return "POSTGRES_START_SHARED_MEMORY_RESOURCE_LIMIT";
    }
    return "POSTGRES_START_SHARED_MEMORY_FAILED";
  }
  if (/no space left on device|not enough space|disk is full/i.test(haystack)) return "POSTGRES_START_DISK_FULL";
  if (/database files are incompatible with server|database system identifier differs|wrong database system identifier/i.test(haystack)) return "POSTGRES_START_CLUSTER_INCOMPATIBLE";
  if (/invalid value for parameter|unrecognized configuration parameter|could not open configuration file|configuration file contains errors/i.test(haystack)) return "POSTGRES_START_CONFIGURATION_INVALID";
  if (/could not locate a valid checkpoint record|invalid primary checkpoint record|redo is not required/i.test(haystack)) return "POSTGRES_START_RECOVERY_FAILED";
  return "POSTGRES_START_LOGS_UNCLASSIFIED";
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  if (error === undefined) return new Error(fallbackMessage);
  if (typeof error === "string") return new Error(`${fallbackMessage}: ${error}`);

  try {
    return new Error(`${fallbackMessage}: ${JSON.stringify(error)}`);
  } catch {
    return new Error(`${fallbackMessage}: ${String(error)}`);
  }
}

function summarizeRecentLogs(recentLogs: string[]): string | null {
  if (recentLogs.length === 0) return null;
  return recentLogs
    .slice(-RECENT_LOG_SUMMARY_LINES)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" | ");
}

function detectEmbeddedPostgresHint(recentLogs: string[]): string | null {
  const haystack = recentLogs.join("\n").toLowerCase();
  if (!haystack.includes("could not create shared memory segment")) {
    return null;
  }

  return (
    "Embedded PostgreSQL bootstrap could not allocate shared memory. " +
    "On macOS, this usually means the host's kern.sysv.shm* limits are too low for another local PostgreSQL cluster. " +
    "Stop other local PostgreSQL servers or raise the shared-memory sysctls, then retry."
  );
}

export function createEmbeddedPostgresLogBuffer(limit = DEFAULT_RECENT_LOG_LIMIT): {
  append(message: unknown): void;
  getRecentLogs(): string[];
} {
  const recentLogs: string[] = [];

  return {
    append(message: unknown) {
      const text =
        typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : String(message ?? "");

      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        recentLogs.push(line);
        if (recentLogs.length > limit) {
          recentLogs.splice(0, recentLogs.length - limit);
        }
      }
    },
    getRecentLogs() {
      return [...recentLogs];
    },
  };
}

export function formatEmbeddedPostgresError(
  error: unknown,
  input: {
    fallbackMessage: string;
    recentLogs?: string[];
  },
): Error {
  const baseError = toError(error, input.fallbackMessage);
  const recentLogs = input.recentLogs ?? [];
  const parts = [baseError.message];
  const hint = detectEmbeddedPostgresHint(recentLogs);
  const recentSummary = summarizeRecentLogs(recentLogs);

  if (hint) {
    parts.push(hint);
  }
  if (recentSummary) {
    parts.push(`Recent embedded Postgres logs: ${recentSummary}`);
  }

  return new Error(parts.join(" "));
}
