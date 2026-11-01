// Write the build stamp for the server.
//
// The server `build` script runs this after `tsc`. It writes the commit SHA
// into `dist/build-info.json`. The instrumentation module reads that stamp to
// report `service.version`, so the value tracks the true built commit.
//
// The build resolves the commit in two steps:
//   1. `git rev-parse HEAD` in the server directory.
//   2. The `PAPERCLIP_BUILD_COMMIT` environment variable.
// A Docker image build excludes `.git`, so the git lookup fails there. The
// image build passes the commit in `PAPERCLIP_BUILD_COMMIT` instead, so the
// stamp still records the true built commit.
//
// The build must not fail when no commit is available. A missing `git`, a
// checkout with no `.git`, and an unset `PAPERCLIP_BUILD_COMMIT` together write
// no stamp and exit 0.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, ftruncateSync, lstatSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverDir = join(scriptDir, "..");
const distDir = join(serverDir, "dist");
const outFile = join(distDir, "build-info.json");
const MAX_COMPILED_ENTRY_BYTES = 128 * 1024 * 1024;
const COMPILED_FILES = ["index.js", "vendor/paperclip-runner/index.js"];

/**
 * A source commit string alone does not protect compiled bytes against
 * changes after build. Hash both actual executable entry files. A missing,
 * linked, empty or unexpectedly large file fails the build rather than
 * issuing a misleading provenance receipt.
 */
export function digestCompiledBuildEntries(directory = distDir) {
  // A linked dist/vendor directory can redirect otherwise regular compiled
  // entries outside the owned server build tree. Refuse before reading bytes.
  for (const directory of [distDir, join(distDir, "vendor"),
    join(distDir, "vendor", "paperclip-runner")]) {
    const info = lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Bostan compiled build directory not safely qualified");
  }
  const values = [];
  for (const relativePath of COMPILED_FILES) {
    const file = join(directory, ...relativePath.split('/'));
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() ||
        info.size < 1 || info.size > MAX_COMPILED_ENTRY_BYTES)
      throw new Error('Bostan compiled build entry not safely qualified');
    values.push(createHash('sha256').update(readFileSync(file)).digest('hex'));
  }
  return Object.freeze({indexSha256: values[0], vendorSha256: values[1]});
}

/**
 * Resolve the commit for the build stamp. Prefer the git commit. Fall back to
 * the supplied commit — the value a Docker image build passes in
 * `PAPERCLIP_BUILD_COMMIT` when `.git` is absent. Return null when neither
 * source gives a non-empty value.
 *
 * @param {unknown} gitCommit The `git rev-parse` result, or null on failure.
 * @param {unknown} suppliedCommit The `PAPERCLIP_BUILD_COMMIT` value.
 * @returns {string | null}
 */
export function resolveBuildCommit(gitCommit, suppliedCommit) {
  const git = typeof gitCommit === "string" ? gitCommit.trim() : "";
  if (git) return git;
  const supplied = typeof suppliedCommit === "string" ? suppliedCommit.trim() : "";
  if (supplied) return supplied;
  return null;
}

/**
 * Read the full commit SHA with `git rev-parse HEAD` in the server
 * directory. Return the SHA, or null on any failure.
 *
 * @returns {string | null}
 */
function readGitCommit() {
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the commit and write the build stamp. Write no stamp and return when
 * no commit is available, so the build continues.
 */
function main() {
  const commit = resolveBuildCommit(readGitCommit(), process.env.PAPERCLIP_BUILD_COMMIT);

  if (!commit) {
    console.log("[build-stamp] no commit available; wrote no build stamp");
    return;
  }

  const digests = digestCompiledBuildEntries(distDir);
  // Do not follow a pre-existing linked build-info.json and overwrite a
  // foreign file. Open without truncation, verify the owned regular inode,
  // then truncate only that opened descriptor.
  try {
    const existing = lstatSync(outFile);
    if (!existing.isFile() || existing.isSymbolicLink() || existing.nlink !== 1)
      throw new Error("Bostan build stamp path not safely qualified");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const fd = openSync(outFile,
    constants.O_WRONLY | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    const info = fstatSync(fd);
    const pathInfo = lstatSync(outFile);
    if (!info.isFile() || info.nlink !== 1 ||
        !pathInfo.isFile() || pathInfo.isSymbolicLink() ||
        pathInfo.nlink !== 1 || info.dev !== pathInfo.dev ||
        info.ino !== pathInfo.ino)
      throw new Error("Bostan build stamp descriptor not safely qualified");
    ftruncateSync(fd, 0);
    writeFileSync(fd, `${JSON.stringify({ commit, ...digests }, null, 2)}\\n`);
  } finally {
    closeSync(fd);
  }
  console.log(`[build-stamp] wrote ${outFile} commit=${commit}`);
}

// Run only when node invokes this file directly (the `build` script). A test
// that imports `resolveBuildCommit` does not run `main`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
