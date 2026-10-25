import test from "node:test";
import assert from "node:assert/strict";
import { requirePrivateBrowserQaTarget, isAllowedPrivateBrowserRequest,
  requireBostanBrowserOnboardingConsent, runPrivateBostanBrowserQa } from "./bostan-local-browser-qa.mjs";

const admitted = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_LIVE_LOCAL_BROWSER_E2E: "1" };
test("browser QA accepts only an explicitly confirmed exact local origin", () => {
  assert.equal(requirePrivateBrowserQaTarget("http://127.0.0.1:31881/", admitted),
    "http://127.0.0.1:31881");
  for (const rejected of [
    "http://localhost:31881/",
    "http://127.0.0.1/",
    "https://127.0.0.1:31881/",
    "http://127.0.0.1:31881/?foo=bar",
    "http://127.0.0.1:31881/evil",
    "http://127.0.0.1:99999/",
    "http://user:password@127.0.0.1:31881/",
    "https://bostan.example/"]) {
    assert.throws(() => requirePrivateBrowserQaTarget(rejected, admitted),
      /refuses a non-private/);
  }
});
test("browser QA requires separate explicit browser consent", () => {
  assert.throws(() => requirePrivateBrowserQaTarget("http://127.0.0.1:31881/", {}),
    /explicit disposable/);
  assert.throws(() => requirePrivateBrowserQaTarget("http://127.0.0.1:31881/", {
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1",
  }), /explicit disposable/);
});
test("browser QA rejects a fabricated persisted company before opening Chromium", async () => {
  await assert.rejects(runPrivateBostanBrowserQa({
    origin: "http://127.0.0.1:31881/", expectedCompanyId: "not-an-id", env: admitted,
  }), /actual synthetic persisted company UUID/);
});

test("browser source QA blocks all external HTTP/HTTPS origins", () => {
  const origin = "http://127.0.0.1:31881";
  for (const allowed of [
    origin, origin + "/", origin + "/api/health", origin + "/assets/app.js",
    "data:image/svg+xml,abc", "blob:http://127.0.0.1:31881/1234",
  ]) {
    assert.equal(isAllowedPrivateBrowserRequest(allowed, origin), true, allowed);
  }
  for (const external of [
    "http://127.0.0.1:31882/api/companies",
    "http://127.0.0.1:31881.evil.test/",
    "http://localhost:31881/",
    "https://127.0.0.1:31881/",
    "https://fonts.googleapis.com/css",
    "http://10.1.1.10/",
    "file:///Users/Private/secrets",
    "ws://127.0.0.1:31881/socket",
  ]) {
    assert.equal(isAllowedPrivateBrowserRequest(external, origin), false, external);
  }
});

test("synthetic company onboarding is a separate three-flag private browser opt-in", () => {
  const allowed = { ...admitted, BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E: "1" };
  assert.doesNotThrow(() => requireBostanBrowserOnboardingConsent(allowed));
  for (const removed of Object.keys(allowed)) {
    assert.throws(() => requireBostanBrowserOnboardingConsent({
      ...allowed, [removed]: "0",
    }), /separately confirmed private source wizard/);
  }
});
