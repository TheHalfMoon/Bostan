import { chromium } from "@playwright/test";

/**
 * Creates a real company and paused setup agent. Use ONLY disposable localhost
 * databases. This is intentionally not an app-wide test runner.
 */
const input = process.env.BOSTAN_E2E_URL;
if (!input || process.env.BOSTAN_E2E_CONFIRM_TEMP_DATA !== "1") {
  throw new Error("Require BOSTAN_E2E_URL and BOSTAN_E2E_CONFIRM_TEMP_DATA=1");
}
const base = new URL(input);
if (base.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(base.hostname)
  || !["/", ""].includes(base.pathname) || base.search || base.hash || base.username || base.password) {
  throw new Error("Only an uncredentialed localhost root URL can be tested");
}
const executablePath = process.env.BOSTAN_PLAYWRIGHT_EXECUTABLE?.trim();
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => { throw error; });
  await page.goto(base.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByText("Step 1 of 4").waitFor({ timeout: 30_000 });
  const companyName = "Bostan Deferred QA";
  await page.locator("input:visible").first().fill(companyName);
  const companyRequest = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/api/companies",
    { timeout: 30_000 });
  await page.getByRole("button", { name: "Continue" }).click();
  const companyResponse = await companyRequest;
  if (!companyResponse.ok()) throw new Error("Could not create isolated QA organization: HTTP " + companyResponse.status());
  const company = await companyResponse.json();
  const companyId = company?.id;
  if (typeof companyId !== "string" || !companyId) throw new Error("Company identifier missing after creation");
  await page.getByText("Step 2 of 4").waitFor({ timeout: 30_000 });
  const name = page.locator("#onboarding-agent-name");
  await name.waitFor({ state: "visible", timeout: 30_000 });
  // Step transitions animate the input and can replace it shortly after the
  // Step 2 header appears. Wait for that transition before entering the name.
  await page.waitForTimeout(700);
  await name.fill("Bostan Draft Worker");
  if (await name.inputValue() !== "Bostan Draft Worker") {
    throw new Error("Bostan agent name did not settle into the controlled field");
  }
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("Step 3 of 4").waitFor({ timeout: 30_000 });
  const defer = page.getByRole("button", { name: "Set up AI later" });
  await defer.waitFor({ timeout: 30_000 });
  await defer.isEnabled({ timeout: 30_000 });
  // The previous assertion only observes the button; auto-creation is async.
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Set up AI later"));
    return button && !button.disabled;
  }, undefined, { timeout: 30_000 });
  await defer.click();
  await page.waitForURL((url) => url.pathname.endsWith("/agents"), { timeout: 30_000 });
  const listResponse = await page.request.get(new URL("/api/companies/" + companyId + "/agents", base).href);
  if (!listResponse.ok()) throw new Error("Agent list request failed: HTTP " + listResponse.status());
  const agents = await listResponse.json();
  const draft = agents.find((agent) => agent.name === "Bostan Draft Worker");
  if (!draft || draft.companyId !== companyId || draft.pauseReason !== "setup"
    || draft.lifecycleState !== "paused") {
    throw new Error("Deferred agent is not a verifiable paused setup: " + JSON.stringify(draft ?? null));
  }
  // The prior implementation dropped the browser draft when leaving the
  // wizard. A user must be able to resume the *same* server-side agent.
  // Refresh to prove that resuming the exact draft is not dependent on the
  // mounted React component retaining its state in memory.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Finish AI setup" }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Finish AI setup" }).click();
  await page.getByText("Connect a model").waitFor({ timeout: 30_000 });
  const afterResume = await page.request.get(new URL("/api/companies/" + companyId + "/agents", base).href);
  if (!afterResume.ok()) throw new Error("Agent list failed after resuming");
  const matching = (await afterResume.json()).filter((agent) => agent.name === "Bostan Draft Worker");
  if (matching.length !== 1 || matching[0].id !== draft.id || matching[0].pauseReason !== "setup") {
    throw new Error("Resumed onboarding did not preserve the exact paused setup agent");
  }
  console.log("Bostan deferred onboarding browser PASS: paused agent persists; Finish AI setup resumes same agent without model keys");
} finally {
  await browser.close();
}
