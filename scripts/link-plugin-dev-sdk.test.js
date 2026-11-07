import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

import { linkSdkInto, readPluginsUnder, SDK_SCOPE } from "./link-plugin-dev-sdk.mjs";

const sdkDir = resolve(import.meta.dirname, "..", "packages", "plugins", "sdk");

// Unprivileged Windows cannot create "dir" symlinks; mirror the script's junction.
function linkDir(target, path) {
  if (process.platform === "win32") symlinkSync(resolve(target), path, "junction");
  else symlinkSync(target, path, "dir");
}

let workDir;

before(() => {
  workDir = mkdtempSync(join(tmpdir(), "link-plugin-dev-sdk-"));
});

after(() => {
  rmSync(workDir, { force: true, recursive: true });
});

function makePackage(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), "{}\n");
  return dir;
}

test("readPluginsUnder returns [] for a missing directory", () => {
  assert.deepEqual(readPluginsUnder(join(workDir, "does-not-exist")), []);
});

test("readPluginsUnder finds first-level package directories", () => {
  const parent = join(workDir, "first-level");
  const a = makePackage(join(parent, "a"));
  const b = makePackage(join(parent, "b"));

  assert.deepEqual(readPluginsUnder(parent).sort(), [a, b].sort());
});

test("readPluginsUnder recurses into directories that are not themselves packages", () => {
  // Mirrors the recursive pnpm-workspace exclusion glob: a provider nested
  // deeper than one level must still be discovered.
  const parent = join(workDir, "nested");
  const nested = makePackage(join(parent, "vendor", "my-plugin"));

  assert.deepEqual(readPluginsUnder(parent), [nested]);
});

test("readPluginsUnder stops descending once a package.json is found and skips node_modules", () => {
  const parent = join(workDir, "boundaries");
  const pkg = makePackage(join(parent, "plugin"));
  // A nested package inside an already-matched package must not be returned.
  makePackage(join(pkg, "sub-package"));
  // node_modules must be ignored entirely.
  makePackage(join(parent, "node_modules", "some-dep"));

  assert.deepEqual(readPluginsUnder(parent), [pkg]);
});

test("linkSdkInto creates the plugin-sdk symlink and is idempotent", () => {
  const pkg = makePackage(join(workDir, "link-target"));

  assert.equal(linkSdkInto(pkg), true);

  const link = join(pkg, "node_modules", "@bostan", "plugin-sdk");
  assert.ok(lstatSync(link).isSymbolicLink());
  assert.ok(existsSync(join(link, "package.json")), "link must resolve to the in-repo SDK");

  // Second call is a no-op because the link already points at the in-repo SDK.
  assert.equal(linkSdkInto(pkg), false);
});

test("linkSdkInto leaves a real (non-symlink) install in place", () => {
  const pkg = makePackage(join(workDir, "real-install"));
  const scopeDir = join(pkg, "node_modules", "@bostan");
  mkdirSync(scopeDir, { recursive: true });
  // Simulate a published-tarball install: a real directory, not a symlink.
  makePackage(join(scopeDir, "plugin-sdk"));

  assert.equal(linkSdkInto(pkg), false);
  assert.ok(!lstatSync(join(scopeDir, "plugin-sdk")).isSymbolicLink());
});

test("linkSdkInto replaces a symlink that points somewhere else", () => {
  const pkg = makePackage(join(workDir, "stale-link"));
  const scopeDir = join(pkg, "node_modules", "@bostan");
  mkdirSync(scopeDir, { recursive: true });
  linkDir(join(scopeDir, "..", "somewhere-else"), join(scopeDir, "plugin-sdk"));

  assert.equal(linkSdkInto(pkg), true);
  assert.equal(resolve(scopeDir, readlinkSync(join(scopeDir, "plugin-sdk"))).replace(/[\/]+$/, ""), sdkDir);
  assert.ok(existsSync(scopeDir));
});

test("plugins resolve the SDK under the @bostan scope they import", () => {
  assert.equal(SDK_SCOPE, "@bostan");
});

test("linkSdkInto uses an absolute junction on Windows and stays idempotent", () => {
  const pkg = makePackage(join(workDir, "win32-junction"));
  const link = join(pkg, "node_modules", "@bostan", "plugin-sdk");

  assert.equal(linkSdkInto(pkg, "win32"), true);
  assert.ok(lstatSync(link).isSymbolicLink());
  assert.equal(resolve(readlinkSync(link)).replace(/[\/]+$/, ""), sdkDir);
  assert.ok(existsSync(join(link, "package.json")));
  assert.equal(linkSdkInto(pkg, "win32"), false);
});

test("the postinstall CLI entry runs to completion", () => {
  // The root postinstall executes the module directly; module-level ordering
  // bugs only surface on this path, not when the functions are imported.
  const out = execFileSync(process.execPath, [join(import.meta.dirname, "link-plugin-dev-sdk.mjs")], { encoding: "utf8" });
  assert.match(out, /Linked @bostan\/plugin-sdk/);
});
