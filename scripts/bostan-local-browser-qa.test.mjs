import test from "node:test";
import assert from "node:assert/strict";
import { requirePrivateBrowserQaTarget, isAllowedPrivateBrowserRequest,
  requireBostanBrowserOnboardingConsent,
  requireBostanBrowserAgentDraftConsent,
  requireBostanBrowserAdapterSelectionConsent,
  isPersistedPausedCodexSetup, runPrivateBostanBrowserQa,
  isAllowedPrivateBrowserWebSocket, installPrivateBrowserNetworkCapture,
  assertPrivateBrowserEgressEvidence } from "./bostan-local-browser-qa.mjs";

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

test("first-agent draft QA requires a fourth opt-in and cannot activate the LLM provider", () => {
  const allowed = {
    ...admitted, BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E: "1",
  };
  assert.doesNotThrow(() => requireBostanBrowserAgentDraftConsent(allowed));
  for (const removed of Object.keys(allowed)) {
    assert.throws(() => requireBostanBrowserAgentDraftConsent({
      ...allowed, [removed]: "0",
    }), /private source wizard consent|separate no-model browser consent/);
  }
});

test("adapter selection QA requires a fifth opt-in without triggering paid inference", () => {
  const allowed = {
    ...admitted, BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E: "1",
    BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E: "1",
  };
  assert.doesNotThrow(() => requireBostanBrowserAdapterSelectionConsent(allowed));
  for (const removed of Object.keys(allowed)) {
    assert.throws(() => requireBostanBrowserAdapterSelectionConsent({
      ...allowed, [removed]: "0",
    }), /private source wizard consent|separate no-model browser consent|separate no-inference browser consent/);
  }
});

test("actual paused native Bostan runner for OpenAI is qualified by provider codex", () => {
  const agent = {
    adapterType: "paperclip_runner",
    adapterConfig: { provider: "codex", model: "synthetic" },
    metadata: { setupAdapterPending: false },
    pauseReason: "setup", status: "paused",
    runtimeConfig: { heartbeat: { enabled: false } },
  };
  assert.equal(isPersistedPausedCodexSetup(agent), true);
  assert.equal(isPersistedPausedCodexSetup({
    ...agent, adapterType: "codex_local",
  }), true);
  for (const forged of [
    { adapterConfig: { provider: "claude" } },
    { adapterConfig: { provider: "acpx", acpxAgent: "copilot" } },
    { adapterType: "process" },
    { adapterType: "claude_local" },
    { adapterType: "codex_local", adapterConfig: { provider: "claude" } },
    { status: "active" },
    { pauseReason: null },
    { metadata: { setupAdapterPending: true } },
    { runtimeConfig: { heartbeat: { enabled: true } } },
  ]) {
    assert.equal(isPersistedPausedCodexSetup({ ...agent, ...forged }), false,
      JSON.stringify(Object.keys(forged)));
  }
});

test("isolated browser WebSockets admit only this private HTTP server's exact ws port", () => {
  const origin = "http://127.0.0.1:31881";
  for (const allowed of [
    "ws://127.0.0.1:31881/", "ws://127.0.0.1:31881/live?session=synthetic",
  ]) assert.equal(isAllowedPrivateBrowserWebSocket(allowed, origin), true);
  for (const denied of [
    "wss://127.0.0.1:31881/live", "ws://127.0.0.1:31882/live",
    "ws://127.0.0.1:31881.evil.invalid/live",
    "ws://localhost:31881/live", "wss://evil.invalid/a",
    "ws://user:pass@127.0.0.1:31881/", "http://127.0.0.1:31881/",
    "file:///private/data", "garbage",
  ]) assert.equal(isAllowedPrivateBrowserWebSocket(denied, origin), false);
});

test("context-wide HTTP, popup and WebSocket capture refuses attempted egress even if aborted", async () => {
  const handlers = {};
  const context = {
    on(event, callback) { handlers[event] = callback; },
    async route(pattern, callback) { assert.equal(pattern, "**/*"); handlers.http = callback; },
    async routeWebSocket(pattern, callback) { assert.equal(pattern, "**/*"); handlers.ws = callback; },
  };
  const evidence = await installPrivateBrowserNetworkCapture(context, "http://127.0.0.1:31881");
  let pageErrorListener;
  handlers.page({ on(event, callback) {
    assert.equal(event, "pageerror"); pageErrorListener = callback;
  } });
  const continued = [];
  const aborted = [];
  const route = url => ({
    request() { return { url: () => url }; },
    async continue() { continued.push(url); },
    async abort(reason) { aborted.push({ url, reason }); },
  });
  await handlers.http(route("http://127.0.0.1:31881/api/health"));
  await handlers.http(route("https://example.invalid/?token=SYNTHETIC"));
  assert.equal(continued.length, 1);
  assert.equal(aborted.length, 1);
  assert.equal(aborted[0].reason, "blockedbyclient");
  const connected = [];
  const closed = [];
  const socket = url => ({
    url: () => url,
    connectToServer() { connected.push(url); },
    async close(options) { closed.push({url, options}); },
  });
  await handlers.ws(socket("ws://127.0.0.1:31881/events"));
  await handlers.ws(socket("wss://evil.invalid?access_token=SYNTHETIC"));
  assert.equal(connected.length, 1);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].options.code, 1008);
  assert.deepEqual(evidence, { blockedHttp: 1, blockedWebSockets: 1, pageErrors: 0 });
  assert.throws(() => assertPrivateBrowserEgressEvidence(evidence), /attempted external network egress/);
  pageErrorListener(Error("synthetic page error"));
  assert.equal(evidence.pageErrors, 1);
  assert.equal(assertPrivateBrowserEgressEvidence({
    blockedHttp: 0, blockedWebSockets: 0, pageErrors: 0,
  }), true);
  for (const invalid of [{ blockedHttp: -1, blockedWebSockets: 0, pageErrors: 0 },
    { blockedHttp: undefined, blockedWebSockets: 0, pageErrors: 0 }, null]) {
    assert.throws(() => assertPrivateBrowserEgressEvidence(invalid));
  }
});

test("REAL Chromium context refuses HTTP, popup navigation and external WebSockets without making network calls", {
  skip: process.env.BOSTAN_REAL_BROWSER_EGRESS_NEGATIVE_PROBE !== "1",
  timeout: 25_000,
}, async () => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true, timeout: 15_000 });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const evidence = await installPrivateBrowserNetworkCapture(context, "http://127.0.0.1:31881");
    const page = await context.newPage();
    await page.goto("about:blank");
    await page.evaluate(async () => {
      await fetch("https://synthetic.invalid/private-http-probe").catch(() => null);
      const socket = new WebSocket("wss://synthetic.invalid/private-websocket-probe");
      await new Promise(resolve => {
        socket.onerror = resolve;
        socket.onclose = resolve;
        setTimeout(resolve, 1500);
      });
      // A popup is a distinct page; a context route must block it, too.
      window.open("https://synthetic.invalid/private-popup-probe", "_blank");
    });
    for (let i = 0; i < 20 &&
      (evidence.blockedHttp < 2 || evidence.blockedWebSockets < 1); i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(evidence.blockedHttp, 2);
    assert.equal(evidence.blockedWebSockets, 1);
    assert.equal(evidence.pageErrors, 0);
    assert.throws(() => assertPrivateBrowserEgressEvidence(evidence),
      /attempted external network egress/);
  } finally {
    await browser.close();
  }
});


test("context-wide network capture can hand a private page error to in-process safe classification",async()=>{
  const handlers={};const observed=[];
  const context={
    on(event,callback){handlers[event]=callback},
    async route(pattern,callback){assert.equal(pattern,"**/*");handlers.http=callback},
    async routeWebSocket(pattern,callback){assert.equal(pattern,"**/*");handlers.ws=callback},
  };
  const evidence=await installPrivateBrowserNetworkCapture(context,
    "http://127.0.0.1:31881",{onPageError:e=>observed.push(e.name)});
  let observer;
  handlers.page({on(event,callback){assert.equal(event,"pageerror");observer=callback}});
  observer({name:"TypeError",message:"sensitive error not logged"});
  assert.equal(evidence.pageErrors,1);
  assert.deepEqual(observed,["TypeError"]);
  await assert.rejects(installPrivateBrowserNetworkCapture(context,
    "http://127.0.0.1:31881",{onPageError:"bad"}),/observer invalid/);
});
