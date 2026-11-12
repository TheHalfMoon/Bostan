import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";
import diagnostics from "./startup-diagnostics.cjs";

test("startup sites disclose only a fixed module identity and bounded line numbers", () => {
  const root = path.resolve("synthetic runtime");
  const entry = pathToFileURL(path.join(root, "dist/index.js")).href;
  const error = { stack: `Error: https://user:secret@example.test\n    at privateFunction (${entry}:123:45)` };
  const line = diagnostics.startupFailureSite(error, root);
  assert.equal(line, "BOSTAN_DESKTOP_STARTUP_SITE server:123:45");
  assert.equal(diagnostics.isStartupDiagnosticLine(line), true);
  assert.equal(diagnostics.startupFailureSite({ stack: error.stack.replace("index.js", "private-file.js") }, root), null);
  assert.equal(diagnostics.startupFailureSite(error, path.resolve("different-root")), null);
  assert.equal(diagnostics.startupFailureSite({ get stack() { throw Error("private"); } }, root), null);
  for (const suffix of ["server:123:45 secret", "private:123:45", "server:0:1", "server:1234567:1", "server:1:1\nsecret", "server:1:1\n", "server:1:1\r"]) {
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_SITE " + suffix), false);
  }
});

test("startup receipts accept only fixed phases and failure codes", () => {
  assert.equal(diagnostics.startupPhaseLine("importing_server"), "BOSTAN_DESKTOP_STARTUP_PHASE importing_server");
  assert.equal(diagnostics.isStartupDiagnosticLine(diagnostics.startupPhaseLine("importing_server")), true);
  assert.equal(diagnostics.startupFailureLine("ERR_MODULE_NOT_FOUND"), "BOSTAN_DESKTOP_STARTUP_FAILURE ERR_MODULE_NOT_FOUND");
  assert.equal(diagnostics.isStartupDiagnosticLine(diagnostics.startupFailureLine("EPERM")), true);
});
test("arbitrary dependency errors and forged multiline receipts disclose no raw data", () => {
  for (const value of ["https://user:secret@example.test", "C:\\private\\fixture", "ERR_PRIVATE_SECRET", "ready\nsecret"]) {
    assert.equal(diagnostics.startupPhaseLine(value), null);
    assert.equal(diagnostics.startupCode(value), "STARTUP_FAILED");
    assert.equal(diagnostics.startupFailureLine(value).includes(value), false);
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_PHASE " + value), false);
    assert.equal(diagnostics.isStartupDiagnosticLine("BOSTAN_DESKTOP_STARTUP_FAILURE " + value), false);
  }
});

test("startup site accepts canonical filesystem paths without disclosing unrelated frames", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-startup-site-"));
  try {
    const canonical = path.join(root, "canonical");
    const alias = path.join(root, "alias");
    fs.mkdirSync(canonical);
    fs.symlinkSync(canonical, alias, process.platform === "win32" ? "junction" : "dir");
    const stack = `Error: private\n    at privateFunction (${pathToFileURL(path.join(canonical, "dist/index.js")).href}:71:9)`;
    assert.equal(diagnostics.startupFailureSite({ stack }, alias), "BOSTAN_DESKTOP_STARTUP_SITE server:71:9");
    assert.equal(diagnostics.startupFailureSite({ stack }, path.join(root, "unrelated")), null);
    assert.equal(diagnostics.startupFailureSite({ stack: stack.replace("index.js", "secret.js") }, alias), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
