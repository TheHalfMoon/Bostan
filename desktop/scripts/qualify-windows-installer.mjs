import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { qualifyInstalledApp } from "./installed-app-journey.mjs";
import { installedAppPhase, observeInstalledAppStartup, createStartupFailureSignal } from "./installed-app-phase.mjs";
import { installerTreeSnapshot } from "./installer-tree-snapshot.mjs";
import { verifyCandidateInstall } from "./artifact-checksums.mjs";
import { nsisRegistrationIdentity, assertInstalledRegistration } from "./windows-registration-identity.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { once } from "node:events";
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
// GitHub's workflow shell is PowerShell 7. Keep the pinned Windows PowerShell
// 5.1 scanner on its own inbox module paths when invoking it from that parent.
const windowsPowerShellModulePath = [
  path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules"),
  path.join(process.env.ProgramFiles || "C:\\Program Files", "WindowsPowerShell", "Modules"),
].join(path.delimiter);
const registrationIdentity = nsisRegistrationIdentity(JSON.parse(fs.readFileSync(path.join(repo, "desktop/package.json"), "utf8")));
process.on("uncaughtExceptionMonitor", () => {
  // The worker wrapper keeps raw stderr private. Emit only a fixed receipt so
  // an assertion or unexpected dependency failure still has a visible outcome.
  try { console.log("BOSTAN_WINDOWS_INSTALLER_FAILURE qualification_failed"); } catch { /* Preserve the original failure. */ }
});
function uninstallRegistrations() {
  try {
    const raw = execFileSync(scanner, ["-NoProfile", "-NonInteractive", "-File", path.join(import.meta.dirname, "read-windows-registration.ps1")], {
      env: { ...process.env, BOSTAN_QA_UNINSTALL_KEY: registrationIdentity.key,
        BOSTAN_QA_PRODUCT_NAME: registrationIdentity.productName, BOSTAN_QA_DISPLAY_NAME: registrationIdentity.displayName },
      encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 8192, stdio: ["ignore", "pipe", "pipe"],
    });
    const records = JSON.parse(raw);
    assert.ok(Array.isArray(records));
    return records;
  } catch { throw new Error("Unable to inspect Windows installer registration"); }
}
assert.equal(uninstallRegistrations().length, 0, "Never overwrite an existing Bostan installation");
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
    return values.every(value => ["pre_init", "multiuser_ready", "extraction_direct_complete", "install_complete"].includes(value)) ? values : ["unavailable"];
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
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE install_failed");
    // Fixed, bounded facts distinguish extraction progress from a pre-install hang.
    // Never walk links, print paths, or replace the original installer failure.
    const snapshot = { installerFailed: true, installedExecutable: false, installDirectoryPresent: false,
      phases: [], entries: 0, scanCapped: false, scanFailed: false,
      temporary: { entries: 0, regularBytes: 0, capped: false, failed: true } };
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
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE receipt_check_begin");
  const completedInstallerPhases = installerPhases();
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE receipt_check_complete");
  console.log("BOSTAN_WINDOWS_NSIS_PHASES " + JSON.stringify(completedInstallerPhases));
  assert.equal(completedInstallerPhases.filter(value => value === "extraction_direct_complete").length, 1,
    "Installed qualification did not run the hash-verified direct Windows extractor");
  const executable = path.join(install, "Bostan.exe");
  assert.equal(fs.existsSync(executable), true, "Installer did not create the application executable");
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE registration_check_begin");
  assertInstalledRegistration(uninstallRegistrations(), registrationIdentity, install);
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE registration_check_complete");
  // Prove these are unsigned qualification artifacts, never OS-trusted releases.
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE signature_check_begin");
  let signature;
  try {
    signature = execFileSync(scanner, ["-NoProfile", "-NonInteractive", "-Command", "(Get-AuthenticodeSignature -LiteralPath $env:BOSTAN_QA_EXECUTABLE).Status.ToString()"], {
      env: { ...process.env, PSModulePath: windowsPowerShellModulePath, BOSTAN_QA_EXECUTABLE: executable },
      encoding: "utf8", windowsHide: true, timeout: 180000,
    }).trim();
    if (signature !== "NotSigned") throw new Error("signature_status_invalid");
  } catch {
    console.log("BOSTAN_WINDOWS_INSTALLER_FAILURE signature_check_failed");
    throw new Error("Windows Authenticode qualification failed");
  }
  console.log("BOSTAN_WINDOWS_INSTALLER_PHASE signature_check_complete");

  if (process.env.BOSTAN_E2E_ENABLE_LOCAL_AGENT_QA === "1") {
    assert.equal(process.env.BOSTAN_E2E_MODEL_MODE, "local-ollama", "Installed native QA must use the authorized local model");
    assert.equal(process.env.BOSTAN_E2E_ALLOW_LOCAL_MODEL, "1", "Installed native QA requires explicit local model opt-in");
    assert.notEqual(process.env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL, "1", "Installed native QA cannot enable remote inference");
    const nativeOpenCode = path.join(install, "resources", "runtime", "node_modules", ".pnpm",
      "opencode-windows-x64-baseline@1.18.34", "node_modules", "opencode-windows-x64-baseline", "bin", "opencode.exe");
    assert.equal(fs.lstatSync(nativeOpenCode, { throwIfNoEntry: false })?.isFile(), true,
      "Installed application is missing its pinned native OpenCode executable");
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE native_agent_begin");
    const nativeQa = spawnSync(process.execPath, [path.join(repo, "scripts", "bostan-windows-packaged-free-first-agent-qa.mjs")], {
      cwd: repo,
      env: { ...process.env, BOSTAN_E2E_APP_EXE: executable, BOSTAN_E2E_OPENCODE_EXE: nativeOpenCode },
      windowsHide: true,
      stdio: "inherit",
    });
    if (nativeQa.error || nativeQa.status !== 0) throw new Error("installed_native_agent_qualification_failed");
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE native_agent_complete");
  }

  async function launch() {
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE electron_launch_begin");
    application = await _electron.launch({ executablePath: executable, env, timeout: 180000 });
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE electron_connected");
    const startupFailure = createStartupFailureSignal();
    stopStartupObserver = observeInstalledAppStartup(application, line => {
      console.log(line);
      startupFailure.accept(line);
    });
    forcedStop = false;
    const actual = await appPhase("data_path", () => application.evaluate(({ app }) => app.getPath("userData")));
    assert.equal(path.resolve(actual).toLowerCase(), path.resolve(appData).toLowerCase());
    fs.writeFileSync(path.join(appData, ".bostan-installer-qa-owned"), "disposable-ci", { flag: ownedData ? "w" : "wx" });
    ownedData = true;
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE data_path_verified");
    const page = await appPhase("first_window", () => application.firstWindow({ timeout: 180000 }));
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE first_window");
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(180000);
    const ready = await Promise.race([
      page.waitForURL(url => url.protocol === "http:" && url.hostname === "127.0.0.1", { timeout: 180000 })
        .then(() => true),
      startupFailure.promise.then(code => code),
    ]);
    if (ready !== true) {
      // The error dialog is a deliberate user-facing recovery path. On this
      // disposable CI profile it blocks unattended cleanup, so stop only the
      // Electron process owned by this qualification and fail the gate.
      console.log("BOSTAN_WINDOWS_INSTALLER_PHASE forced_stop_failure");
      forcedStop = true;
      stopStartupObserver();
      const ownedProcess = application.process();
      if (ownedProcess.exitCode === null && ownedProcess.signalCode === null) {
        await appPhase("failed_startup_exit", () => {
          const exited = once(ownedProcess, "exit");
          ownedProcess.kill("SIGKILL");
          return exited;
        }, 15000);
      }
      throw new Error(`Installed startup failed (${ready})`);
    }
    stopStartupObserver();
    console.log("BOSTAN_WINDOWS_INSTALLER_PHASE backend_page_ready");
    return page;
  }
  await qualifyInstalledApp({
    launch,
    close: closeApplication,
    afterClose: noPostgres,
    executable,
    workspace: path.join(temp, "task-workspace"),
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
  assert.equal(uninstallRegistrations().length, 0, "Uninstaller registration remains");
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved", "Uninstall deleted application data");
  clean = true;
  console.log("BOSTAN_INSTALLED_WINDOWS_ONBOARDING_RESTART_UNINSTALL_PASS (deterministic process/artifact/control/restart qualification; no real model execution)");
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
