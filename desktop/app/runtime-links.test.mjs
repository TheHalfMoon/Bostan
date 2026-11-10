import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { prepareRuntimeLinks, restoreRuntimeLinks } from "./runtime-links.mjs";

test("Windows dependency payload survives relocation without its build directory", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-desktop-relocation-"));
  try {
    const source = path.join(temp, "before");
    fs.mkdirSync(path.join(source, "node_modules/.store/demo"), { recursive: true });
    fs.writeFileSync(path.join(source, "node_modules/.store/demo/index.js"), "module.exports = 'installed';");
    fs.symlinkSync(path.join(source, "node_modules/.store/demo"), path.join(source, "node_modules/demo"), process.platform === "win32" ? "junction" : "dir");
    assert.deepEqual(prepareRuntimeLinks(source, "win32"), { links: 1 });
    const installed = path.join(temp, "installed elsewhere");
    fs.renameSync(source, installed);
    restoreRuntimeLinks(installed);
    restoreRuntimeLinks(installed);
    assert.equal(createRequire(path.join(installed, "entry.cjs"))("demo"), "installed");
    assert.equal(fs.existsSync(source), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("packaging rejects escaping dependencies without touching the target", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-desktop-escape-"));
  try {
    const root = path.join(temp, "runtime");
    const outside = path.join(temp, "outside");
    fs.mkdirSync(root); fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "sentinel"), "preserved");
    fs.symlinkSync(outside, path.join(root, "dependency"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => prepareRuntimeLinks(root, "win32"), /escapes/);
    assert.equal(fs.readFileSync(path.join(outside, "sentinel"), "utf8"), "preserved");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("installation refuses traversal and occupied destinations without overwriting data", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-desktop-links-"));
  try {
    fs.mkdirSync(path.join(root, "target"));
    fs.writeFileSync(path.join(root, "existing"), "preserved");
    const write = links => fs.writeFileSync(path.join(root, "bostan-runtime-links.json"), JSON.stringify({ schema: "bostan.runtime-links.v1", links }));
    for (const link of [
      { path: "../outside", target: "target", kind: "dir" },
      { path: "link", target: "../outside", kind: "dir" },
      { path: "existing", target: "target", kind: "dir" },
    ]) {
      write([link]); assert.throws(() => restoreRuntimeLinks(root));
      assert.equal(fs.readFileSync(path.join(root, "existing"), "utf8"), "preserved");
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
