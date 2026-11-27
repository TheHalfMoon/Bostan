import { promises as fs } from "node:fs";
import { constants as fsConstants, realpathSync } from "node:fs";
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

export function resolveEmbeddedPostgresNativePackageRoot(embeddedPostgresEntry: string, nativePackageName: string, runtimeRoot?: string): string | null {
  try {
    // pnpm deploy can nest embedded-postgres inside an injected workspace
    // package while hoisting its native dependency farther up node_modules.
    // Resolve from the dependency itself, as its binary loader does.
    const entry = createRequire(embeddedPostgresEntry).resolve(`@embedded-postgres/${nativePackageName}`);
    const nativeEntry = realpathSync(entry);
    const packageRoot = path.dirname(path.dirname(nativeEntry));
    if (runtimeRoot && !isInside(realpathSync(runtimeRoot), packageRoot)) return null;
    return packageRoot;
  } catch {
    return null;
  }
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
}

/** Resolve embedded-postgres from an installed Bostan runtime. Bundled code
 * preserves its source import.meta.url for workspace tools, so that URL must
 * not be used to locate dependencies in a packaged desktop application. */
export async function resolvePackagedEmbeddedPostgresEntry(runtimeRoot: string): Promise<string> {
  const root = await fs.realpath(runtimeRoot);
  // The server imports embedded-postgres directly. Resolve from that same
  // package so native aliases are prepared beside the copy that starts PG.
  const serverPackageRoot = await fs.realpath(path.join(root, "node_modules", "@bostan", "server"));
  if (!isInside(root, serverPackageRoot)) {
    throw Object.assign(new Error("Packaged server dependency escapes the installed runtime"), { code: "POSTGRES_RUNTIME_PACKAGE_UNSAFE" });
  }
  const manifestPath = path.join(serverPackageRoot, "package.json");
  const manifestInfo = await fs.lstat(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() || manifestInfo.size > 256_000) {
    throw Object.assign(new Error("Packaged database dependency manifest is unsafe"), { code: "POSTGRES_RUNTIME_PACKAGE_UNSAFE" });
  }
  let metadata: unknown;
  try { metadata = JSON.parse(await fs.readFile(manifestPath, "utf8")); }
  catch { throw Object.assign(new Error("Packaged database dependency manifest is invalid"), { code: "POSTGRES_RUNTIME_PACKAGE_INVALID" }); }
  if (!metadata || typeof metadata !== "object" || !("name" in metadata) || metadata.name !== "@bostan/server") {
    throw Object.assign(new Error("Unexpected packaged server dependency identity"), { code: "POSTGRES_RUNTIME_PACKAGE_INVALID" });
  }
  const entry = createRequire(manifestPath).resolve("embedded-postgres");
  const resolvedEntry = await fs.realpath(entry);
  if (!isInside(root, resolvedEntry)) {
    throw Object.assign(new Error("Packaged PostgreSQL dependency escapes the installed runtime"), { code: "POSTGRES_RUNTIME_PACKAGE_UNSAFE" });
  }
  return resolvedEntry;
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

/** Rehydrate only the exact in-package aliases declared by the native package.
 * pnpm deploy can preserve the versioned dylibs while omitting postinstall
 * links. Resolve every manifest path beneath native/lib and never replace an
 * existing file or link to an external target. */
export async function ensureDarwinSharedLibraryAliases(libDir: string): Promise<string[]> {
  const packageRoot = path.resolve(libDir, "..", "..");
  const manifestPath = path.join(packageRoot, "native", "pg-symlinks.json");
  const fail = (code: string, message: string): Error => Object.assign(new Error(message), { code });
  const manifestInfo = await fs.lstat(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() || manifestInfo.size > 64_000) {
    throw fail("POSTGRES_DARWIN_ALIAS_MANIFEST_UNSAFE", "Embedded PostgreSQL alias manifest is unsafe");
  }
  let aliases: unknown;
  try { aliases = JSON.parse(await fs.readFile(manifestPath, "utf8")); }
  catch { throw fail("POSTGRES_DARWIN_ALIAS_MANIFEST_INVALID", "Embedded PostgreSQL alias manifest is invalid"); }
  if (!Array.isArray(aliases) || aliases.length > 128) {
    throw fail("POSTGRES_DARWIN_ALIAS_MANIFEST_INVALID", "Embedded PostgreSQL alias manifest is invalid");
  }
  const created: string[] = [];
  const seen = new Set<string>();
  for (const value of aliases) {
    if (!value || typeof value !== "object" || !("source" in value) || !("target" in value)) {
      throw fail("POSTGRES_DARWIN_ALIAS_ENTRY_INVALID", "Embedded PostgreSQL alias manifest entry is invalid");
    }
    const { source, target } = value as { source: unknown; target: unknown };
    const safePath = (entry: unknown): entry is string => typeof entry === "string"
      && !entry.includes("\\") && !path.posix.isAbsolute(entry)
      && !entry.split("/").some(segment => !segment || segment === "." || segment === "..");
    if (!safePath(source) || !safePath(target)
        || path.posix.dirname(source) !== "native/lib" || path.posix.dirname(target) !== "native/lib"
        || !path.posix.basename(source).startsWith("lib") || !path.posix.basename(source).endsWith(".dylib")
        || !path.posix.basename(target).startsWith("lib") || !path.posix.basename(target).endsWith(".dylib")
        || source === target || seen.has(target)) {
      throw fail("POSTGRES_DARWIN_ALIAS_PATH_INVALID", "Embedded PostgreSQL alias manifest path is invalid");
    }
    seen.add(target);
    const sourcePath = path.join(packageRoot, source);
    const aliasPath = path.join(packageRoot, target);
    const sourceInfo = await fs.lstat(sourcePath);
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
      throw fail("POSTGRES_DARWIN_ALIAS_SOURCE_UNSAFE", "Embedded PostgreSQL alias source is unsafe");
    }
    const existing = await fs.lstat(aliasPath).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    });
    if (existing) {
      if (!existing.isSymbolicLink() || await fs.realpath(aliasPath) !== await fs.realpath(sourcePath)) {
        throw Object.assign(
          fail("POSTGRES_DARWIN_ALIAS_DESTINATION_OCCUPIED", "Embedded PostgreSQL alias destination is occupied"),
          { library: path.posix.basename(target) },
        );
      }
      continue;
    }
    try { await fs.symlink(path.posix.basename(source), aliasPath); }
    catch { throw fail("POSTGRES_DARWIN_ALIAS_CREATE_FAILED", "Embedded PostgreSQL alias could not be created"); }
    created.push(aliasPath);
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
    // Keep the local Windows server's initial shared-memory reservation small.
    // On constrained Windows runners the default 128 MiB segment can fail even
    // when free physical RAM is high (commit limit differs from available RAM).
    "-c", "shared_buffers=32MB",
    "-c", `extension_control_path=${runtimeRoot};$system`,
    "-c", `dynamic_library_path=${libraryRuntimeDirectory};$libdir`,
  ];
}

export async function prepareEmbeddedPostgresNativeRuntime(dataDirectory?: string, runtimeRoot?: string): Promise<string[]> {
  const nativePackageName = resolveNativePackageName();
  if (!nativePackageName) return [];
  let embeddedPostgresEntry: string;
  if (runtimeRoot) {
    embeddedPostgresEntry = await resolvePackagedEmbeddedPostgresEntry(runtimeRoot);
  } else {
    try { embeddedPostgresEntry = require.resolve("embedded-postgres"); }
    catch { return []; }
  }
  const nativeRoot = resolveEmbeddedPostgresNativePackageRoot(embeddedPostgresEntry, nativePackageName, runtimeRoot);
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
