import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { qualifyInstalledApp } from "./installed-app-journey.mjs";
import { installedAppPhase, observeInstalledAppStartup } from "./installed-app-phase.mjs";

// Mount/copy/remove only on a disposable hosted runner, never an operator Mac.
if (process.platform !== "darwin" || process.env.CI !== "true"
    || process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
    || process.env.BOSTAN_DESKTOP_INSTALLER_QA !== "1") {
  throw new Error("Installer qualification requires an explicitly selected disposable macOS CI runner");
}
const repo = path.resolve(import.meta.dirname, "../..");
const { _electron } = createRequire(path.join(repo, "package.json"))("@playwright/test");
const out = path.join(repo, "desktop/dist");
const images = fs.readdirSync(out).filter(name => name.endsWith(".dmg"));
assert.equal(images.length, 1, "Expected exactly one prepared macOS disk image");
const image = path.join(out, images[0]);
const checksums = fs.readFileSync(path.join(out, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
const checksum = checksums.filter(line => line.endsWith("  " + images[0]));
assert.equal(checksum.length, 1, "Disk image checksum is missing or ambiguous");
const digest = createHash("sha256");
for await (const chunk of fs.createReadStream(image)) digest.update(chunk);
assert.equal(checksum[0], `${digest.digest("hex")}  ${images[0]}`, "Disk image bytes do not match the prepared checksum");

const appData = path.join(os.homedir(), "Library/Application Support/Bostan");
const applications = path.join(os.homedir(), "Applications");
const installedApp = path.join(applications, "Bostan.app");
assert.equal(fs.lstatSync(appData, { throwIfNoEntry: false }), undefined, "Never qualify against pre-existing Bostan data");
assert.equal(fs.lstatSync(installedApp, { throwIfNoEntry: false }), undefined, "Never overwrite an existing per-user Bostan installation");
assert.equal(fs.lstatSync("/Applications/Bostan.app", { throwIfNoEntry: false }), undefined, "Never reuse an existing system Bostan installation");
fs.mkdirSync(applications, { recursive: true });
assert.equal(fs.realpathSync(applications), applications, "Application parent must be canonical");
function noPostgres() {
  const commands = execFileSync("/bin/ps", ["-axo", "comm="], { encoding: "utf8", timeout: 15000 });
  assert.equal(commands.split(/\r?\n/).filter(value => /^(?:postgres|postmaster)$/.test(path.basename(value.trim()))).length,
    0, "PostgreSQL remains running after desktop shutdown");
}
noPostgres();
const tempParent = fs.realpathSync(os.tmpdir());
const temp = fs.mkdtempSync(path.join(tempParent, "bostan-installed-qa-"));
fs.chmodSync(temp, 0o700);
const tempIdentity = fs.lstatSync(temp);
const mount = path.join(temp, "image"); fs.mkdirSync(mount);
let mounted = false;
let application;
let stopStartupObserver = () => {};
let forcedStop = false;
let installedIdentity;
let dataIdentity;
let clean = false;
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(?:ELECTRON_RUN_AS_NODE|NODE_OPTIONS|DATABASE_|PAPERCLIP_|BOSTAN_|OPENAI_|ANTHROPIC_|OPENROUTER_|GEMINI_|GOOGLE_|SENTRY_|OTEL_)/i.test(key)) delete env[key];
const startedAt = Date.now();
function phase(name) {
  console.log("BOSTAN_MACOS_INSTALLER_PHASE " + JSON.stringify({ phase: name, elapsedMs: Date.now() - startedAt }));
}
function appPhase(name, work, timeoutMs = 180000) {
  return installedAppPhase(application, name, work, { timeoutMs, onForcedStop: () => { forcedStop = true; phase("forced_stop_failure"); } });
}
async function closeApplication() {
  stopStartupObserver();
  if (!application || forcedStop) return;
  phase("close_begin");
  await appPhase("close", () => application.close(), 90000);
  application = null;
  phase("close_complete");
}
function assertOwnedDirectory(directory, parent, identity) {
  const actual = fs.lstatSync(directory);
  assert.ok(identity && actual.isDirectory() && !actual.isSymbolicLink());
  assert.equal(path.dirname(directory), parent);
  assert.equal(fs.realpathSync(directory), directory);
  assert.equal(actual.dev, identity.dev); assert.equal(actual.ino, identity.ino);
}
try {
  phase("mount_begin");
  execFileSync("/usr/bin/hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mount, image], { stdio: "pipe", timeout: 60000 });
  mounted = true;
  phase("mount_complete");
  const source = path.join(mount, "Bostan.app");
  assert.ok(fs.lstatSync(source).isDirectory() && !fs.lstatSync(source).isSymbolicLink());
  phase("install_begin");
  execFileSync("/usr/bin/ditto", [source, installedApp], { stdio: "pipe", timeout: 120000 });
  phase("install_complete");
  installedIdentity = fs.lstatSync(installedApp);
  execFileSync("/usr/bin/hdiutil", ["detach", mount], { stdio: "pipe", timeout: 60000 });
  mounted = false;
  const executable = path.join(installedApp, "Contents/MacOS/Bostan");
  assert.ok(fs.statSync(executable).isFile(), "Disk image did not install an application executable");
  async function launch() {
    assertOwnedDirectory(installedApp, applications, installedIdentity);
    phase("launch_begin");
    application = await _electron.launch({ executablePath: executable, env, timeout: 180000 });
    stopStartupObserver = observeInstalledAppStartup(application, line => console.log(line));
    forcedStop = false;
    phase("electron_connected");
    const actual = await appPhase("data_path", () => application.evaluate(({ app }) => app.getPath("userData")));
    assert.equal(path.resolve(actual), appData);
    phase("data_path_verified");
    if (!dataIdentity) {
      assert.equal(fs.realpathSync(appData), appData);
      fs.writeFileSync(path.join(appData, ".bostan-installer-qa-owned"), "disposable-ci", { flag: "wx", mode: 0o600 });
      dataIdentity = fs.lstatSync(appData);
    } else {
      assertOwnedDirectory(appData, path.dirname(appData), dataIdentity);
      assert.equal(fs.readFileSync(path.join(appData, ".bostan-installer-qa-owned"), "utf8"), "disposable-ci");
    }
    const page = await appPhase("first_window", () => application.firstWindow({ timeout: 180000 }));
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(180000);
    phase("first_window");
    await page.waitForURL(url => url.protocol === "http:" && url.hostname === "127.0.0.1", { timeout: 180000 });
    phase("backend_page_ready");
    stopStartupObserver();
    return page;
  }
  await qualifyInstalledApp({
    launch,
    close: closeApplication,
    afterClose: noPostgres,
  });
  phase("onboarding_restart_complete");
  const sentinel = path.join(appData, "data/installer-data-preservation-qa");
  fs.writeFileSync(sentinel, "preserved", { flag: "wx", mode: 0o600 });
  assertOwnedDirectory(installedApp, applications, installedIdentity);
  fs.rmSync(installedApp, { recursive: true, force: false });
  assert.equal(fs.existsSync(installedApp), false, "Uninstall did not remove the application bundle");
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved", "Uninstall deleted application data");
  noPostgres();
  clean = true;
} finally {
  try {
    if (application && !forcedStop) { phase("failure_close_begin"); await closeApplication(); phase("failure_close_complete"); }
  } finally {
    try {
      if (mounted) execFileSync("/usr/bin/hdiutil", ["detach", mount], { stdio: "pipe", timeout: 60000 });
    } finally { noPostgres(); }
  }
  if (clean) {
    assertOwnedDirectory(appData, path.dirname(appData), dataIdentity);
    assert.equal(fs.readFileSync(path.join(appData, ".bostan-installer-qa-owned"), "utf8"), "disposable-ci");
    fs.rmSync(appData, { recursive: true, force: false });
    assertOwnedDirectory(temp, tempParent, tempIdentity);
    fs.rmSync(temp, { recursive: true, force: false });
  }
}
console.log(`BOSTAN_INSTALLED_MACOS_ONBOARDING_RESTART_UNINSTALL_PASS (${process.arch}; unsigned qualification candidate; deferred agent, no real model execution)`);
