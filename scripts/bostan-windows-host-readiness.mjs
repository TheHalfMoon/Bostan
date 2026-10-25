import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GIB = 1024 ** 3;

// Qualification budgets, NOT Bostan's published minimum system requirements.
// The memory budget is for the previously OOM-killed full server TypeScript
// and native app+browser qualification; it is deliberately conservative.
export const WINDOWS_QUALIFICATION_BUDGET = Object.freeze({
  totalMemoryGiB: 12,
  freeMemoryGiB: 6,
  stagingFreeGiB: 12,
  nodeMinimum: [24, 11, 0],
});

/** Pure check construction; never mutate the inspected system. */
export function evaluateBostanWindowsReadiness(input, budget = WINDOWS_QUALIFICATION_BUDGET) {
  const checks = [];
  function check(id, pass, detail) {
    checks.push({ id, status: pass ? "pass" : "blocked", detail });
  }
  check("windows_os", input?.platform === "win32",
    "Native Windows required for the Windows qualification gate");
  check("supported_cpu", ["x64", "arm64"].includes(input?.arch),
    "Windows x64 or arm64 architecture required");
  const parts = typeof input?.nodeVersion === "string"
    && /^\d+\.\d+\.\d+$/.test(input.nodeVersion)
    ? input.nodeVersion.split(".").map(Number)
    : null;
  const min = budget.nodeMinimum;
  const nodeOkay = parts && parts.every(Number.isSafeInteger) &&
    (parts[0] > min[0] || parts[0] === min[0] && (
      parts[1] > min[1] || parts[1] === min[1] && parts[2] >= min[2]));
  check("node_runtime", Boolean(nodeOkay),
    "Node.js 24.11.0 or later required by Bostan CLI");
  function resources(value, threshold) {
    return typeof value === "number" && Number.isFinite(value)
      && Number.isSafeInteger(value) && value >= threshold * GIB;
  }
  check("qualification_total_ram", resources(input?.totalMemoryBytes, budget.totalMemoryGiB),
    "Qualification host needs at least " + budget.totalMemoryGiB + " GiB total RAM");
  check("qualification_free_ram", resources(input?.freeMemoryBytes, budget.freeMemoryGiB),
    "Keep at least " + budget.freeMemoryGiB + " GiB free RAM before full compiler/browser tests");
  check("qualification_staging_disk", resources(input?.stagingFreeBytes, budget.stagingFreeGiB),
    "Private source QA staging volume needs at least " + budget.stagingFreeGiB + " GiB free");
  check("qualification_temp_disk", resources(input?.tempFreeBytes, budget.stagingFreeGiB),
    "Windows TEMP volume needs at least " + budget.stagingFreeGiB + " GiB free for QA");
  const blocked = checks.filter(c => c.status === "blocked").map(c => c.id);
  return {
    schema: "bostan.windows-host-readiness.v1",
    kind: "read_only_qualification_host_capacity",
    checks,
    hostCapacityReady: blocked.length === 0,
    blocked,
    // No collection of commands, paths, usernames, installed apps or secrets.
    // A resource check can NEVER qualify an installed app or full release.
    installedAppQualified: false,
    releaseQualified: false,
  };
}

function diskAvailable(target) {
  // statfs queries free space only; it cannot create or change anything.
  const stat = fs.statfsSync(target);
  const free = Number(stat.bavail) * Number(stat.bsize);
  if (!Number.isFinite(free) || free < 0 || !Number.isSafeInteger(free)) {
    throw new Error("Windows disk capacity is unavailable");
  }
  return free;
}

/** Native Windows only; never invent a PASS when a resource cannot be read. */
export function inspectBostanWindowsHost({
  platform = process.platform, arch = process.arch,
  nodeVersion = process.versions.node,
  totalMemoryBytes = os.totalmem(), freeMemoryBytes = os.freemem(),
  stagingPath = os.homedir(), tempPath = os.tmpdir(),
  disk = diskAvailable,
} = {}) {
  let stagingFreeBytes = null;
  let tempFreeBytes = null;
  if (platform === "win32") {
    try {
      if (typeof stagingPath === "string" && path.isAbsolute(stagingPath)) {
        stagingFreeBytes = disk(stagingPath);
      }
    } catch { /* report blocked without exposing a private filesystem path */ }
    try {
      if (typeof tempPath === "string" && path.isAbsolute(tempPath)) {
        tempFreeBytes = disk(tempPath);
      }
    } catch { /* fail closed */ }
  }
  return evaluateBostanWindowsReadiness({
    platform, arch, nodeVersion, totalMemoryBytes, freeMemoryBytes,
    stagingFreeBytes, tempFreeBytes,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.length !== 2) {
    console.error("Usage: node scripts/bostan-windows-host-readiness.mjs");
    process.exitCode = 2;
  } else {
    const report = inspectBostanWindowsHost();
    console.log(JSON.stringify(report, null, 2));
    if (!report.hostCapacityReady) process.exitCode = 1;
  }
}
