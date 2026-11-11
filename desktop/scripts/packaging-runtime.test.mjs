import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import { captureRuntimePayload, verifyPackagedRuntime } from "./packaging-runtime.mjs";
import { prepareRuntimeLinks, restoreRuntimeLinks } from "../app/runtime-links.mjs";

const { copyDir } = createRequire(import.meta.url)("builder-util/out/fs.js");

function fixture(t, platform = "win32") {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "bostan-payload-test-"));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const stage = path.join(root, "stage");
  fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
  fs.mkdirSync(path.join(stage, "ui-dist"));
  fs.writeFileSync(path.join(stage, "package.json"), '{"name":"@bostan/server","private":true}');
  fs.writeFileSync(path.join(stage, "dist/index.js"), "export const value = 1;\n");
  fs.writeFileSync(path.join(stage, "ui-dist/index.html"), "<title>Bostan</title>");
  const appOutDir = path.join(root, "application");
  const runtime = platform === "darwin"
    ? path.join(appOutDir, "Bostan.app", "Contents", "Resources", "runtime")
    : path.join(appOutDir, "resources", "runtime");
  fs.cpSync(stage, runtime, { recursive: true });
  const context = { electronPlatformName: platform, appOutDir, packager: { appInfo: { productFilename: "Bostan" } } };
  return { root, stage, runtime, context };
}

for (const platform of ["win32", "darwin"]) test(`verifies the real copied ${platform} resource layout`, async t => {
  const { stage, context } = fixture(t, platform);
  await verifyPackagedRuntime(context, await captureRuntimePayload(stage));
});

test("refuses a missing interface in the packaged runtime", async t => {
  const { stage, runtime, context } = fixture(t);
  const expected = await captureRuntimePayload(stage);
  fs.unlinkSync(path.join(runtime, "ui-dist/index.html"));
  await assert.rejects(verifyPackagedRuntime(context, expected), /Incomplete/);
});

test("refuses same-size runtime byte substitution and unexpected payload files", async t => {
  const { stage, runtime, context } = fixture(t);
  const expected = await captureRuntimePayload(stage);
  const entry = path.join(runtime, "dist/index.js");
  fs.writeFileSync(entry, "export const value = 2;\n");
  await assert.rejects(verifyPackagedRuntime(context, expected), /differs/);
  fs.copyFileSync(path.join(stage, "dist/index.js"), entry);
  fs.writeFileSync(path.join(runtime, "unexpected.js"), "unrecorded code");
  await assert.rejects(verifyPackagedRuntime(context, expected), /differs/);
});

test("refuses a runtime link escaping the payload", async t => {
  const { root, stage } = fixture(t);
  const target = path.join(root, "foreign"); fs.mkdirSync(target);
  fs.symlinkSync(target, path.join(stage, "escape"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(captureRuntimePayload(stage), /Non-portable/);
});

test("scoped Windows dependencies survive the builder's real empty-directory-dropping copy", async t => {
  const { root, stage, context } = fixture(t);
  const target = path.join(stage, "node_modules/.store/demo");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "index.js"), "module.exports = 'installed scoped package';");
  fs.mkdirSync(path.join(stage, "node_modules/@bostan"));
  fs.symlinkSync(target, path.join(stage, "node_modules/@bostan/demo"), process.platform === "win32" ? "junction" : "dir");
  const emptyTarget = path.join(stage, "node_modules/.store/empty"); fs.mkdirSync(emptyTarget);
  fs.symlinkSync(emptyTarget, path.join(stage, "node_modules/@bostan/empty"), process.platform === "win32" ? "junction" : "dir");
  prepareRuntimeLinks(stage, "win32");
  const expected = await captureRuntimePayload(stage);
  const appOutDir = path.join(root, "real-builder-copy");
  const runtime = path.join(appOutDir, "resources/runtime");
  await copyDir(stage, runtime);
  assert.equal(path.dirname(stage), root);
  fs.rmSync(stage, { recursive: true });
  const installedContext = { ...context, appOutDir };
  await verifyPackagedRuntime(installedContext, expected);
  restoreRuntimeLinks(runtime);
  assert.equal(createRequire(path.join(runtime, "entry.cjs"))("@bostan/demo"), "installed scoped package");
  assert.equal(fs.statSync(path.join(runtime, "node_modules/@bostan/empty")).isDirectory(), true);
  assert.equal(fs.existsSync(stage), false);
});

test("refuses a lost executable bit", { skip: process.platform === "win32" }, async t => {
  const { stage, runtime, context } = fixture(t);
  fs.chmodSync(path.join(stage, "dist/index.js"), 0o755);
  fs.chmodSync(path.join(runtime, "dist/index.js"), 0o755);
  const expected = await captureRuntimePayload(stage);
  fs.chmodSync(path.join(runtime, "dist/index.js"), 0o644);
  await assert.rejects(verifyPackagedRuntime(context, expected), /differs/);
});
