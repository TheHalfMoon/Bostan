import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { protectDataDirectory } from "./data-directory.mjs";

test("protects an actual disposable data directory and allows a repeated launch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-desktop-acl-"));
  try {
    const data = path.join(root, "Bostan data");
    protectDataDirectory(data); protectDataDirectory(data);
    fs.writeFileSync(path.join(data, "state"), "preserved", { mode: 0o600 });
    assert.equal(fs.readFileSync(path.join(data, "state"), "utf8"), "preserved");
    if (process.platform !== "win32") assert.equal(fs.statSync(data).mode & 0o777, 0o700);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("refuses a linked data directory without modifying its target", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-desktop-acl-link-"));
  try {
    const target = path.join(root, "target"); fs.mkdirSync(target);
    const original = fs.statSync(target).mode;
    const link = path.join(root, "link");
    fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => protectDataDirectory(link), /Unsafe/);
    assert.equal(fs.statSync(target).mode, original);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
