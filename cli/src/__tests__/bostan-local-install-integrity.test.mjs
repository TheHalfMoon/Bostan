import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { installLocal, statusLocal } from "../bostan-local-install.mjs";

test("manifest integrity rejects shifting bytes between installed files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-native-install-test-"));
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  const oldFlag = process.env.BOSTAN_WINDOWS_TEMP_QA;
  process.env.BOSTAN_WINDOWS_TEMP_QA = "1";
  try {
    const installed = installLocal(home);
    assert.equal(installed.installed, true);
    const manifest = JSON.parse(fs.readFileSync(
      path.join(home, ".bostan", "cli", "install.json"), "utf8"));
    const first = path.join(manifest.directory, "dist", "bostan.js");
    const second = path.join(manifest.directory, "dist", "bostan-local-install.mjs");
    const beforeFirst = fs.readFileSync(first);
    const beforeSecond = fs.readFileSync(second);
    assert.ok(beforeFirst.length > 1);
    const beforeCombined = createHash("sha256")
      .update(Buffer.concat([beforeFirst, beforeSecond])).digest("hex");
    fs.writeFileSync(first, beforeFirst.subarray(0, -1));
    fs.writeFileSync(second, Buffer.concat([
      beforeFirst.subarray(-1), beforeSecond,
    ]));
    const afterCombined = createHash("sha256")
      .update(Buffer.concat([fs.readFileSync(first), fs.readFileSync(second)]))
      .digest("hex");
    assert.equal(afterCombined, beforeCombined,
      "the old concatenated digest cannot distinguish altered file boundaries");
    assert.throws(() => statusLocal(home), /integrity|modified|digest|unverifiable/i);
    assert.equal(fs.existsSync(first), true, "status must not delete the payload");
  } finally {
    if (oldFlag === undefined) delete process.env.BOSTAN_WINDOWS_TEMP_QA;
    else process.env.BOSTAN_WINDOWS_TEMP_QA = oldFlag;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("legacy concatenated schema v1 fails closed without removing installed data", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-native-install-test-"));
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  const oldFlag = process.env.BOSTAN_WINDOWS_TEMP_QA;
  process.env.BOSTAN_WINDOWS_TEMP_QA = "1";
  try {
    assert.equal(installLocal(home).installed, true);
    const manifestPath = path.join(home, ".bostan", "cli", "install.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.schema, 2, "new installs use boundary-bound format");
    const entryBytes = fs.readFileSync(manifest.entry);
    manifest.schema = 1;
    const legacy = JSON.stringify(manifest);
    fs.writeFileSync(manifestPath, legacy);
    assert.throws(() => statusLocal(home), /legacy.*unverifiable/i);
    assert.equal(fs.readFileSync(manifestPath, "utf8"), legacy);
    assert.deepEqual(fs.readFileSync(manifest.entry), entryBytes);
  } finally {
    if (oldFlag === undefined) delete process.env.BOSTAN_WINDOWS_TEMP_QA;
    else process.env.BOSTAN_WINDOWS_TEMP_QA = oldFlag;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
