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

export async function runPrivateBostanBrowserQa({ origin, expectedCompanyId, env = process.env }) {
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
    return { qualified: true, browser: "chromium-headless", mounted: true,
      privateApi: true, persistedCompany: true,
      pageErrorsSeen: browserPageErrors, blockedExternalRequests };
  } finally {
    await browser.close();
  }
}
