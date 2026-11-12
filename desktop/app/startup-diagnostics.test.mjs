import assert from "node:assert/strict";
import { test } from "node:test";
import diagnostics from "./startup-diagnostics.cjs";

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
