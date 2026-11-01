/**
 * Test-only compiled Bostan admission: prove the local compiled server
 * build-info commit matches the exact Git checkout used for this QA.
 *
 * Output SHA-256 ownership of dist-runtime does not authenticate the
 * source commit used to compile server/dist/index.js. Refuse stale builds
 * before the HTTP smoke creates any temporary PostgreSQL data.
 */
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const HEX_SHA = /^[0-9a-f]{40}$/;
const MAX_BUILD_INFO_BYTES = 256;

export function matchesLocalCompiledSourceCommit(rawBuildInfo, rawHead) {
  if (typeof rawBuildInfo !== "string" ||
      Buffer.byteLength(rawBuildInfo, "utf8") > MAX_BUILD_INFO_BYTES ||
      typeof rawHead !== "string" || !HEX_SHA.test(rawHead)) return false;
  let stamp;
  try { stamp = JSON.parse(rawBuildInfo); }
  catch { return false; }
  return Boolean(stamp && typeof stamp === "object" &&
    !Array.isArray(stamp) &&
    Object.keys(stamp).length === 1 &&
    Object.hasOwn(stamp, "commit") &&
    typeof stamp.commit === "string" &&
    HEX_SHA.test(stamp.commit) && stamp.commit === rawHead);
}

export function checkLocalCompiledBuildStamp(repoRoot = root) {
  try {
    const stampPath = join(repoRoot, "server", "dist", "build-info.json");
    const info = lstatSync(stampPath);
    if (!info.isFile() || info.isSymbolicLink() ||
        info.size < 1 || info.size > MAX_BUILD_INFO_BYTES) return false;
    const stamped = readFileSync(stampPath, "utf8");
    // This tool is only for a private source checkout; do not rely on
    // environment-supplied PAPERCLIP_BUILD_COMMIT or a detached tag.
    const head = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      timeout: 3000, maxBuffer: 256, encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return matchesLocalCompiledSourceCommit(stamped, head);
  } catch {
    return false;
  }
}

if (process.argv[1] &&
    fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== "--check" ||
      !checkLocalCompiledBuildStamp()) {
    console.error("BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_REFUSED");
    process.exitCode = 2;
  } else {
    console.log("BOSTAN_LOCAL_COMPILED_SOURCE_COMMIT_VERIFIED");
  }
}
