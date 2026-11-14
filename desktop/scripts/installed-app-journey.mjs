import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

/** Drive the real installed app through the same UI on both native platforms.
 * Platform wrappers own installation, process checks and guarded cleanup. */
export async function qualifyInstalledApp({ launch, close, afterClose }) {
  let jsErrors = 0;
  let externalRequests = 0;
  function observe(page) {
    page.on("pageerror", () => jsErrors++);
    page.on("request", request => {
      const url = new URL(request.url());
      if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") externalRequests++;
    });
  }
  const page = await launch();
  observe(page);
  await page.getByRole("heading", { name: "Finish setting up Bostan" }).waitFor();
  await page.getByRole("link", { name: "Sign in / Create account" }).click();
  await page.getByRole("button", { name: "Create one", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Desktop QA");
  await page.getByLabel("Email", { exact: true }).fill(`desktop-${randomBytes(6).toString("hex")}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(randomBytes(24).toString("hex"));
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await page.getByRole("button", { name: "Claim this instance", exact: true }).click();
  await page.getByText("Step 1 of 4").waitFor();
  await page.locator("input:visible").first().fill("Bostan Desktop QA");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Step 2 of 4").waitFor();
  await page.locator("#onboarding-agent-name").fill("Desktop QA Worker");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Step 3 of 4").waitFor();
  await page.getByRole("button", { name: "Set up AI later", exact: true }).click();
  await page.waitForURL(url => url.pathname.endsWith("/agents"));
  const base = new URL(page.url()).origin;
  const companyResponse = await page.request.get(base + "/api/companies");
  assert.equal(companyResponse.status(), 200);
  const company = (await companyResponse.json()).find(item => item.name === "Bostan Desktop QA");
  assert.ok(company?.id);
  const agentResponse = await page.request.get(`${base}/api/companies/${company.id}/agents`);
  assert.equal(agentResponse.status(), 200);
  const agent = (await agentResponse.json()).find(item => item.name === "Desktop QA Worker");
  assert.equal(agent?.pauseReason, "setup");
  assert.equal(agent?.lifecycleState, "paused");
  assert.equal(jsErrors, 0); assert.equal(externalRequests, 0);
  await close();
  await afterClose();

  const reopened = await launch();
  observe(reopened);
  await reopened.getByText("Bostan Desktop QA", { exact: true }).first().waitFor();
  const reopenedBase = new URL(reopened.url()).origin;
  const persisted = await reopened.request.get(`${reopenedBase}/api/companies/${company.id}/agents`);
  assert.equal(persisted.status(), 200, "Session did not survive application restart");
  assert.equal((await persisted.json()).filter(item => item.id === agent.id).length, 1);
  assert.equal(jsErrors, 0); assert.equal(externalRequests, 0);
  await close();
  await afterClose();
}
