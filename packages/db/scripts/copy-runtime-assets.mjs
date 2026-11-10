import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DB_RUNTIME_MODULES = Object.freeze([
  "embedded-postgres-scratch-ownership.mjs",
  "windows-postgres-inspector-binary.mjs",
  "windows-postgres-start-identity.mjs",
]);

/** tsc does not emit source .mjs helpers imported by the database entrypoint. */
export function copyDbRuntimeAssets(packageRoot) {
  const root = fs.realpathSync(packageRoot);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.name !== "@bostan/db" || pkg.private !== true) throw new Error("Unexpected Bostan database package");
  for (const name of ["src", "dist"]) {
    const directory = path.join(root, name);
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe database build directory");
  }
  // Preflight every source and output before copying any bytes. Refuse links
  // and shared hard links rather than modifying anything outside this build.
  for (const name of DB_RUNTIME_MODULES) {
    for (const directory of ["src", "dist"]) {
      const stat = fs.lstatSync(path.join(root, directory, name), { throwIfNoEntry: false });
      if (!stat && directory === "dist") continue;
      if (!stat?.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe database runtime asset");
    }
  }
  for (const name of DB_RUNTIME_MODULES) fs.copyFileSync(path.join(root, "src", name), path.join(root, "dist", name));
  return { files: DB_RUNTIME_MODULES.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error("No runtime asset build arguments supported");
  console.log(JSON.stringify(copyDbRuntimeAssets(path.resolve(import.meta.dirname, ".."))));
}
