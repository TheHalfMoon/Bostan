import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolvePrivateWindowsPowerShellBinary } from "../../scripts/bostan-private-windows-powershell-binary.mjs";
import { evaluateWindowsPgOrphanCheck } from "../../scripts/bostan-private-windows-pg-orphan-proof.mjs";

// This installation changes the disposable runner's per-user app registration.
// Refuse operator PCs and any pre-existing Bostan state rather than reusing it.
if (process.platform !== "win32" || process.env.CI !== "true" || process.env.BOSTAN_DESKTOP_INSTALLER_QA !== "1") {
  throw new Error("Installer qualification requires an explicitly selected disposable Windows CI runner");
}
const repo = path.resolve(import.meta.dirname, "../..");
const { _electron } = createRequire(path.join(repo, "package.json"))("@playwright/test");
const out = path.join(repo, "desktop/dist");
const installers = fs.readdirSync(out).filter(name => name.endsWith(".exe"));
assert.equal(installers.length, 1, "Expected exactly one prepared Windows installer");
const appData = path.join(process.env.APPDATA, "Bostan");
assert.equal(fs.existsSync(appData), false, "Never qualify against pre-existing Bostan data");
const scanner = resolvePrivateWindowsPowerShellBinary();
function noPostgres() {
  const scan = spawnSync(scanner, ["-NoProfile", "-NonInteractive", "-File", path.join(repo, "scripts/bostan-native-windows-postgres-no-orphans.ps1"), "-Run"], {
    encoding: "utf8", timeout: 15000, windowsHide: true, maxBuffer: 8192,
  });
  assert.equal(evaluateWindowsPgOrphanCheck({ status: scan.status, signal: scan.signal, errorCode: scan.error?.code, stdout: scan.stdout, stderr: scan.stderr }).noOrphanPostgresProcessVerified, true);
}
noPostgres();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-installed-qa-"));
const install = path.join(temp, "application");
let application;
let ownedData = false;
let clean = false;
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(?:ELECTRON_RUN_AS_NODE|NODE_OPTIONS|DATABASE_|PAPERCLIP_|BOSTAN_|OPENAI_|ANTHROPIC_|OPENROUTER_|GEMINI_|GOOGLE_|SENTRY_|OTEL_)/i.test(key)) delete env[key];
try {
  execFileSync(path.join(out, installers[0]), ["/S", "/D=" + install], { windowsHide: true, timeout: 120000, stdio: "pipe" });
  const executable = path.join(install, "Bostan.exe");
  assert.equal(fs.existsSync(executable), true, "Installer did not create the application executable");
  // Prove these are unsigned qualification artifacts, never OS-trusted releases.
  const signature = execFileSync(scanner, ["-NoProfile", "-NonInteractive", "-Command", "(Get-AuthenticodeSignature -LiteralPath $env:BOSTAN_QA_EXECUTABLE).Status.ToString()"], {
    env: { ...process.env, BOSTAN_QA_EXECUTABLE: executable }, encoding: "utf8", windowsHide: true,
  }).trim();
  assert.equal(signature, "NotSigned");

  async function launch() {
    application = await _electron.launch({ executablePath: executable, env, timeout: 180000 });
    const actual = await application.evaluate(({ app }) => app.getPath("userData"));
    assert.equal(path.resolve(actual).toLowerCase(), path.resolve(appData).toLowerCase());
    fs.writeFileSync(path.join(appData, ".bostan-installer-qa-owned"), "disposable-ci", { flag: ownedData ? "w" : "wx" });
    ownedData = true;
    const page = await application.firstWindow();
    await page.waitForURL(url => url.protocol === "http:" && url.hostname === "127.0.0.1", { timeout: 180000 });
    return page;
  }
  const page = await launch();
  let jsErrors = 0;
  let externalRequests = 0;
  page.on("pageerror", () => jsErrors++);
  page.on("request", request => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") externalRequests++;
  });
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
  const companies = await (await page.request.get(base + "/api/companies")).json();
  const company = companies.find(item => item.name === "Bostan Desktop QA");
  assert.ok(company?.id);
  const agents = await (await page.request.get(`${base}/api/companies/${company.id}/agents`)).json();
  const agent = agents.find(item => item.name === "Desktop QA Worker");
  assert.equal(agent?.pauseReason, "setup");
  assert.equal(agent?.lifecycleState, "paused");
  assert.equal(jsErrors, 0); assert.equal(externalRequests, 0);
  await application.close(); application = null;
  noPostgres();

  const reopened = await launch();
  await reopened.getByText("Bostan Desktop QA", { exact: true }).first().waitFor();
  const reopenedBase = new URL(reopened.url()).origin;
  const persisted = await reopened.request.get(`${reopenedBase}/api/companies/${company.id}/agents`);
  assert.equal(persisted.status(), 200, "Session did not survive application restart");
  assert.equal((await persisted.json()).filter(item => item.id === agent.id).length, 1);
  await application.close(); application = null;
  noPostgres();
  const sentinel = path.join(appData, "data/installer-data-preservation-qa");
  fs.writeFileSync(sentinel, "preserved");
  const uninstaller = fs.readdirSync(install).find(name => /^Uninstall.*\.exe$/i.test(name));
  assert.ok(uninstaller);
  execFileSync(path.join(install, uninstaller), ["/S"], { windowsHide: true, timeout: 120000, stdio: "pipe" });
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved", "Uninstall deleted application data");
  clean = true;
  console.log("BOSTAN_INSTALLED_WINDOWS_ONBOARDING_RESTART_UNINSTALL_PASS (synthetic account and deferred agent; no real model execution)");
} finally {
  if (application) await application.close();
  noPostgres();
  if (clean && ownedData && !fs.lstatSync(appData).isSymbolicLink()
      && fs.readFileSync(path.join(appData, ".bostan-installer-qa-owned"), "utf8") === "disposable-ci") {
    fs.rmSync(appData, { recursive: true, force: true });
    assert.equal(path.dirname(temp), fs.realpathSync(os.tmpdir()));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
