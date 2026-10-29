import { copyFile, lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSET = "grok-auth-merge-decision.cjs";

// Copy the exact checked-in helper after tsc; never follow linked source or
// destination paths, and preserve all unrelated generated adapter files.
export async function copyGrokLocalBuildAsset(packageRoot) {
  const source = join(packageRoot, "src", "server", ASSET);
  const destination = join(packageRoot, "dist", "server");
  const target = join(destination, ASSET);
  const inputInfo = await lstat(source);
  const outputInfo = await lstat(destination);
  if (!inputInfo.isFile() || inputInfo.isSymbolicLink() ||
      !outputInfo.isDirectory() || outputInfo.isSymbolicLink()) {
    throw Error("Bostan Grok build requires an owned regular source and output directory");
  }
  const targetInfo = await lstat(target).catch(error => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (targetInfo && (!targetInfo.isFile() || targetInfo.isSymbolicLink())) {
    throw Error("Bostan Grok build cannot overwrite a linked or non-file target");
  }
  await copyFile(source, target);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 2) {
    console.error("Usage: node scripts/copy-build-assets.mjs");
    process.exitCode = 2;
  } else {
    await copyGrokLocalBuildAsset(dirname(dirname(fileURLToPath(import.meta.url))));
  }
}
