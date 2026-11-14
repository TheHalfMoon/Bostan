import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { formatDatabaseBackupResult, runDatabaseBackup } from "./backup-lib.js";
import {
  expandHomePrefix,
  resolveDefaultBackupDir,
  resolveBostanConfigPathForInstance,
} from "@bostan/shared/home-paths";

type PartialConfig = {
  database?: {
    mode?: "embedded-postgres" | "postgres";
    connectionString?: string;
    embeddedPostgresPort?: number;
    backup?: {
      dir?: string;
      retentionDays?: number;
    };
  };
};

function readConfig(configPath: string): PartialConfig | null {
  if (!existsSync(configPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid backup configuration root");
    }
    if ("database" in parsed) {
      const database = parsed.database;
      if (!database || typeof database !== "object" || Array.isArray(database)) {
        throw new Error("Invalid database configuration");
      }
      if ("mode" in database && database.mode !== "postgres" && database.mode !== "embedded-postgres") {
        throw new Error("Invalid database mode");
      }
      if (database.mode === "postgres" && "connectionString" in database && typeof database.connectionString !== "string") {
        throw new Error("Invalid external database connection string");
      }
      if ("embeddedPostgresPort" in database && (typeof database.embeddedPostgresPort !== "number" || !Number.isInteger(database.embeddedPostgresPort) || database.embeddedPostgresPort < 1 || database.embeddedPostgresPort > 65535)) {
        throw new Error("Invalid embedded PostgreSQL port");
      }
      if ("backup" in database) {
        const backup = database.backup;
        if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
          throw new Error("Invalid backup settings");
        }
        if ("dir" in backup && (typeof backup.dir !== "string" || !backup.dir.trim())) {
          throw new Error("Invalid backup directory");
        }
        if ("retentionDays" in backup && (typeof backup.retentionDays !== "number" || !Number.isInteger(backup.retentionDays) || backup.retentionDays < 1)) {
          throw new Error("Invalid backup retention");
        }
      }
    }
    return parsed as PartialConfig;
  } catch {
    throw new Error("Cannot read Bostan database backup configuration; refusing an ambiguous backup target.");
  }
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : null;
}

function resolveEmbeddedPort(config: PartialConfig | null): number {
  return asPositiveInt(config?.database?.embeddedPostgresPort) ?? 54329;
}

function resolveConnectionString(config: PartialConfig | null): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;

  if (config?.database?.mode === "postgres" && typeof config.database.connectionString === "string") {
    const trimmed = config.database.connectionString.trim();
    if (trimmed) return trimmed;
  }

  if (config?.database?.mode === "postgres") {
    throw new Error("Postgres backup requires a configured database connection string or DATABASE_URL.");
  }

  const port = resolveEmbeddedPort(config);
  return `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
}

function resolveBackupDir(config: PartialConfig | null): string {
  const raw = config?.database?.backup?.dir;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return path.resolve(expandHomePrefix(raw.trim()));
  }
  return resolveDefaultBackupDir();
}

function resolveRetentionDays(config: PartialConfig | null): number {
  return asPositiveInt(config?.database?.backup?.retentionDays) ?? 7;
}

async function main() {
  try {
    const configPath = resolveBostanConfigPathForInstance();
    const config = readConfig(configPath);
    const connectionString = resolveConnectionString(config);
    const backupDir = resolveBackupDir(config);
    const retentionDays = resolveRetentionDays(config);

    console.log(`Config path: ${configPath}`);
    console.log(`Backing up database to: ${backupDir}`);
    console.log(`Retention window: ${retentionDays} day(s)`);

    const result = await runDatabaseBackup({
      connectionString,
      backupDir,
      retention: { dailyDays: retentionDays, weeklyWeeks: 4, monthlyMonths: 1 },
      filenamePrefix: "bostan",
    });

    console.log(`Backup saved: ${formatDatabaseBackupResult(result)}`);
  } catch (err) {
    console.error("Backup failed.");
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

await main();
