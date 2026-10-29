import { copyFile, lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSET_FILES = Object.freeze([
  "codex-auth-merge-decision.cjs",
  "codex-auth-merge-extract.sh",
]);

// The adapter's auth merge helpers are data/scripts copied byte-for-byte,
// never interpreted by the builder. Never follow a linked source or target.
export async function copyCodexLocalBuildAssets(packageRoot) {
  const source = join(packageRoot, "src", "server");
  const destination = join(packageRoot, "dist", "server");
  const sourceFiles = [];
  for (const name of ASSET_FILES) {
    const file = join(source, name);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error("Bostan Codex build source must be a regular file");
    }
    sourceFiles.push(file);
  }
  const targetInfo = await lstat(destination);
  if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) {
    throw new Error("Bostan Codex build destination must be an existing directory");
  }
  const targetFiles = [];
  // Preflight all destination paths before writing any file.
  for (const name of ASSET_FILES) {
    const target = join(destination, name);
    const info = await lstat(target).catch(error => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (info && (!info.isFile() || info.isSymbolicLink())) {
      throw new Error("Bostan Codex build target must be a regular file");
    }
    targetFiles.push(target);
  }
  for (let i = 0; i < ASSET_FILES.length; i++) {
    await copyFile(sourceFiles[i], targetFiles[i]);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 2) {
    console.error("Usage: node scripts/copy-build-assets.mjs");
    process.exitCode = 2;
  } else {
    const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    await copyCodexLocalBuildAssets(packageRoot);
  }
}
