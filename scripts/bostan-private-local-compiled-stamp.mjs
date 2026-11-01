/**
 * Test-only compiled Bostan admission: prove the local compiled server
 * build-info commit matches the exact Git checkout used for this QA.
 *
 * Output SHA-256 ownership of dist-runtime does not authenticate the
 * source commit used to compile server/dist/index.js. Refuse stale builds
 * before the HTTP smoke creates any temporary PostgreSQL data.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const HEX_SHA = /^[0-9a-f]{40}$/;
const MAX_BUILD_INFO_BYTES = 256;
const MAX_ENTRY_BYTES = 128 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const ENTRIES = ["index.js", "vendor/paperclip-runner/index.js"];

export function matchesLocalCompiledSourceCommit(rawBuildInfo, rawHead, actualDigests) {
  if (typeof rawBuildInfo !== "string" ||
      Buffer.byteLength(rawBuildInfo, "utf8") > MAX_BUILD_INFO_BYTES ||
      typeof rawHead !== "string" || !HEX_SHA.test(rawHead)) return false;
  let stamp;
  try { stamp = JSON.parse(rawBuildInfo); }
  catch { return false; }
  return Boolean(stamp && typeof stamp === "object" &&
    !Array.isArray(stamp) &&
    Object.keys(stamp).length === 3 &&
    Object.hasOwn(stamp, "commit") &&
    typeof stamp.commit === "string" &&
    HEX_SHA.test(stamp.commit) && stamp.commit === rawHead &&
    actualDigests &&
    SHA256.test(stamp.indexSha256) &&
    SHA256.test(stamp.vendorSha256) &&
    stamp.indexSha256 === actualDigests.indexSha256 &&
    stamp.vendorSha256 === actualDigests.vendorSha256);
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
    // A matching HEAD alone is not source provenance when tracked source
    // files were modified or new untracked files entered the checkout.
    // Build outputs are gitignored; refuse any other dirty QA checkout.
    const changes = execFileSync("git", [
      "-C", repoRoot, "status", "--porcelain=v1", "--untracked-files=normal",
    ], {
      timeout: 3000, maxBuffer: 64 * 1024, encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (changes.length !== 0) return false;
    const actualDigests = {};
    for (const [i, name] of ENTRIES.entries()) {
      const file = join(repoRoot, "server", "dist", ...name.split("/"));
      const entryInfo = lstatSync(file);
      if (!entryInfo.isFile() || entryInfo.isSymbolicLink() ||
          entryInfo.size < 1 || entryInfo.size > MAX_ENTRY_BYTES) return false;
      const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
      actualDigests[i === 0 ? "indexSha256" : "vendorSha256"] = actual;
    }
    return matchesLocalCompiledSourceCommit(stamped, head, actualDigests);
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
