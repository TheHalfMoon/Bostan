import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { requireBostanSourceSmokeAdmission, requireBostanOcrBrowserBundle, assertBostanOcrBundleFileMetadata,
  assertPrivateNodeQaEgressReceipt, requireBostanLocalColdRestoreAdmission } from "./bostan-local-live-persistence-e2e.mjs";

test("real database smoke refuses non-opted-in execution before any process starts", () => {
  assert.throws(() => requireBostanSourceSmokeAdmission({}, "darwin"), /requires/);
  assert.throws(() => requireBostanSourceSmokeAdmission({BOSTAN_LIVE_LOCAL_QA_CONFIRM:"true"}, "linux"), /requires/);
});
test("does not bypass unsupported Windows temporary runtime security policy", () => {
  assert.throws(() => requireBostanSourceSmokeAdmission({BOSTAN_LIVE_LOCAL_QA_CONFIRM:"1"}, "win32"), /not qualified for Windows/);
});
test("only macOS and Linux admit an explicitly requested isolated smoke", () => {
  for (const platform of ["darwin", "linux"]) {
    assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({BOSTAN_LIVE_LOCAL_QA_CONFIRM:"1"},platform));
  }
});

test("real free-model runtime requires separate opt-in and an allowlisted model before filesystem use", () => {
  const base = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1" };
  assert.throws(() => requireBostanSourceSmokeAdmission(base, "darwin"), /explicit BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL/);
  assert.throws(() => requireBostanSourceSmokeAdmission({
    ...base, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1", BOSTAN_E2E_FREE_MODEL: "anthropic/paid",
  }, "darwin"), /Only explicitly permitted free test models/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    ...base, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
    BOSTAN_E2E_FREE_MODEL: "opencode/deepseek-v4.1-flash-free",
  }, "darwin"));
  assert.throws(() => requireBostanSourceSmokeAdmission({
    ...base, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
  }, "win32"), /not qualified for Windows/);
});


test("two-agent live QA requires both the free agent and online provider opt-ins", () => {
  assert.throws(() => requireBostanSourceSmokeAdmission({
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
  }, "darwin"), /explicit real free-agent/);
  assert.throws(() => requireBostanSourceSmokeAdmission({
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1",
  }, "darwin"), /explicit BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1",
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
    BOSTAN_E2E_FREE_MODEL: "opencode/deepseek-v4.1-flash-free",
  }, "darwin"));
});

test("cross-agent source review is a separate gated opt-in", () => {
  const withReview = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1",
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
    BOSTAN_E2E_REVIEW_FIRST_AGENT: "1" };
  assert.throws(() => requireBostanSourceSmokeAdmission(withReview, "darwin"), /separately admitted second free agent/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    ...withReview, BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_E2E_FREE_MODEL: "opencode/deepseek-v4.1-flash-free",
  }, "darwin"));
});


test("private OCR browser requires actual Chromium and explicitly enabled offline OCR", () => {
  for (const absent of ["BOSTAN_LIVE_LOCAL_BROWSER_E2E", "BOSTAN_LOCAL_OCR_PREVIEW_ENABLE"]) {
    const env = {
      BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
      BOSTAN_LIVE_LOCAL_BROWSER_E2E: "1",
      BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E: "1",
      BOSTAN_LOCAL_OCR_PREVIEW_ENABLE: "1",
      [absent]: "0",
    };
    assert.throws(() => requireBostanSourceSmokeAdmission(env, "darwin"),
      /Private OCR browser QA requires/);
  }
});


test("large local image OCR requires the existing private OCR browser admission", () => {
  const env = {
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_E2E: "1",
    BOSTAN_LOCAL_OCR_PREVIEW_ENABLE: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E: "1",
  };
  assert.throws(() => requireBostanSourceSmokeAdmission(env, "darwin"),
    /Large image browser OCR QA requires/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    ...env, BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E: "1",
  }, "darwin"));
});


test("real analytics Chromium QA requires the explicit disposable browser admission", () => {
  const bad = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_INSIGHTS_E2E: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_E2E: "0" };
  assert.throws(() => requireBostanSourceSmokeAdmission(bad, "darwin"),
    /Private task-insights browser QA requires/);
});


test("browser route-scoped lazy task bundle QA requires explicit real Chromium admission", () => {
  const env = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E: "1" };
  assert.throws(() => requireBostanSourceSmokeAdmission(env, "darwin"),
    /Private lazy task bundle QA requires/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    ...env, BOSTAN_LIVE_LOCAL_BROWSER_E2E: "1",
  }, "darwin"));
});


test("private HTML/referrer leak QA requires separate disposable browser opt-in", () => {
  const env = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_HTML_HEADERS_E2E: "1" };
  assert.throws(() => requireBostanSourceSmokeAdmission(env, "darwin"),
    /Private static HTML privacy QA requires real Chromium opt-in/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    ...env, BOSTAN_LIVE_LOCAL_BROWSER_E2E: "1",
  }, "darwin"));
});

test("OCR browser QA rejects an unbuilt or flag-disabled UI before starting PostgreSQL", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-ocr-build-guard-"));
  try {
    assert.throws(() => requireBostanOcrBrowserBundle(dir), /exactly one built IssueDetail/);
    const chunk = path.join(dir, "IssueDetail-SYNTHETIC.js");
    fs.writeFileSync(chunk, "ordinary production UI chunk without OCR controls");
    assert.throws(() => requireBostanOcrBrowserBundle(dir),
      /VITE_BOSTAN_LOCAL_OCR_PREVIEW_ENABLE=1/);
    fs.writeFileSync(chunk, "Extract text from image; OCR language; source-only test fixture");
    assert.doesNotThrow(() => requireBostanOcrBrowserBundle(dir));
    fs.writeFileSync(path.join(dir, "IssueDetail-SECOND.js"), "Extract text from image OCR language");
    assert.throws(() => requireBostanOcrBrowserBundle(dir), /exactly one built IssueDetail/);
    fs.unlinkSync(path.join(dir, "IssueDetail-SECOND.js"));
    fs.unlinkSync(chunk);
    // Windows source QA must not need Developer Mode or symlink privilege:
    // validate the security decision with synthetic lstat-like metadata too.
    const valid = { isFile: () => true, isSymbolicLink: () => false, size: 1024, nlink: 1 };
    assert.equal(assertBostanOcrBundleFileMetadata(valid), true);
    for (const modified of [
      { ...valid, isSymbolicLink: () => true },
      { ...valid, isFile: () => false },
      { ...valid, nlink: 2 },
      { ...valid, size: 0 },
      { ...valid, size: 21 * 1024 * 1024 },
    ]) {
      assert.throws(() => assertBostanOcrBundleFileMetadata(modified), /private regular single-link/);
    }
    try {
      fs.symlinkSync(path.join(dir, "missing.js"), chunk);
      assert.throws(() => requireBostanOcrBrowserBundle(dir), /cannot verify the private route bundle/);
    } catch (error) {
      if (error?.code !== "EPERM" && error?.code !== "EACCES" && error?.code !== "ENOTSUP") throw error;
      // Synthetic metadata above covers the symlink rejection branch.
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("test-only Node no-egress profile requires no external model runs", () => {
  const allowed = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_TEST_ONLY_NODE_EGRESS_PROFILE: "1" };
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission(allowed, "darwin"));
  for (const key of [
    "BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E",
    "BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E",
    "BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL",
  ]) {
    assert.throws(() => requireBostanSourceSmokeAdmission({ ...allowed, [key]: "1" }, "darwin"),
      /cannot activate any external model/);
  }
});

test("real private Node smoke cannot qualify an unarmed or egress-positive receipt", () => {
  assert.deepEqual(assertPrivateNodeQaEgressReceipt("armed\narmed\n"),
    { armedNodeProcesses: 2, blockedExternalNodeRequests: 0 });
  for (const invalid of [
    "", "armed\n", "armed\nhttp\narmed\n",
    "armed\narmed\nfetch\n", "armed\narmed\nhttp2\n",
    null, "armed\narmed\nuser-external\n",
  ]) assert.throws(() => assertPrivateNodeQaEgressReceipt(invalid), /not fully guarded|missing or malformed/);
});

test("cold database backup+restore smoke requires separate real browser admission", () => {
  const base = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
    BOSTAN_LIVE_LOCAL_COLD_RESTORE_E2E: "1" };
  assert.equal(requireBostanLocalColdRestoreAdmission({}), false);
  assert.throws(() => requireBostanSourceSmokeAdmission(base, "darwin"),
    /requires Chromium after restoration/);
  const eligible = { ...base, BOSTAN_LIVE_LOCAL_BROWSER_E2E: "1" };
  assert.equal(requireBostanLocalColdRestoreAdmission(eligible), true);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission(eligible, "darwin"));
  for (const flag of [
    "BOSTAN_TEST_ONLY_NODE_EGRESS_PROFILE", "BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E",
    "BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E", "BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL",
  ]) {
    assert.throws(() => requireBostanSourceSmokeAdmission({ ...eligible, [flag]: "1" }, "darwin"),
      /separate from network guard and external model runs/);
  }
  assert.throws(() => requireBostanSourceSmokeAdmission(eligible, "win32"),
    /not qualified for Windows/);
});
