import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createPackagingStage } from "./packaging-stage.mjs";

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "bostan-stage-test-"));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test("cleans the owned container when deploy recreates its runtime child", t => {
  const root = fixture(t);
  const stage = createPackagingStage(root);
  assert.equal(fs.existsSync(stage.directory), false);
  fs.mkdirSync(stage.directory);
  fs.writeFileSync(path.join(stage.directory, "first"), "old deployment");
  fs.rmSync(stage.directory, { recursive: true });
  fs.mkdirSync(stage.directory);
  fs.writeFileSync(path.join(stage.directory, "second"), "new deployment");
  fs.writeFileSync(path.join(root, "keep"), "parent data");
  stage.dispose();
  assert.equal(fs.existsSync(path.dirname(stage.directory)), false);
  assert.equal(fs.readFileSync(path.join(root, "keep"), "utf8"), "parent data");
});

test("canonicalizes a temporary-parent alias before allocating and cleaning", t => {
  const root = fixture(t);
  const actual = path.join(root, "actual"); fs.mkdirSync(actual);
  const alias = path.join(root, "alias");
  fs.symlinkSync(actual, alias, process.platform === "win32" ? "junction" : "dir");
  const stage = createPackagingStage(alias);
  assert.equal(path.dirname(path.dirname(stage.directory)), fs.realpathSync(actual));
  stage.dispose();
  assert.equal(fs.existsSync(actual), true);
});

test("retains a substituted container and does not delete a linked target", t => {
  const root = fixture(t);
  const stage = createPackagingStage(root);
  const container = path.dirname(stage.directory);
  const saved = container + ".original";
  assert.equal(path.dirname(saved), root);
  fs.renameSync(container, saved);
  const target = path.join(root, "foreign"); fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "keep"), "foreign data");
  fs.symlinkSync(target, container, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => stage.dispose(), /identity changed/);
  assert.equal(fs.readFileSync(path.join(target, "keep"), "utf8"), "foreign data");
  assert.equal(fs.existsSync(saved), true);
});

test("refuses a different real directory at the allocated container path", t => {
  const root = fixture(t);
  const stage = createPackagingStage(root);
  const container = path.dirname(stage.directory);
  const saved = container + ".original";
  assert.equal(path.dirname(saved), root);
  fs.renameSync(container, saved);
  fs.mkdirSync(container);
  fs.writeFileSync(path.join(container, "keep"), "replacement");
  assert.throws(() => stage.dispose(), /identity changed/);
  assert.equal(fs.readFileSync(path.join(container, "keep"), "utf8"), "replacement");
});
