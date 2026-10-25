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

async function syntheticLargeArabicImage(page) {
  const data = await page.evaluate(() => {
    const width = 1300, height = 950;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Synthetic OCR browser image canvas unavailable");
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#111111";
    context.direction = "rtl";
    context.font = "bold 78px Arial";
    context.fillText("وثيقة بستان عربية", 1230, 170);
    // Seeded photolike background noise only *below* the text, to create
    // a genuine >256-KiB image without any actual user/image data.
    const noise = context.createImageData(width, 560);
    let state = 15283;
    for (let i = 0; i < noise.data.length; i += 4) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const shade = 110 + (state % 145);
      noise.data[i] = shade;
      noise.data[i + 1] = shade;
      noise.data[i + 2] = shade;
      noise.data[i + 3] = 255;
    }
    context.putImageData(noise, 0, 390);
    return canvas.toDataURL("image/png");
  });
  if (typeof data !== "string" || !data.startsWith("data:image/png;base64,")) {
    throw new Error("Browser synthetic large image MIME contract failed");
  }
  const binary = Buffer.from(data.slice("data:image/png;base64,".length), "base64");
  if (binary.length <= 256 * 1024 || binary.length > 4 * 1024 * 1024) {
    throw new Error("Browser synthetic large OCR file outside admitted source range");
  }
  return { name: "bostan-synthetic-large-arabic.png", mimeType: "image/png",
    buffer: binary };
}

async function runSyntheticPrivateOcrUi(page, privateOrigin, issue, env) {
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
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E === "1") {
    const synthetic = await syntheticLargeArabicImage(page);
    // The browser must send a valid bounded JPEG, not the original multi-MiB
    // PNG, and never contact any compression or model provider.
    const responseRequest = page.waitForRequest(request =>
      request.url().endsWith("/bostan-evidence/ocr-preview") &&
      request.method() === "POST", { timeout: 30_000 });
    await page.getByLabel("OCR image").setInputFiles(synthetic);
    const actualRequest = await responseRequest;
    const payload = actualRequest.postDataJSON();
    if (payload?.mimeType !== "image/jpeg" || typeof payload.base64 !== "string" ||
        Buffer.from(payload.base64, "base64").length > 256 * 1024) {
      throw new Error("Large Bostan source OCR did not send an allowed local bounded JPEG");
    }
    await preview.waitFor({ state: "visible", timeout: 45_000 });
    if (!(await preview.inputValue()).includes("بستان")) {
      throw new Error("Large normalized Arabic source lost the synthetic OCR fixture text");
    }
  }
  const laterDocuments = await page.request.get(privateOrigin + documentsRoute);
  if (!laterDocuments.ok()) throw new Error("Bostan could not re-read OCR source task documents");
  const after = await laterDocuments.json();
  if (!Array.isArray(after) || after.length !== originalCount) {
    throw new Error("Bostan OCR preview silently saved a document or altered source evidence");
  }
  return { actualBrowserArabicPreview: true, autoDocumentWrites: false,
    ...(env.BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E === "1" ? {
      actualLargeImageNormalizedToJpeg: true,
    } : {}) };
}

async function runPrivateBostanTaskInsightsUi(page, origin, company) {
  const companyId = company?.id;
  if (typeof companyId !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(companyId) ||
      typeof company?.issuePrefix !== "string" ||
      !/^[A-Z]{2,12}$/.test(company.issuePrefix)) {
    throw new Error("Private task insights UI requires exact source company identity and prefix");
  }
  await page.goto(origin + "/" + company.issuePrefix + "/dashboard", {
    waitUntil: "domcontentloaded", timeout: 45_000,
  });
  await page.getByRole("heading", { name: "Task insights" })
    .waitFor({ state: "visible", timeout: 35_000 });
  const response = await page.request.get(
    origin + "/api/companies/" + companyId + "/bostan-analytics/task-insights?days=30",
  );
  if (!response.ok()) throw new Error("Bostan real task insights API not available to browser");
  const metrics = await response.json();
  if (metrics.schema !== "bostan.task-insights.v1" ||
      metrics.grain !== "visible_operational_tasks" ||
      metrics.days !== 30 || metrics.flow?.created < 1) {
    throw new Error("Real Bostan dashboard source analytics were not visible or scoped");
  }
  // The genuine UI request, not a mocked component, must load the current
  // company's privacy-scoped metric labels and a real created task.
  const created = page.getByText("Tasks created in period");
  await created.waitFor({ state: "visible", timeout: 30_000 });
  const group = page.getByRole("group", { name: "Task insights time window" });
  if (await group.getByRole("button", { name: "30 days" }).getAttribute("aria-pressed") !== "true") {
    throw new Error("Bostan dashboard did not open with the accurate 30-day window");
  }
  return { visibleAuthorizedTaskFlow: true, defaultPeriodDays: 30 };
}

export async function runPrivateBostanBrowserQa({
  origin, expectedCompanyId, env = process.env, ocrIssue = null,
  insightCompanyId = null, lazyIssue = null,
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
    let issueBundleRequests = 0;
    page.on("request", request => {
      if (/\/assets\/(?:IssueDetail|issue-detail)-[^/]+\.js(?:\?|$)/.test(request.url())) {
        issueBundleRequests += 1;
      }
    });
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
    // The root route can legitimately restore a remembered Inbox/Issues
    // page and proactively load IssueDetail. The perf regression must start
    // specifically on Dashboard, where the issue chunk is NOT needed.
    const nonTaskEntry = env.BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E === "1"
      ? "/" + lazyIssue.issuePrefix + "/dashboard"
      : "/";
    const response = await page.goto(privateOrigin + nonTaskEntry, {
      waitUntil: "domcontentloaded",
      timeout: 40_000,
    });
    if (!response || response.status() !== 200) {
      throw new Error("Bostan browser did not load the real private application document");
    }
    const servedHtmlPreloadsIssue = env.BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E === "1"
      ? /<link[^>]+(?:modulepreload)[^>]+(?:IssueDetail|issue-detail)-[^>]*>/i.test(await response.text())
      : false;
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
    let lazyIssueReport = null;
    if (env.BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E === "1") {
      if (!lazyIssue || typeof lazyIssue.id !== "string" ||
          !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(lazyIssue.id) ||
          typeof lazyIssue.issuePrefix !== "string" ||
          !/^[A-Z]{2,12}$/.test(lazyIssue.issuePrefix) ||
          typeof lazyIssue.title !== "string" ||
          !lazyIssue.title.startsWith("Bostan synthetic lazy issue chunk QA ")) {
        throw new Error("Private lazy bundle QA requires an exact synthetic task");
      }
      // The initial app route must be hydrated before observing that no
      // issue chunk was fetched; DOMContentLoaded alone is insufficient.
      await page.waitForTimeout(700);
      if (!page.url().endsWith("/" + lazyIssue.issuePrefix + "/dashboard")) {
        throw new Error("Bostan did not remain on the non-task Dashboard QA route");
      }
      if (issueBundleRequests !== 0) {
        throw new Error("Non-task app entry fetched IssueDetail before navigation: " +
          JSON.stringify({
            servedHtmlPreloadsIssue,
            dashboardRoute: page.url().endsWith("/" + lazyIssue.issuePrefix + "/dashboard"),
            initialIssueBundleRequestCount: issueBundleRequests,
          }));
      }
      const chunkRequest = page.waitForRequest(request =>
        /\/assets\/(?:IssueDetail|issue-detail)-[^/]+\.js(?:\?|$)/.test(request.url()),
        { timeout: 35_000 });
      await page.goto(privateOrigin + "/" + lazyIssue.issuePrefix +
        "/issues/" + lazyIssue.id, { waitUntil: "domcontentloaded", timeout: 40_000 });
      await chunkRequest;
      await page.waitForFunction(title => document.body.innerText.includes(title),
        lazyIssue.title, { timeout: 35_000 });
      if (issueBundleRequests !== 1) {
        throw new Error("IssueDetail route did not load exactly one lazy module chunk");
      }
      lazyIssueReport = { initialIssueChunkRequests: 0, issueRouteChunkRequests: 1 };
    }
    const onboarding = env.BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E === "1"
      ? (requireBostanBrowserOnboardingConsent(env),
        await runSyntheticPrivateOnboardingWizard(page, privateOrigin, env))
      : null;
    const ocr = env.BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E === "1"
      ? await runSyntheticPrivateOcrUi(page, privateOrigin, ocrIssue, env)
      : null;
    const insights = env.BOSTAN_LIVE_LOCAL_BROWSER_INSIGHTS_E2E === "1"
      ? await runPrivateBostanTaskInsightsUi(page, privateOrigin, insightCompanyId)
      : null;
    return { qualified: true, browser: "chromium-headless", mounted: true,
      privateApi: true, persistedCompany: true,
      ...(onboarding ? { onboarding } : {}),
      ...(ocr ? { ocr } : {}),
      ...(insights ? { insights } : {}),
      ...(lazyIssueReport ? { lazyIssue: lazyIssueReport } : {}),
      pageErrorsSeen: browserPageErrors, blockedExternalRequests };
  } finally {
    await browser.close();
  }
}
