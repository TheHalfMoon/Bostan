const DEFAULT_RECENT_LOG_LIMIT = 40;
const RECENT_LOG_SUMMARY_LINES = 8;

export type EmbeddedPostgresStartIssue =
  | "POSTGRES_START_ADDRESS_IN_USE"
  | "POSTGRES_START_DATA_DIRECTORY_DENIED"
  | "POSTGRES_START_LOCALE_INVALID"
  | "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING"
  | "POSTGRES_START_EXTENSION_MISSING"
  | "POSTGRES_START_SHARED_MEMORY_FAILED"
  | "POSTGRES_START_DISK_FULL"
  | "POSTGRES_START_CLUSTER_INCOMPATIBLE"
  | "POSTGRES_START_CONFIGURATION_INVALID"
  | "POSTGRES_START_RECOVERY_FAILED"
  | "POSTGRES_START_LOGS_EMPTY"
  | "POSTGRES_START_LOGS_UNCLASSIFIED";

/** Classify bounded PostgreSQL startup output without returning any log text. */
export function classifyEmbeddedPostgresStartIssue(recentLogs: string[]): EmbeddedPostgresStartIssue {
  const haystack = recentLogs.join("\n").slice(-65536);
  if (!haystack.trim()) return "POSTGRES_START_LOGS_EMPTY";
  if (/address already in use|could not bind.*(?:socket|address)|could not create any tcp\/ip sockets/i.test(haystack)) return "POSTGRES_START_ADDRESS_IN_USE";
  if (/permission denied|access is denied|could not access the data directory|could not open.*(?:directory|postmaster\.pid)/i.test(haystack)) return "POSTGRES_START_DATA_DIRECTORY_DENIED";
  if (/invalid locale|locale.*not supported|could not set locale/i.test(haystack)) return "POSTGRES_START_LOCALE_INVALID";
  if (/pg_trgm|fuzzystrmatch|extension control file|extension script file|could not access file.*extension/i.test(haystack)) return "POSTGRES_START_EXTENSION_MISSING";
  if (/could not load library|entry point.*not found|module could not be found|could not open.*\.(?:dll|so|dylib)/i.test(haystack)) return "POSTGRES_START_RUNTIME_DEPENDENCY_MISSING";
  if (/shared memory|could not create.*memory/i.test(haystack)) return "POSTGRES_START_SHARED_MEMORY_FAILED";
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
