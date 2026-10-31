import test from "node:test";
import assert from "node:assert/strict";
import {
  auditNativeSandboxReport,
  REQUIRED_SANDBOX_SUITES,
  REQUIRED_NATIVE_SANDBOX_CASES,
} from "./bostan-private-linux-vitest-report-audit.mjs";

function fixture() {
  return {
    success: true,
    numFailedTests: 0,
    testResults: REQUIRED_SANDBOX_SUITES.map((name) => ({
      name: `/private-qa/packages/adapter-utils/src/${name}`,
      status: "passed",
      assertionResults: name === "local-process-sandbox.test.ts"
        ? REQUIRED_NATIVE_SANDBOX_CASES.map((title) => ({
          title, status: "passed",
        }))
        : [{ title: "unrelated suite case", status: "passed" }],
    })),
  };
}

test("passes only an all-green four-suite report with four actual bwrap cases", () => {
  assert.deepEqual(auditNativeSandboxReport(fixture()), { suites: 4, rootlessCases: 4 });
});

test("fails closed if Vitest summary reports failure", () => {
  const report = fixture();
  report.success = false;
  assert.throws(() => auditNativeSandboxReport(report), /unsuccessful/);
});

test("fails closed if any suite is missing", () => {
  const report = fixture();
  report.testResults.pop();
  assert.throws(() => auditNativeSandboxReport(report), /suite missing/);
});

test("fails closed if a suite is skipped", () => {
  const report = fixture();
  report.testResults[2].status = "pending";
  assert.throws(() => auditNativeSandboxReport(report), /not passed/);
});

test("fails closed if a required bubblewrap integration test is skipped", () => {
  const report = fixture();
  report.testResults[0].assertionResults[1].status = "pending";
  assert.throws(() => auditNativeSandboxReport(report), /skipped, or failed/);
});

test("fails closed if the network egress integration test disappears", () => {
  const report = fixture();
  report.testResults[0].assertionResults.splice(2, 1);
  assert.throws(() => auditNativeSandboxReport(report), /missing/);
});

test("fails closed if a test result is duplicated", () => {
  const report = fixture();
  report.testResults[0].assertionResults.push({
    title: REQUIRED_NATIVE_SANDBOX_CASES[0], status: "passed",
  });
  assert.throws(() => auditNativeSandboxReport(report), /duplicated/);
});

test("fails closed if a required suite is duplicated", () => {
  const report = fixture();
  report.testResults.push({ ...report.testResults[0] });
  assert.throws(() => auditNativeSandboxReport(report), /duplicated/);
});

test("fails closed on malformed or partial JSON data", () => {
  assert.throws(() => auditNativeSandboxReport(null), /missing/);
  assert.throws(() => auditNativeSandboxReport({ success: true }), /missing/);
});
