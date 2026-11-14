import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

function resolveNativePackageName(): string | null {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "darwin-arm64"
      : process.arch === "x64" ? "darwin-x64" : null;
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

export async function prepareEmbeddedPostgresNativeRuntime(): Promise<void> {
  const nativePackageName = resolveNativePackageName();
  if (!nativePackageName) return;
  let embeddedPostgresEntry: string;
  try { embeddedPostgresEntry = require.resolve("embedded-postgres"); }
  catch { return; }
  const nativeRoot = resolveEmbeddedPostgresNativePackageRoot(embeddedPostgresEntry, nativePackageName);
  if (!nativeRoot) return;

  const libDir = path.join(nativeRoot, "native", "lib");
  if (!(await pathExists(libDir))) return;

  if (process.platform === "darwin") {
    await ensureDarwinSharedLibraryAliases(libDir);
    return;
  }
  prependPathEnv("LD_LIBRARY_PATH", libDir);
  await ensureLinuxSharedLibraryAliases(libDir);
}
