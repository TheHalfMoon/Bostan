import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { installerTreeSnapshot } from "./installer-tree-snapshot.mjs";

test("installer failure metadata counts actual files without following directory links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-installer-tree-"));
  try {
    const tree = path.join(root, "tree"), outside = path.join(root, "outside");
    fs.mkdirSync(tree); fs.mkdirSync(outside);
    fs.writeFileSync(path.join(tree, "fixture"), "abc");
    fs.writeFileSync(path.join(outside, "unrelated"), "unrelated");
    fs.symlinkSync(outside, path.join(tree, "linked"), process.platform === "win32" ? "junction" : "dir");
    assert.deepEqual(installerTreeSnapshot(tree), { entries: 2, regularBytes: 3, capped: false, failed: false });
    assert.deepEqual(installerTreeSnapshot(path.join(tree, "linked")), { entries: 0, regularBytes: 0, capped: false, failed: false });
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});

test("installer failure metadata stops at its entry cap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-installer-cap-"));
  try {
    for (let n = 0; n < 4097; n++) fs.writeFileSync(path.join(root, String(n)), "");
    assert.deepEqual(installerTreeSnapshot(root), { entries: 4096, regularBytes: 0, capped: true, failed: false });
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});
