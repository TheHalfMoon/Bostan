import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { qualifyInstalledApp } from "./installed-app-journey.mjs";
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
let application;
let ownedData = false;
let clean = false;
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(?:ELECTRON_RUN_AS_NODE|NODE_OPTIONS|DATABASE_|PAPERCLIP_|BOSTAN_|OPENAI_|ANTHROPIC_|OPENROUTER_|GEMINI_|GOOGLE_|SENTRY_|OTEL_)/i.test(key)) delete env[key];
try {
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE install_begin");
  try {
    execFileSync(path.join(out, installers[0]), ["/S", "/D=" + install], { windowsHide: true, timeout: 120000, stdio: "pipe" });
  } catch (error) {
    // Fixed, bounded facts distinguish extraction progress from a pre-install hang.
    // Never walk links, print paths, or replace the original installer failure.
    const snapshot = { installerFailed: true, installedExecutable: false, entries: 0, scanCapped: false, scanFailed: false };
    try {
      snapshot.installedExecutable = fs.lstatSync(path.join(install, "Bostan.exe"), { throwIfNoEntry: false })?.isFile() === true;
      const pending = [install];
      while (pending.length && snapshot.entries < 4096) {
        const directory = pending.pop();
        const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
        if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
          if (snapshot.entries === 4096) { snapshot.scanCapped = true; break; }
          snapshot.entries++;
          if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(path.join(directory, entry.name));
        }
      }
      snapshot.scanCapped ||= pending.length > 0;
    } catch { snapshot.scanFailed = true; }
    console.log("BOSTAN_WINDOWS_INSTALLER_FAILURE " + JSON.stringify(snapshot));
    throw error;
  }
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE install_complete");
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
    const actual = await application.evaluate(({ app }) => app.getPath("userData"));
    assert.equal(path.resolve(actual).toLowerCase(), path.resolve(appData).toLowerCase());
    fs.writeFileSync(path.join(appData, ".bostan-installer-qa-owned"), "disposable-ci", { flag: ownedData ? "w" : "wx" });
    ownedData = true;
    const page = await application.firstWindow();
    await page.waitForURL(url => url.protocol === "http:" && url.hostname === "127.0.0.1", { timeout: 180000 });
    return page;
  }
  await qualifyInstalledApp({
    launch,
    close: async () => { await application.close(); application = null; },
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
  if (application) await application.close();
  noPostgres();
  if (clean && ownedData && !fs.lstatSync(appData).isSymbolicLink()
      && fs.readFileSync(path.join(appData, ".bostan-installer-qa-owned"), "utf8") === "disposable-ci") {
    fs.rmSync(appData, { recursive: true, force: true });
    assert.equal(path.dirname(temp), fs.realpathSync(os.tmpdir()));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
