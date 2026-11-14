import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { benchmarkArchiveExtraction } from "./archive-extraction-benchmark.mjs";

test("extraction diagnostic refuses an operator environment before allocating a payload", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./diagnose-windows-extraction.mjs", import.meta.url))], {
    env: { ...process.env, CI: "false", BOSTAN_DESKTOP_EXTRACTION_DIAGNOSTIC: "1" },
    windowsHide: true, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Extraction diagnosis requires an explicitly selected disposable/);
  assert.equal(result.stdout, "");
});

test("failed extraction reports bounded facts and removes only its owned temporary stage", () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-extraction-failure-"));
  try {
    fs.writeFileSync(path.join(root, "retained"), "private sentinel");
    const result = benchmarkArchiveExtraction(path.join(root, "missing-PRIVATE-extractor"), path.join(root, "PRIVATE-installer.exe"), root, 1000);
    assert.equal(result.diagnosticOnly, true);
    assert.equal(result.completed, false);
    assert.equal(result.failed, true);
    assert.equal(result.timedOut, false);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
    assert.deepEqual(fs.readdirSync(root), ["retained"]);
    assert.equal(fs.readFileSync(path.join(root, "retained"), "utf8"), "private sentinel");
    assert.throws(() => benchmarkArchiveExtraction(null, null, root, 300001), /Invalid extraction diagnostic deadline/);
    assert.deepEqual(fs.readdirSync(root), ["retained"]);
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});
