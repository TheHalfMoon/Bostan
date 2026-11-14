import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { qualifyInstalledApp } from "./installed-app-journey.mjs";
import { installedAppPhase, observeInstalledAppStartup } from "./installed-app-phase.mjs";
import { installerTreeSnapshot } from "./installer-tree-snapshot.mjs";
import { verifyCandidateInstall } from "./artifact-checksums.mjs";
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
await verifyCandidateInstall(out, installers[0]);
const appData = path.join(process.env.APPDATA, "Bostan");
assert.equal(fs.lstatSync(appData, { throwIfNoEntry: false }), undefined, "Never qualify against pre-existing Bostan data");
const scanner = resolvePrivateWindowsPowerShellBinary();
function uninstallRegistrations() {
  return Number(execFileSync(scanner, ["-NoProfile", "-NonInteractive", "-Command", "@(Get-ChildItem -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object DisplayName -eq 'Bostan').Count"], {
    encoding: "utf8", windowsHide: true, timeout: 15000,
  }).trim());
}
assert.equal(uninstallRegistrations(), 0, "Never overwrite an existing Bostan installation");
function noPostgres() {
  const scan = spawnSync(scanner, ["-NoProfile", "-NonInteractive", "-File", path.join(repo, "scripts/bostan-native-windows-postgres-no-orphans.ps1"), "-Run"], {
    encoding: "utf8", timeout: 15000, windowsHide: true, maxBuffer: 8192,
  });
  assert.equal(evaluateWindowsPgOrphanCheck({ status: scan.status, signal: scan.signal, errorCode: scan.error?.code, stdout: scan.stdout, stderr: scan.stderr }).noOrphanPostgresProcessVerified, true);
}
noPostgres();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-installed-qa-"));
const install = path.join(temp, "application");
const installerTemp = path.join(temp, "installer-temp");
fs.mkdirSync(installerTemp);
const installerPhaseLog = path.join(temp, "installer-phases.log");
fs.writeFileSync(installerPhaseLog, "", { flag: "wx", mode: 0o600 });
function installerPhases() {
  const stat = fs.lstatSync(installerPhaseLog);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2048) return ["unavailable"];
  const descriptor = fs.openSync(installerPhaseLog, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    if (!fs.fstatSync(descriptor).isFile()) return ["unavailable"];
    const bytes = Buffer.alloc(2049);
    const count = fs.readSync(descriptor, bytes, 0, bytes.length, 0);
    if (count > 2048) return ["unavailable"];
    const values = bytes.subarray(0, count).toString("utf8").split(/\r?\n/).filter(Boolean);
    return values.every(value => ["pre_init", "multiuser_ready", "install_complete"].includes(value)) ? values : ["unavailable"];
  } finally { fs.closeSync(descriptor); }
}
let application;
let stopStartupObserver = () => {};
let forcedStop = false;
let ownedData = false;
let clean = false;
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(?:ELECTRON_RUN_AS_NODE|NODE_OPTIONS|DATABASE_|PAPERCLIP_|BOSTAN_|OPENAI_|ANTHROPIC_|OPENROUTER_|GEMINI_|GOOGLE_|SENTRY_|OTEL_)/i.test(key)) delete env[key];
function appPhase(name, work, timeoutMs = 180000) {
  return installedAppPhase(application, name, work, { timeoutMs, onForcedStop: () => { forcedStop = true; console.log("BOSTAN_WINDOWS_INSTALLER_PHASE forced_stop_failure"); } });
}
async function closeApplication() {
  stopStartupObserver();
  if (!application || forcedStop) return;
  await appPhase("close", () => application.close(), 90000);
  application = null;
}
try {
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE install_begin");
  const installationStarted = Date.now();
  let installationElapsedMs;
  try {
    execFileSync(path.join(out, installers[0]), ["/S", "/D=" + install], {
      // Verified archive-only extraction needs130.5s for the full2.16GB payload.
      // Keep a bounded functional install budget; record latency separately.
      windowsHide: true, timeout: 300000, stdio: "pipe",
      env: { ...process.env, TEMP: installerTemp, TMP: installerTemp, BOSTAN_INSTALLER_QA_LOG: installerPhaseLog },
    });
    installationElapsedMs = Date.now() - installationStarted;
  } catch (error) {
    installationElapsedMs = Date.now() - installationStarted;
    // Fixed, bounded facts distinguish extraction progress from a pre-install hang.
    // Never walk links, print paths, or replace the original installer failure.
    const snapshot = { installerFailed: true, installedExecutable: false, installDirectoryPresent: false,
      phases: [], entries: 0, scanCapped: false, scanFailed: false, temporary: null };
    try {
      snapshot.phases = installerPhases();
      snapshot.installDirectoryPresent = fs.lstatSync(install, { throwIfNoEntry: false })?.isDirectory() === true;
      snapshot.installedExecutable = fs.lstatSync(path.join(install, "Bostan.exe"), { throwIfNoEntry: false })?.isFile() === true;
      const target = installerTreeSnapshot(install);
      snapshot.entries = target.entries;
      snapshot.scanCapped = target.capped;
      snapshot.scanFailed = target.failed;
      snapshot.temporary = installerTreeSnapshot(installerTemp);
    } catch { snapshot.scanFailed = true; }
    console.log("BOSTAN_WINDOWS_INSTALLER_FAILURE " + JSON.stringify(snapshot));
    throw error;
  } finally {
    console.log("BOSTAN_WINDOWS_INSTALLER_TIMING " + JSON.stringify({ elapsedMs: installationElapsedMs, budgetMs: 300000 }));
  }
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE install_complete");
  console.log("BOSTAN_WINDOWS_NSIS_PHASES " + JSON.stringify(installerPhases()));
  const executable = path.join(install, "Bostan.exe");
  assert.equal(fs.existsSync(executable), true, "Installer did not create the application executable");
  assert.equal(uninstallRegistrations(), 1, "Installer registration is missing or ambiguous");
  // Prove these are unsigned qualification artifacts, never OS-trusted releases.
  const signature = execFileSync(scanner, ["-NoProfile", "-NonInteractive", "-Command", "(Get-AuthenticodeSignature -LiteralPath $env:BOSTAN_QA_EXECUTABLE).Status.ToString()"], {
    env: { ...process.env, BOSTAN_QA_EXECUTABLE: executable }, encoding: "utf8", windowsHide: true,
  }).trim();
  assert.equal(signature, "NotSigned");

  async function launch() {
    application = await _electron.launch({ executablePath: executable, env, timeout: 180000 });
    stopStartupObserver = observeInstalledAppStartup(application, line => console.log(line));
    forcedStop = false;
    const actual = await appPhase("data_path", () => application.evaluate(({ app }) => app.getPath("userData")));
    assert.equal(path.resolve(actual).toLowerCase(), path.resolve(appData).toLowerCase());
    fs.writeFileSync(path.join(appData, ".bostan-installer-qa-owned"), "disposable-ci", { flag: ownedData ? "w" : "wx" });
    ownedData = true;
    const page = await appPhase("first_window", () => application.firstWindow({ timeout: 180000 }));
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(180000);
    await page.waitForURL(url => url.protocol === "http:" && url.hostname === "127.0.0.1", { timeout: 180000 });
    stopStartupObserver();
    return page;
  }
  await qualifyInstalledApp({
    launch,
    close: closeApplication,
    afterClose: noPostgres,
  });
  const sentinel = path.join(appData, "data/installer-data-preservation-qa");
  fs.writeFileSync(sentinel, "preserved");
  const uninstaller = fs.readdirSync(install).find(name => /^Uninstall.*\.exe$/i.test(name));
  assert.ok(uninstaller);
  // NSIS normally relaunches from TEMP and lets its original process exit early.
  // Run an external copy with _?= (as electron-builder itself does) so waiting
  // for this process means the actual uninstall completed.
  const uninstallCopy = path.join(temp, "bostan-uninstall-qa.exe");
  fs.copyFileSync(path.join(install, uninstaller), uninstallCopy);
  execFileSync(uninstallCopy, ["/S", "_?=" + install], { windowsHide: true, timeout: 120000, stdio: "pipe" });
  assert.equal(fs.existsSync(executable), false, "Uninstaller did not remove the installed application");
  assert.equal(uninstallRegistrations(), 0, "Uninstaller registration remains");
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved", "Uninstall deleted application data");
  clean = true;
  console.log("BOSTAN_INSTALLED_WINDOWS_ONBOARDING_RESTART_UNINSTALL_PASS (synthetic account and deferred agent; no real model execution)");
} finally {
  try { if (application && !forcedStop) await closeApplication(); }
  finally { noPostgres(); }
  if (clean && ownedData && !fs.lstatSync(appData).isSymbolicLink()
      && fs.readFileSync(path.join(appData, ".bostan-installer-qa-owned"), "utf8") === "disposable-ci") {
    fs.rmSync(appData, { recursive: true, force: true });
    assert.equal(path.dirname(temp), fs.realpathSync(os.tmpdir()));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
