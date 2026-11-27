import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
}

function safeManifestPath(value) {
  return typeof value === "string"
    && !value.includes("\\")
    && !path.posix.isAbsolute(value)
    && !value.split("/").some(segment => !segment || segment === "." || segment === "..");
}

/**
 * Recreate only the Darwin PostgreSQL dylib aliases declared by the native
 * dependency resolved from @bostan/server, which imports and prepares it. pnpm deploy intentionally skips postinstall
 * scripts, so doing this while staging keeps the installed app bundle
 * complete before signing and avoids mutating Resources at application start.
 */
export function prepareDarwinPostgresNativeLinks(runtimeRoot, architecture = process.arch) {
  const nativePackageName = architecture === "arm64" ? "darwin-arm64"
    : architecture === "x64" ? "darwin-x64" : null;
  if (!nativePackageName) throw new Error("Unsupported packaged Darwin PostgreSQL architecture");

  const { root, embeddedEntry } = resolveServerEmbeddedPostgresEntry(runtimeRoot);
  const nativeEntry = createRequire(embeddedEntry).resolve(`@embedded-postgres/${nativePackageName}`);
  const packageRoot = path.dirname(path.dirname(nativeEntry));
  if (!inside(root, packageRoot)) throw new Error("Darwin PostgreSQL package escapes the staged runtime");
  const packageInfo = fs.lstatSync(packageRoot);
  if (!packageInfo.isDirectory() || packageInfo.isSymbolicLink()) throw new Error("Unsafe Darwin PostgreSQL package root");

  const nativeRoot = path.join(packageRoot, "native");
  const libDir = path.join(nativeRoot, "lib");
  for (const directory of [nativeRoot, libDir]) {
    const info = fs.lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || !inside(packageRoot, fs.realpathSync(directory))) {
      throw new Error("Unsafe Darwin PostgreSQL library directory");
    }
  }
  const manifestPath = path.join(nativeRoot, "pg-symlinks.json");
  const manifestInfo = fs.lstatSync(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() || manifestInfo.size > 64_000) {
    throw new Error("Unsafe Darwin PostgreSQL alias manifest");
  }
  const aliases = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(aliases) || aliases.length > 128) throw new Error("Invalid Darwin PostgreSQL alias manifest");

  const seen = new Set();
  const created = [];
  for (const value of aliases) {
    if (!value || typeof value !== "object") throw new Error("Invalid Darwin PostgreSQL alias entry");
    const { source, target } = value;
    if (!safeManifestPath(source) || !safeManifestPath(target)
      || path.posix.dirname(source) !== "native/lib"
      || path.posix.dirname(target) !== "native/lib"
      || !path.posix.basename(source).startsWith("lib")
      || !path.posix.basename(source).endsWith(".dylib")
      || !path.posix.basename(target).startsWith("lib")
      || !path.posix.basename(target).endsWith(".dylib")
      || source === target || seen.has(target)) {
      throw new Error("Invalid Darwin PostgreSQL alias path");
    }
    seen.add(target);

    const sourcePath = path.resolve(packageRoot, source);
    const targetPath = path.resolve(packageRoot, target);
    if (!inside(libDir, sourcePath) || !inside(libDir, targetPath)) {
      throw new Error("Darwin PostgreSQL alias escapes its library directory");
    }
    const sourceInfo = fs.lstatSync(sourcePath);
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error("Unsafe Darwin PostgreSQL alias source");
    const existing = fs.lstatSync(targetPath, { throwIfNoEntry: false });
    if (existing) {
      if (!existing.isSymbolicLink() || fs.realpathSync(targetPath) !== fs.realpathSync(sourcePath)) {
        throw new Error("Darwin PostgreSQL alias destination is occupied");
      }
      continue;
    }
    fs.symlinkSync(path.basename(sourcePath), targetPath, "file");
    created.push(path.basename(targetPath));
  }

  for (const value of aliases) {
    const sourcePath = path.resolve(packageRoot, value.source);
    const targetPath = path.resolve(packageRoot, value.target);
    const aliasInfo = fs.lstatSync(targetPath);
    if (!aliasInfo.isSymbolicLink() || fs.realpathSync(targetPath) !== fs.realpathSync(sourcePath)) {
      throw new Error("Darwin PostgreSQL alias verification failed");
    }
  }
  return created.sort();
}

/** Resolve the packaged server dependency without evaluating its source export.
 * pnpm deploy may retain a `default` export pointing at src/index.ts, which is
 * intentionally absent from the production stage. The server imports
 * embedded-postgres directly, so staging resolves from the staged server package. */
export function resolveServerEmbeddedPostgresEntry(runtimeRoot) {
  const root = fs.realpathSync(runtimeRoot);
  const serverPackageRoot = fs.realpathSync(path.join(root, "node_modules", "@bostan", "server"));
  if (!inside(root, serverPackageRoot)) throw new Error("Staged server package escapes the packaged runtime");
  const serverPackageInfo = fs.statSync(serverPackageRoot);
  if (!serverPackageInfo.isDirectory()) throw new Error("Staged server package is not a directory");
  const manifestPath = path.join(serverPackageRoot, "package.json");
  const manifestInfo = fs.lstatSync(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink() || manifestInfo.size > 256_000) {
    throw new Error("Staged DB package manifest is unsafe");
  }
  const packageMetadata = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (packageMetadata.name !== "@bostan/server") throw new Error("Unexpected staged server package identity");
  const embeddedEntry = createRequire(manifestPath).resolve("embedded-postgres");
  return { root, embeddedEntry };
}
