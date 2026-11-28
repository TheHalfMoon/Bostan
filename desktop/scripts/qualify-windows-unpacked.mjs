import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { observeInstalledAppStartup } from "./installed-app-phase.mjs";

if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Windows x64 only");
const desktop = path.resolve(import.meta.dirname, "..");
const repo = path.dirname(desktop);
const expectedCommit = process.env.BOSTAN_QA_SOURCE_COMMIT;
if (!/^[0-9a-f]{40}$/.test(expectedCommit ?? "")) throw new Error("BOSTAN_QA_SOURCE_COMMIT must identify the exact source commit");
const { stdout: actualCommit } = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" });
assert.equal(actualCommit.trim(), expectedCommit, "Packaged QA source commit does not match the requested commit");
const appDir = path.join(desktop, "dist-unpacked-qa", "win-unpacked");
const appExe = path.join(appDir, "Bostan.exe");
const archive = path.join(appDir, "resources", "app.asar");
const runtimeEntry = path.join(appDir, "resources", "runtime", "dist-runtime", "server.mjs");
for (const file of [appExe, archive, runtimeEntry]) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Unpacked QA payload has an unsafe or missing file");
}
const require = createRequire(path.join(repo, "package.json"));
const { _electron } = require("@playwright/test");
const asar = createRequire(path.join(desktop, "package.json"))("@electron/asar");
const asarFiles = asar.listPackage(archive);
assert.ok(asarFiles.includes("\\app\\main.cjs"), "ASAR does not contain the desktop entrypoint");
assert.ok(asarFiles.includes("\\app\\server-child.mjs"), "ASAR does not contain the server utility entrypoint");
assert.ok(asarFiles.includes("\\app\\startup-error.html"), "ASAR does not contain the non-blocking startup failure page");
const metadata = JSON.parse(asar.extractFile(archive, "package.json").toString("utf8"));
assert.equal(metadata.main, "app/main.cjs", "ASAR package entrypoint is incorrect");

const tempRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, "bostan-unpacked-gui-"));
const dataRoot = path.join(profile, "AppData");
const appData = path.join(dataRoot, "Roaming");
const localAppData = path.join(dataRoot, "Local");
const chromium = path.join(profile, "chromium");
const temp = path.join(profile, "Temp");
for (const dir of [appData, localAppData, chromium, temp]) fs.mkdirSync(dir, { recursive: true });
const env = {
  PATH: [path.dirname(process.execPath), path.dirname(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"), path.join(process.env.SystemRoot || "C:\\Windows", "System32")].join(path.delimiter),
  SystemRoot: process.env.SystemRoot || "C:\\Windows", WINDIR: process.env.WINDIR || process.env.SystemRoot || "C:\\Windows",
  SystemDrive: process.env.SystemDrive || "C:", ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
  PATHEXT: process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD",
  HOME: profile, USERPROFILE: profile, APPDATA: appData, LOCALAPPDATA: localAppData,
  TEMP: temp, TMP: temp, DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true",
};
const evidence = { sourceCommit: expectedCommit, platform: `${process.platform}-${process.arch}`, phases: [], privateHealth: null, navigation: null, gracefulShutdown: false, exitCode: null, tempProfileCleaned: false };
let application;
let disposeObserver = () => {};
let profileSafeToRemove = false;

function processesReferencing(directory) {
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const query = `$ErrorActionPreference='Stop'; $needle=${quote(directory)}; Get-CimInstance Win32_Process | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0) -or ($_.CommandLine -and $_.CommandLine.IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0) } | Select-Object -ExpandProperty ProcessId | ConvertTo-Json -Compress`;
  const encoded = Buffer.from(query, "utf16le").toString("base64");
  const result = spawnSync(path.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    encoding: "utf8", timeout: 15000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.status !== 0) throw new Error("unpacked_qa_process_cleanup_probe_failed");
  const value = JSON.parse(result.stdout.trim() || "[]");
  return (Array.isArray(value) ? value : [value]).map(Number);
}

function record(line) {
  evidence.phases.push(line);
  console.log(line);
}

try {
  console.log(`BOSTAN_UNPACKED_GUI_SOURCE ${expectedCommit}`);
  application = await _electron.launch({
    executablePath: appExe,
    args: [`--user-data-dir=${chromium}`],
    env,
    timeout: 180000,
  });
  disposeObserver = observeInstalledAppStartup(application, line => record(line));
  const page = await application.firstWindow({ timeout: 60000 });
  page.setDefaultTimeout(30000);
  let externalRequests = 0;
  page.on("request", request => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") externalRequests++;
  });
  await page.waitForURL(url => url.protocol === "http:" && url.hostname === "127.0.0.1", { timeout: 180000 });
  assert.ok(evidence.phases.includes("BOSTAN_DESKTOP_STARTUP_PHASE ready"), "The backend did not emit its ready phase");
  const health = await page.request.get(new URL("/api/health", page.url()).toString(), { timeout: 15000 });
  const healthBody = await health.json();
  evidence.privateHealth = {
    status: health.status(), statusField: healthBody?.status,
    deploymentMode: healthBody?.deploymentMode, deploymentExposure: healthBody?.deploymentExposure,
    bootstrapStatus: healthBody?.bootstrapStatus,
  };
  assert.equal(health.status(), 200);
  assert.equal(healthBody?.status, "ok");
  assert.equal(healthBody?.deploymentMode, "authenticated");
  assert.equal(healthBody?.deploymentExposure, "private");
  assert.equal(healthBody?.bootstrapStatus, "bootstrap_pending");
  await page.getByRole("heading", { name: "Finish setting up Bostan" }).waitFor();
  await page.getByRole("link", { name: "Sign in / Create account" }).click();
  await page.getByRole("button", { name: "Create one", exact: true }).waitFor();
  evidence.navigation = "first-run welcome to account creation page";
  assert.equal(externalRequests, 0, "Unpacked UI made an external network request");
  disposeObserver(); disposeObserver = () => {};
  const child = application.process();
  await application.close();
  if (child.exitCode === null) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("unpacked_app_graceful_shutdown_timeout")), 90000);
      child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }
  evidence.exitCode = child.exitCode;
  evidence.gracefulShutdown = child.exitCode === 0;
  assert.equal(evidence.gracefulShutdown, true, "Electron did not exit successfully after graceful close");
  application = null;
  profileSafeToRemove = true;
} catch (error) {
  evidence.failure = String(error?.message || "unclassified").split(/[\r\n]/, 1)[0].replace(/[^a-z0-9_ .:-]/gi, "_").slice(0, 160);
  throw error;
} finally {
  disposeObserver();
  if (application) {
    try {
      const child = application.process();
      if (child.exitCode === null) await application.close();
      if (child.exitCode !== null) { evidence.exitCode = child.exitCode; profileSafeToRemove = true; }
    } catch { profileSafeToRemove = false; }
  }
  if (profileSafeToRemove) {
    const resolved = fs.realpathSync(profile);
    if (!resolved.toLowerCase().startsWith(tempRoot.toLowerCase() + path.sep.toLowerCase())
        || path.basename(resolved).startsWith("bostan-unpacked-gui-") === false) {
      throw new Error("unpacked_qa_refused_cleanup_outside_owned_temp_profile");
    }
    if (processesReferencing(resolved).length) throw new Error("unpacked_qa_owned_process_remains");
    fs.rmSync(resolved, { recursive: true, force: false });
    evidence.tempProfileCleaned = !fs.existsSync(resolved);
  }
  const output = path.join(desktop, "dist-unpacked-qa", "qualification.json");
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log("BOSTAN_UNPACKED_GUI_EVIDENCE " + JSON.stringify(evidence));
}
