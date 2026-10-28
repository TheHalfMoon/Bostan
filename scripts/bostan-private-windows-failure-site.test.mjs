import assert from "node:assert/strict";
import test from "node:test";
import { safeWindowsStartupSite, safeWindowsStartupCode, safeWindowsMissingPackage, safeWindowsMissingLocalModule } from "./bostan-private-windows-failure-site.mjs";

const root = "D:\\Bostan-B111-qa";
test("extracts only a source-relative Windows frame and positive line", () => {
  const stack = "Error: postgres://bostan:SYNTHETIC_SECRET@127.0.0.1/db\n" +
    "    at start (file:///D:/Bostan-B111-qa/server/src/config.ts:265:13)\n" +
    "    at async root (file:///D:/Bostan-B111-qa/server/src/index.ts:230:2)";
  assert.equal(safeWindowsStartupSite(stack, root), "server/src/config.ts:265");
});
test("admits only repository package source paths with bounded line numbers", () => {
  const stack = "Error: synthetic\n    at fn (file:///D:/Bostan-B111-qa/packages/db/src/test-embedded-postgres.ts:94:5)";
  assert.equal(safeWindowsStartupSite(stack, root),
    "packages/db/src/test-embedded-postgres.ts:94");
});
test("accepts only documented static startup error codes", () => {
  assert.equal(safeWindowsStartupCode({code:"ENOENT"}), "ENOENT");
  assert.equal(safeWindowsStartupCode({code:"ERR_MODULE_NOT_FOUND"}), "ERR_MODULE_NOT_FOUND");
  assert.equal(safeWindowsStartupCode({code:"postgres://SECRET"}), "unknown");
  assert.equal(safeWindowsStartupCode({code:"42P01; secret"}), "unknown");
  assert.equal(safeWindowsStartupCode(new Error("secret")), "unknown");
});
test("extracts only a validated npm package name, never its importer path", () => {
  assert.equal(safeWindowsMissingPackage({
    code:"ERR_MODULE_NOT_FOUND",
    message:"Cannot find package '@bostan/plugin-sdk' imported from file:///D:/SECRET/parent.ts",
  }), "package:@bostan/plugin-sdk");
  assert.equal(safeWindowsMissingPackage({
    code:"ERR_MODULE_NOT_FOUND",
    message:"Cannot find package '../secret' imported from D:/home/private",
  }), "unknown");
  assert.equal(safeWindowsMissingPackage({
    code:"ERR_MODULE_NOT_FOUND",
    message:"Cannot find module 'D:/SECRET/parent.js' imported from D:/home/private",
  }), "unknown");
  assert.equal(safeWindowsMissingPackage({
    code:"ENOENT",message:"Cannot find package 'bostan' imported from SECRET",
  }), "unknown");
});
test("reporting a missing local module reveals only an owned relative source file", () => {
  assert.equal(safeWindowsMissingLocalModule({
    code:"ERR_MODULE_NOT_FOUND",
    message:"Cannot find module 'D:\\Bostan-B111-qa\\packages\\plugins\\sdk\\dist\\index.js' imported from PRIVATE",
  }, root), "repo:packages/plugins/sdk/dist/index.js");
  assert.equal(safeWindowsMissingLocalModule({
    code:"ERR_MODULE_NOT_FOUND",
    message:"Cannot find module 'file:///D:/Bostan-B111-qa/server/dist/index.js' imported from SECRET",
  }, root), "repo:server/dist/index.js");
  for (const file of ["D:/secret/private.js","D:/Bostan-B111-qa-copy/server/dist/index.js"]) {
    assert.equal(safeWindowsMissingLocalModule({
      code:"ERR_MODULE_NOT_FOUND",
      message:"Cannot find module '" + file + "' imported from PRIVATE",
    },root),"unknown");
  }
});
test("refuses external, sibling, traversal and untrusted stack locations", () => {
  for (const location of [
    "D:/Other/server/src/config.ts:42:1",
    "D:/Bostan-B111-qa-copy/server/src/config.ts:42:1",
    "D:/Bostan-B111-qa/server/src/../secrets.ts:42:1",
    "D:/Bostan-B111-qa/server/node_modules/secret.ts:42:1",
  ]) {
    const stack = "Error: synthetic\n    at start (file:///" + location + ")";
    assert.equal(safeWindowsStartupSite(stack, root), "unknown", location);
  }
});
test("never returns credential text or a forged source marker from the message", () => {
  const secret = "postgres://bostan:SYNTHETIC_SECRET@127.0.0.1:5432/bostan";
  for (const stack of [
    "Error: " + secret + " server/src/index.ts:987:1",
    "Error: " + secret + "\n    at fn (https://host/server/src/index.ts:55:1)",
    "Error: " + secret + "\n    at fn (D:/Bostan-B111-qa/server/src/index.ts:9999999:1)",
  ]) {
    const result = safeWindowsStartupSite(stack, root);
    assert.equal(result, "unknown");
    assert.doesNotMatch(result, /postgres|secret|https?|D:/i);
  }
});
