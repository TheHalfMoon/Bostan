import { chromium } from "@playwright/test";

/**
 * This check creates a test organization. Never target a real user instance.
 * Caller must explicitly select a loopback instance backed by disposable data.
 */
const address = process.env.BOSTAN_E2E_URL;
if (!address || process.env.BOSTAN_E2E_CONFIRM_TEMP_DATA !== "1") {
  throw new Error("Set BOSTAN_E2E_URL and BOSTAN_E2E_CONFIRM_TEMP_DATA=1 for an isolated test instance");
}
const url = new URL(address);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)
  || (url.pathname !== "/" && url.pathname !== "") || url.username || url.password || url.search || url.hash) {
  throw new Error("Bostan browser acceptance only supports an uncredentialed localhost URL");
}
const executablePath = process.env.BOSTAN_PLAYWRIGHT_EXECUTABLE?.trim();
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.getByText("Step 1 of 4").waitFor({ timeout: 20_000 });
  const title = await page.title();
  if (!title.includes("Bostan") || /paperclip/i.test(title)) {
    throw new Error("Incorrect Bostan first-run document title: " + title);
  }
  await page.locator("input:visible").first().fill("Bostan QA Lab");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 2 of 4").waitFor({ timeout: 20_000 });
  const secondTitle = await page.title();
  if (!secondTitle.includes("Bostan QA Lab") || !secondTitle.endsWith("Bostan")
    || /paperclip/i.test(secondTitle)) {
    throw new Error("Incorrect Bostan document title after creating the test organization: " + secondTitle);
  }
  if (errors.length) throw new Error("Browser errors during first-run: " + errors.join("; "));
  console.log("Bostan browser acceptance PASS: first-run identity, organization creation and Step 2");
} finally {
  await browser.close();
}
