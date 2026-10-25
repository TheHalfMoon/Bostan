import { randomUUID } from "node:crypto";
/**
 * A real Chromium/Playwright browser against the Bostan private synthetic app.
 * Source QA only: no installed browser session or external remote service.
 */
export function requirePrivateBrowserQaTarget(origin, env = process.env) {
  if (env.BOSTAN_LIVE_LOCAL_QA_CONFIRM !== "1" ||
      env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1") {
    throw new Error("Bostan browser source QA needs explicit disposable local browser consent");
  }
  let target;
  try { target = new URL(origin); }
  catch { throw new Error("Bostan source browser refuses a non-private exact loopback origin"); }
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" ||
      !/^[1-9]\d{0,4}$/.test(target.port) || Number(target.port) > 65535 ||
      target.username || target.password || target.pathname !== "/" ||
      target.search || target.hash) {
    throw new Error("Bostan source browser refuses a non-private exact loopback origin");
  }
  return target.origin;
}

export function isAllowedPrivateBrowserRequest(url, privateOrigin) {
  return url === privateOrigin || url.startsWith(privateOrigin + "/") ||
    url.startsWith("data:") || url.startsWith("blob:");
}

export function requireBostanBrowserOnboardingConsent(env) {
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E !== "1" ||
      env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1" ||
      env.BOSTAN_LIVE_LOCAL_QA_CONFIRM !== "1") {
    throw new Error("Bostan browser onboarding QA needs separately confirmed private source wizard consent");
  }
}

export function requireBostanBrowserAgentDraftConsent(env) {
  requireBostanBrowserOnboardingConsent(env);
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E !== "1") {
    throw new Error("Bostan first-agent draft QA needs a separate no-model browser consent");
  }
}

export function requireBostanBrowserAdapterSelectionConsent(env) {
  requireBostanBrowserAgentDraftConsent(env);
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E !== "1") {
    throw new Error("Bostan adapter selection QA requires a separate no-inference browser consent");
  }
}

/**
 * Selecting OpenAI in the UI can intentionally resolve to the native
 * Bostan Runner whose persisted internal adapter ID is paperclip_runner.
 * That route is correct ONLY when the persisted provider is codex; never
 * treat arbitrary built-in runners as an OpenAI selection.
 */
export function isPersistedPausedCodexSetup(agent) {
  const matchesProvider =
    (agent?.adapterType === "codex_local" &&
      (!agent?.adapterConfig?.provider || agent?.adapterConfig.provider === "codex")) ||
    (agent?.adapterType === "paperclip_runner" &&
      agent?.adapterConfig?.provider === "codex");
  return Boolean(matchesProvider &&
    agent?.metadata?.setupAdapterPending === false &&
    agent?.pauseReason === "setup" &&
    agent?.status === "paused" &&
    agent?.runtimeConfig?.heartbeat?.enabled !== true);
}

async function runSyntheticPrivateOnboardingWizard(page, privateOrigin, env) {
  const name = "Bostan Browser Onboarding QA " + randomUUID();
  // The donor-compatible localStorage key is an internal persisted protocol,
  // not product branding, and must not be renamed silently.
  await page.addInitScript(() => {
    localStorage.setItem("paperclip-onboarding-state", JSON.stringify({
      step: 1, companyName: "", createdCompanyId: null,
    }));
  });
  const setting = await page.request.patch(privateOrigin + "/api/instance/settings/experimental", {
    data: { enableConferenceRoomChat: true },
    timeout: 15_000,
  });
  if (!setting.ok()) throw new Error("Isolated onboarding flag not available to synthetic QA");
  await page.goto(privateOrigin + "/onboarding", {
    waitUntil: "domcontentloaded", timeout: 40_000,
  });
  const start = page.getByRole("button", { name: /Start Onboarding|New Organization|Add Agent/ });
  if (await start.count()) await start.first().click();
  const create = page.getByRole("button", { name: /Build a new organization/ });
  if (await create.count()) await create.first().click();
  await page.getByRole("heading", { name: "What is the name of your organization?" })
    .waitFor({ state: "visible", timeout: 25_000 });
  await page.getByPlaceholder("e.g. Northwind Labs").fill(name);
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.locator("#onboarding-agent-name")
    .waitFor({ state: "visible", timeout: 35_000 });
  const companiesResult = await page.request.get(privateOrigin + "/api/companies");
  if (!companiesResult.ok()) throw new Error("Browser onboarding could not read persisted new company");
  const companies = await companiesResult.json();
  const actual = (Array.isArray(companies) ? companies : companies.companies ?? [])
    .find(company => company?.name === name);
  if (!actual?.id) throw new Error("Browser onboarding did not persist the new synthetic company");
  const goals = await page.request.get(privateOrigin + "/api/companies/" + actual.id + "/goals");
  if (!goals.ok()) throw new Error("Browser onboarding could not verify synthetic company goals");
  const goalRows = await goals.json();
  if ((Array.isArray(goalRows) ? goalRows : []).some(goal => goal.level === "company")) {
    throw new Error("Browser onboarding invented an unwanted synthetic company goal");
  }
  let firstAgentDraft = null;
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E === "1") {
    requireBostanBrowserAgentDraftConsent(env);
    const name = "Bostan Synthetic Agent " + randomUUID();
    await page.locator("#onboarding-agent-name").fill(name);
    const createResponse = page.waitForResponse(response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/companies/" + actual.id + "/agents"),
    { timeout: 30_000 });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const response = await createResponse;
    if (!response.ok()) throw new Error("Bostan wizard agent draft API rejected creation");
    const agent = await response.json();
    if (!agent?.id || agent.name !== name || agent.pauseReason !== "setup" ||
        agent.metadata?.setupAdapterPending !== true) {
      throw new Error("Bostan wizard created an unexpected active or fabricated agent");
    }
    // The next step must be choosing an adapter. Never select a provider
    // or trigger inference in this purely offline synthetic source smoke.
    await page.getByRole("radio").first().waitFor({ state: "visible", timeout: 25_000 });
    const persistedResponse = await page.request.get(
      privateOrigin + "/api/agents/" + agent.id + "?companyId=" + actual.id,
    );
    if (!persistedResponse.ok()) throw new Error("Bostan draft agent was not persisted");
    const persisted = await persistedResponse.json();
    if (persisted.id !== agent.id || persisted.name !== name ||
        persisted.pauseReason !== "setup" ||
        persisted.metadata?.setupAdapterPending !== true) {
      throw new Error("Bostan draft agent changed state before an adapter was selected");
    }
    firstAgentDraft = { persistedInactive: true, awaitingAdapter: true };
    if (env.BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E === "1") {
      requireBostanBrowserAdapterSelectionConsent(env);
      // Selection is allowed only for a stopped setup draft. Stop before any
      // login, adapter test or model launch, which are separate release gates.
      const adapterChoice = page.getByRole("radio").filter({ hasText: /OpenAI/ }).first();
      await adapterChoice.waitFor({ state: "visible", timeout: 20_000 });
      await adapterChoice.click();
      await page.getByRole("heading", { name: "Connect a model" })
        .waitFor({ state: "visible", timeout: 25_000 });
      const updated = await page.request.get(
        privateOrigin + "/api/agents/" + agent.id + "?companyId=" + actual.id,
      );
      if (!updated.ok()) throw new Error("Bostan did not persist adapter selection");
      let agentAfterAdapter = await updated.json();
      // Native Codex intentionally stores paperclip_runner with provider=codex.
      // Verify actual provider/config and persisted paused state, not a UI
      // adapter alias that differs from the correct internal runner identity.
      for (let attempt = 0; attempt < 12 &&
          !isPersistedPausedCodexSetup(agentAfterAdapter); attempt++) {
        await page.waitForTimeout(250);
        const res = await page.request.get(
          privateOrigin + "/api/agents/" + agent.id + "?companyId=" + actual.id,
        );
        if (!res.ok()) throw new Error("Bostan adapter selection follow-up read failed");
        agentAfterAdapter = await res.json();
      }
      if (!isPersistedPausedCodexSetup(agentAfterAdapter)) {
        throw new Error("Bostan selected adapter was not persisted as an inactive setup draft: " +
          JSON.stringify({
            correctAdapter: isPersistedPausedCodexSetup(agentAfterAdapter),
            nativeCodexProvider: agentAfterAdapter.adapterType === "paperclip_runner" &&
              agentAfterAdapter.adapterConfig?.provider === "codex",
            pendingFlagCleared: agentAfterAdapter.metadata?.setupAdapterPending === false,
            setupPauseReason: agentAfterAdapter.pauseReason === "setup",
            pausedStatus: agentAfterAdapter.status === "paused",
            heartbeatEnabled: agentAfterAdapter.runtimeConfig?.heartbeat?.enabled === true,
            statusCategory: ["paused", "idle", "active"].includes(agentAfterAdapter.status)
              ? agentAfterAdapter.status : "other",
          }));
      }
      firstAgentDraft = { persistedInactive: true, awaitingAdapter: false,
        localAdapterSelected: true, noActiveWorker: true };
    }
  }
  return { companyCreatedByUi: true, noUnrequestedGoal: true,
    ...(firstAgentDraft ? { firstAgentDraft } : {}) };
}

async function runSyntheticPrivateOcrUi(page, privateOrigin, issue) {
  if (typeof issue.id !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(issue.id) ||
      typeof issue.issuePrefix !== "string" ||
      !/^[A-Z]{2,12}$/.test(issue.issuePrefix)) {
    throw new Error("Bostan OCR browser QA requires a real synthetic task and scoped company");
  }
  const documentsRoute = "/api/issues/" + issue.id + "/documents";
  const firstDocuments = await page.request.get(privateOrigin + documentsRoute);
  if (!firstDocuments.ok()) throw new Error("Bostan OCR synthetic documents were unreadable");
  const initial = await firstDocuments.json();
  const originalCount = Array.isArray(initial) ? initial.length : null;
  if (originalCount === null) throw new Error("Bostan OCR synthetic documents were malformed");

  await page.goto(privateOrigin + "/" + issue.issuePrefix + "/issues/" + issue.id, {
    waitUntil: "domcontentloaded", timeout: 45_000,
  });
  // The modern default chat-style task UI keeps documents in Artifacts,
  // rather than the legacy center-pane IssueDocumentsSection.
  const panelButton = page.getByRole("button", { name: "Extract text from image" });
  // DOMContentLoaded is earlier than React lazy-route hydration. An
  // immediate count()==0 is not evidence the control is absent.
  let buttonVisible = false;
  try {
    await panelButton.first().waitFor({ state: "visible", timeout: 15_000 });
    buttonVisible = true;
  } catch { /* Only after hydration timeout try the properties-pane path. */ }
  if (!buttonVisible) {
    const showProperties = page.getByRole("button", { name: "Show properties" });
    if (await showProperties.count()) await showProperties.first().click();
    const artifacts = page.getByRole("tab", { name: "Artifacts" });
    await artifacts.first().waitFor({ state: "visible", timeout: 20_000 });
    await artifacts.first().click();
    await panelButton.first().waitFor({ state: "visible", timeout: 20_000 });
  }
  await panelButton.first().click();
  await page.getByLabel("OCR language").selectOption("ara");
  const image = new URL("../server/src/__tests__/fixtures/bostan-ocr-synthetic-arabic.png",
    import.meta.url);
  await page.getByLabel("OCR image").setInputFiles(image.pathname);
  const preview = page.getByLabel("Extracted OCR text");
  await preview.waitFor({ state: "visible", timeout: 35_000 });
  const recognized = await preview.inputValue();
  if (!recognized.includes("بستان")) throw new Error("Bostan browser did not display real offline Arabic OCR");
  const laterDocuments = await page.request.get(privateOrigin + documentsRoute);
  if (!laterDocuments.ok()) throw new Error("Bostan could not re-read OCR source task documents");
  const after = await laterDocuments.json();
  if (!Array.isArray(after) || after.length !== originalCount) {
    throw new Error("Bostan OCR preview silently saved a document or altered source evidence");
  }
  return { actualBrowserArabicPreview: true, autoDocumentWrites: false };
}

export async function runPrivateBostanBrowserQa({
  origin, expectedCompanyId, env = process.env, ocrIssue = null,
}) {
  const privateOrigin = requirePrivateBrowserQaTarget(origin, env);
  if (typeof expectedCompanyId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedCompanyId)) {
    throw new Error("Bostan browser QA requires an actual synthetic persisted company UUID");
  }
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true, timeout: 25_000 });
  try {
    const page = await browser.newPage({
      serviceWorkers: "block",
      viewport: { width: 1280, height: 800 },
      acceptDownloads: false,
    });
    let browserPageErrors = 0;
    let blockedExternalRequests = 0;
    page.on("pageerror", () => { browserPageErrors += 1; });
    // Even vendor scripts/fonts are blocked. Nothing outside localhost may
    // receive synthetic company IDs or connect to an external provider.
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (isAllowedPrivateBrowserRequest(url, privateOrigin)) {
        await route.continue();
      } else {
        blockedExternalRequests += 1;
        await route.abort("blockedbyclient");
      }
    });
    const response = await page.goto(privateOrigin + "/", {
      waitUntil: "domcontentloaded",
      timeout: 40_000,
    });
    if (!response || response.status() !== 200) {
      throw new Error("Bostan browser did not load the real private application document");
    }
    await page.waitForFunction(() => {
      const root = document.querySelector("#root");
      return root && root.childElementCount > 0 &&
        document.body.innerText.trim().length > 0;
    }, null, { timeout: 30_000 });
    const snapshot = await page.evaluate(async () => {
      const health = await fetch("/api/health", { credentials: "same-origin" }).then(r => r.json());
      const companies = await fetch("/api/companies", { credentials: "same-origin" }).then(r => {
        if (!r.ok) throw Error("Company read failed");
        return r.json();
      });
      return {
        title: document.title,
        mounted: (document.querySelector("#root")?.childElementCount ?? 0) > 0,
        healthMode: health.deploymentMode,
        healthExposure: health.deploymentExposure,
        companyIds: (Array.isArray(companies) ? companies : companies.companies ?? [])
          .map(c => c.id),
      };
    });
    // React routers may temporarily empty #root while switching company
    // context after the initial bootstrap. Verify the final hydrated screen
    // after the API read, not just the initial splash/loading boundary.
    if (!snapshot.mounted) {
      try {
        await page.waitForFunction(() => {
          const root = document.querySelector("#root");
          return root && root.childElementCount > 0 &&
            document.body.innerText.trim().length > 0;
        }, null, { timeout: 15_000, polling: 250 });
        snapshot.mounted = true;
      } catch { /* Qualify on the final persisted state check below. */ }
    }
    if (!snapshot.mounted || !/\bBostan\b/.test(snapshot.title) ||
        snapshot.healthMode !== "local_trusted" ||
        snapshot.healthExposure !== "private" ||
        !snapshot.companyIds.includes(expectedCompanyId)) {
      // Only booleans: never emit company names, IDs, or browser state text.
      throw new Error("Bostan browser could not verify private persisted synthetic state: " +
        JSON.stringify({
          hydrated: snapshot.mounted,
          brandTitle: /\bBostan\b/.test(snapshot.title),
          localMode: snapshot.healthMode === "local_trusted",
          privateExposure: snapshot.healthExposure === "private",
          persistedSyntheticCompany: snapshot.companyIds.includes(expectedCompanyId),
          pageErrorsSeen: browserPageErrors,
        }));
    }
    const onboarding = env.BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E === "1"
      ? (requireBostanBrowserOnboardingConsent(env),
        await runSyntheticPrivateOnboardingWizard(page, privateOrigin, env))
      : null;
    const ocr = env.BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E === "1"
      ? await runSyntheticPrivateOcrUi(page, privateOrigin, ocrIssue)
      : null;
    return { qualified: true, browser: "chromium-headless", mounted: true,
      privateApi: true, persistedCompany: true,
      ...(onboarding ? { onboarding } : {}),
      ...(ocr ? { ocr } : {}),
      pageErrorsSeen: browserPageErrors, blockedExternalRequests };
  } finally {
    await browser.close();
  }
}
