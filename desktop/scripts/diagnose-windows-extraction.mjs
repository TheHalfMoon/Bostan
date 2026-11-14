import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { verifyCandidateInstall } from "./artifact-checksums.mjs";
import { benchmarkArchiveExtraction } from "./archive-extraction-benchmark.mjs";

// Only the disposable hosted runner may allocate the full diagnostic payload.
if (process.platform !== "win32" || process.env.CI !== "true"
    || process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
    || process.env.BOSTAN_DESKTOP_EXTRACTION_DIAGNOSTIC !== "1") {
  throw new Error("Extraction diagnosis requires an explicitly selected disposable Windows CI runner");
}
try {
  const desktop = path.resolve(import.meta.dirname, "..");
  const out = path.join(desktop, "dist");
  const installers = fs.readdirSync(out).filter(name => name.endsWith(".exe"));
  assert.equal(installers.length, 1, "Expected exactly one prepared Windows installer");
  await verifyCandidateInstall(out, installers[0]);
  const require = createRequire(path.join(desktop, "package.json"));
  // Use the same pinned, checksum-verified toolset already used by the builder.
  require("electron-builder");
  const { getPath7za } = require("app-builder-lib/out/toolsets/7zip.js");
  const receipt = benchmarkArchiveExtraction(await getPath7za(), path.join(out, installers[0]));
  console.log("BOSTAN_WINDOWS_EXTRACTION_DIAGNOSTIC " + JSON.stringify(receipt));
  // A completed archive extraction is never an installer acceptance result.
  if (!receipt.completed) process.exitCode = 1;
} catch {
  console.log("BOSTAN_WINDOWS_EXTRACTION_DIAGNOSTIC " + JSON.stringify({ diagnosticOnly: true, completed: false, failed: true, unavailable: true }));
  process.exitCode = 1;
}
