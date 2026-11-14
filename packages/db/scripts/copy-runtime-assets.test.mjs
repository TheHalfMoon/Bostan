import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { DB_RUNTIME_MODULES, copyDbRuntimeAssets } from "./copy-runtime-assets.mjs";

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-db-runtime-assets-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@bostan/db", private: true, type: "module" }));
    fs.mkdirSync(path.join(root, "src")); fs.mkdirSync(path.join(root, "dist"));
    for (const name of DB_RUNTIME_MODULES) fs.copyFileSync(path.resolve(import.meta.dirname, "../src", name), path.join(root, "src", name));
    return run(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("plain Node imports the shipped database helpers after the source tree is removed", () => {
  fixture(root => {
    const entry = path.join(root, "dist/index.js");
    fs.writeFileSync(entry, DB_RUNTIME_MODULES.map(name => `import './${name}';`).join("\n"));
    const before = spawnSync(process.execPath, [entry], { encoding: "utf8" });
    assert.notEqual(before.status, 0);
    assert.match(before.stderr, /ERR_MODULE_NOT_FOUND/);
    assert.deepEqual(copyDbRuntimeAssets(root), { files: 3 });
    for (const name of DB_RUNTIME_MODULES) assert.deepEqual(fs.readFileSync(path.join(root, "dist", name)), fs.readFileSync(path.join(root, "src", name)));
    fs.rmSync(path.join(root, "src"), { recursive: true });
    const after = spawnSync(process.execPath, [entry], { encoding: "utf8" });
    assert.equal(after.status, 0, after.stderr);
  });
});

test("unsafe linked build directory is refused without changing external data", () => {
  fixture(root => {
    const external = path.join(root, "external"); fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, "sentinel"), "preserved");
    fs.rmdirSync(path.join(root, "dist"));
    fs.symlinkSync(external, path.join(root, "dist"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => copyDbRuntimeAssets(root), /Unsafe/);
    assert.equal(fs.readFileSync(path.join(external, "sentinel"), "utf8"), "preserved");
  });
});

test("hard-linked destination is rejected before any runtime asset is overwritten", () => {
  fixture(root => {
    const sentinel = path.join(root, "sentinel"); fs.writeFileSync(sentinel, "preserved");
    fs.linkSync(sentinel, path.join(root, "dist", DB_RUNTIME_MODULES.at(-1)));
    assert.throws(() => copyDbRuntimeAssets(root), /Unsafe/);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
    assert.equal(fs.existsSync(path.join(root, "dist", DB_RUNTIME_MODULES[0])), false);
  });
});
