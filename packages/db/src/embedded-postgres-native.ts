import { promises as fs } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

function resolveNativePackageName(): string | null {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "darwin-arm64"
      : process.arch === "x64" ? "darwin-x64" : null;
  }
  if (process.platform === "win32") {
    return process.arch === "x64" ? "windows-x64" : null;
  }
  if (process.platform !== "linux") return null;

  switch (process.arch) {
    case "arm64":
      return "linux-arm64";
    case "arm":
      return "linux-arm";
    case "ia32":
      return "linux-ia32";
    case "ppc64":
      return "linux-ppc64";
    case "x64":
      return "linux-x64";
    default:
      return null;
  }
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.stat(value);
    return true;
  } catch {
    return false;
  }
}

export function resolveEmbeddedPostgresNativePackageRoot(embeddedPostgresEntry: string, nativePackageName: string): string | null {
  try {
    // pnpm deploy can nest embedded-postgres inside an injected workspace
    // package while hoisting its native dependency farther up node_modules.
    // Resolve from the dependency itself, as its binary loader does.
    const entry = createRequire(embeddedPostgresEntry).resolve(`@embedded-postgres/${nativePackageName}`);
    return path.dirname(path.dirname(entry));
  } catch {
    return null;
  }
}

function prependPathEnv(name: string, value: string): void {
  const current = process.env[name] ?? "";
  const parts = current.split(path.delimiter).filter(Boolean);
  if (parts.includes(value)) return;
  process.env[name] = [value, ...parts].join(path.delimiter);
}

export async function ensureLinuxSharedLibraryAliases(libDir: string): Promise<string[]> {
  const entries = await fs.readdir(libDir, { withFileTypes: true });
  const created: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(lib.+\.so\.\d+)\.\d+(?:\.\d+)?$/);
    if (!match) continue;

    const aliasName = match[1];
    const aliasPath = path.join(libDir, aliasName);
    try {
      await fs.symlink(entry.name, aliasPath);
      created.push(aliasPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw error;
    }
  }

  return created;
}

/**
 * Prebuilt macOS Postgres ships patch-versioned dylibs such as ICU 77.1,
 * zstd 1.5.7 and zlib 1.3.1, while sibling binaries link the soname-level
 * ICU.77, zstd.1 or zlib.1 path. Only create exact-major symlink aliases
 * within that same dependency-owned lib directory. No cross-major aliases,
 * replacement, external library search or library downloads.
 */
export async function ensureDarwinSharedLibraryAliases(libDir: string): Promise<string[]> {
  const entries = await fs.readdir(libDir, { withFileTypes: true });
  const created: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(lib[^/]+?\.\d+)\.\d+(?:\.\d+)?\.dylib$/);
    if (!match) continue;
    const majorAlias = match[1] + ".dylib";
    // Postgres 18 also references ICU without a soname in a few binaries:
    // libicui18n.dylib, despite shipping only libicui18n.77.1.dylib.
    // Keep that exceptional unversioned alias limited to same-package ICU.
    const unversionedIcuAlias = /^libicu(?:data|uc|i18n)\.\d+$/.test(match[1])
      ? match[1].replace(/\.\d+$/, "") + ".dylib" : null;
    for (const aliasName of [majorAlias, unversionedIcuAlias].filter((name): name is string => !!name)) {
      const aliasPath = path.join(libDir, aliasName);
      try {
        await fs.symlink(entry.name, aliasPath);
        created.push(aliasPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
    }
  }
  return created;
}

async function copyImmutableAsset(source: string, destination: string): Promise<void> {
  const sourceInfo = await fs.lstat(source);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error("Embedded PostgreSQL extension source is not a regular file");
  }
  try {
    const destinationInfo = await fs.lstat(destination);
    if (!destinationInfo.isFile() || destinationInfo.isSymbolicLink()) {
      throw new Error("Embedded PostgreSQL extension runtime contains an unsafe entry");
    }
    const [sourceBytes, destinationBytes] = await Promise.all([
      fs.readFile(source),
      fs.readFile(destination),
    ]);
    if (!sourceBytes.equals(destinationBytes)) {
      throw new Error("Embedded PostgreSQL extension runtime does not match the packaged files");
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await fs.copyFile(source, destination, fsConstants.COPYFILE_EXCL);
}

export async function prepareWindowsPostgresExtensionRuntime(nativeRoot: string, dataDirectory: string): Promise<string[]> {
  const nativeDirectory = path.join(nativeRoot, "native");
  const extensionSource = path.join(nativeDirectory, "share", "extension");
  const librarySource = path.join(nativeDirectory, "lib");
  const packageMetadata = JSON.parse(await fs.readFile(path.join(nativeRoot, "package.json"), "utf8")) as { version?: unknown };
  if (typeof packageMetadata.version !== "string" || !/^[A-Za-z0-9.-]{1,80}$/.test(packageMetadata.version)) {
    throw new Error("Embedded PostgreSQL native package version is invalid");
  }
  const runtimeRoot = path.join(path.dirname(dataDirectory), `bostan-postgres-runtime-${packageMetadata.version}`);
  const extensionRuntimeDirectory = path.join(runtimeRoot, "extension");
  const libraryRuntimeDirectory = path.join(runtimeRoot, "lib");
  await fs.mkdir(dataDirectory, { recursive: true });
  const dataInfo = await fs.lstat(dataDirectory);
  if (!dataInfo.isDirectory() || dataInfo.isSymbolicLink()) {
    throw new Error("Embedded PostgreSQL data directory is unsafe");
  }
  const parentInfo = await fs.lstat(path.dirname(dataDirectory));
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error("Embedded PostgreSQL data parent directory is unsafe");
  }
  await fs.mkdir(runtimeRoot, { recursive: true });
  for (const runtimeDirectory of [runtimeRoot, extensionRuntimeDirectory, libraryRuntimeDirectory]) {
    await fs.mkdir(runtimeDirectory, { recursive: true });
    const runtimeInfo = await fs.lstat(runtimeDirectory);
    if (!runtimeInfo.isDirectory() || runtimeInfo.isSymbolicLink()) {
      throw new Error("Embedded PostgreSQL extension runtime directory is unsafe");
    }
  }

  const extensionEntries = await fs.readdir(extensionSource, { withFileTypes: true });
  const extensionFiles = extensionEntries
    .filter(entry => entry.isFile() && /^(?:fuzzystrmatch|pg_trgm)(?:\.control|--[A-Za-z0-9._-]+\.sql)$/.test(entry.name))
    .map(entry => entry.name);
  for (const extensionName of ["fuzzystrmatch", "pg_trgm"]) {
    if (!extensionFiles.includes(`${extensionName}.control`)) {
      throw new Error("Embedded PostgreSQL extension control file is missing from the packaged runtime");
    }
    if (!extensionFiles.some(name => name.startsWith(`${extensionName}--`))) {
      throw new Error("Embedded PostgreSQL extension SQL files are missing from the packaged runtime");
    }
  }

  for (const name of extensionFiles) {
    await copyImmutableAsset(path.join(extensionSource, name), path.join(extensionRuntimeDirectory, name));
  }
  for (const name of ["fuzzystrmatch.dll", "pg_trgm.dll"]) {
    await copyImmutableAsset(path.join(librarySource, name), path.join(libraryRuntimeDirectory, name));
  }

  // PostgreSQL 18 may fail to open extension SQL files through pnpm's deeply
  // nested runtime path on Windows. A short, app-owned copy keeps SQL/control
  // and DLL lookups below Win32 path limits while retaining the system search.
  // PostgreSQL appends `extension` to every extension_control_path element.
  return [
    "-c", `extension_control_path=${runtimeRoot};$system`,
    "-c", `dynamic_library_path=${libraryRuntimeDirectory};$libdir`,
  ];
}

export async function prepareEmbeddedPostgresNativeRuntime(dataDirectory?: string): Promise<string[]> {
  const nativePackageName = resolveNativePackageName();
  if (!nativePackageName) return [];
  let embeddedPostgresEntry: string;
  try { embeddedPostgresEntry = require.resolve("embedded-postgres"); }
  catch { return []; }
  const nativeRoot = resolveEmbeddedPostgresNativePackageRoot(embeddedPostgresEntry, nativePackageName);
  if (!nativeRoot) return [];

  if (process.platform === "win32") {
    if (!dataDirectory) throw new Error("Embedded PostgreSQL Windows runtime requires an owned data directory");
    return prepareWindowsPostgresExtensionRuntime(nativeRoot, dataDirectory);
  }

  const libDir = path.join(nativeRoot, "native", "lib");
  if (!(await pathExists(libDir))) return [];

  if (process.platform === "darwin") {
    await ensureDarwinSharedLibraryAliases(libDir);
    return [];
  }
  prependPathEnv("LD_LIBRARY_PATH", libDir);
  await ensureLinuxSharedLibraryAliases(libDir);
  return [];
}
