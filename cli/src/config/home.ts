import path from "node:path";
import {
  expandHomePrefix,
  resolveDefaultBackupDir as resolveSharedDefaultBackupDir,
  resolveDefaultEmbeddedPostgresDir as resolveSharedDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir as resolveSharedDefaultLogsDir,
  resolveDefaultSecretsKeyFilePath as resolveSharedDefaultSecretsKeyFilePath,
  resolveDefaultStorageDir as resolveSharedDefaultStorageDir,
  resolveHomeAwarePath,
  resolveBostanConfigPathForInstance,
  resolveBostanHomeDir,
  resolveBostanInstanceId,
  resolveBostanInstanceRoot as resolveSharedBostanInstanceRoot,
} from "@bostan/shared/home-paths";

export {
  expandHomePrefix,
  resolveHomeAwarePath,
  resolveBostanHomeDir,
  resolveBostanInstanceId,
};

export function resolveBostanInstanceRoot(instanceId?: string): string {
  return resolveSharedBostanInstanceRoot({ instanceId });
}

export function resolveDefaultConfigPath(instanceId?: string): string {
  return resolveBostanConfigPathForInstance({ instanceId });
}

export function resolveDefaultContextPath(): string {
  return path.resolve(resolveBostanHomeDir(), "context.json");
}

export function resolveDefaultCliAuthPath(): string {
  return path.resolve(resolveBostanHomeDir(), "auth.json");
}

export function resolveDefaultEmbeddedPostgresDir(instanceId?: string): string {
  return resolveSharedDefaultEmbeddedPostgresDir({ instanceId });
}

export function resolveDefaultLogsDir(instanceId?: string): string {
  return resolveSharedDefaultLogsDir({ instanceId });
}

export function resolveDefaultSecretsKeyFilePath(instanceId?: string): string {
  return resolveSharedDefaultSecretsKeyFilePath({ instanceId });
}

export function resolveDefaultStorageDir(instanceId?: string): string {
  return resolveSharedDefaultStorageDir({ instanceId });
}

export function resolveDefaultBackupDir(instanceId?: string): string {
  return resolveSharedDefaultBackupDir({ instanceId });
}

export function describeLocalInstancePaths(instanceId?: string) {
  const resolvedInstanceId = resolveBostanInstanceId(instanceId);
  const instanceRoot = resolveBostanInstanceRoot(resolvedInstanceId);
  return {
    homeDir: resolveBostanHomeDir(),
    instanceId: resolvedInstanceId,
    instanceRoot,
    configPath: resolveDefaultConfigPath(resolvedInstanceId),
    embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(resolvedInstanceId),
    backupDir: resolveDefaultBackupDir(resolvedInstanceId),
    logDir: resolveDefaultLogsDir(resolvedInstanceId),
    secretsKeyFilePath: resolveDefaultSecretsKeyFilePath(resolvedInstanceId),
    storageDir: resolveDefaultStorageDir(resolvedInstanceId),
  };
}

/** Compatibility exports; keep existing CLI consumers on the same instance. */
export {
  resolveBostanHomeDir as resolvePaperclipHomeDir,
  resolveBostanInstanceId as resolvePaperclipInstanceId,
  resolveBostanInstanceRoot as resolvePaperclipInstanceRoot,
};
