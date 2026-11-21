import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createPackagingStage } from "./packaging-stage.mjs";
import { prepareWindowsInstallerExtraction } from "./prepare-windows-installer-extraction.mjs";

const windowsTest = process.platform === "win32" ? test : test.skip;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForFile(file, timeoutMs = 10000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (fs.existsSync(file)) return;
    await wait(50);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

windowsTest("compiled NSIS selects and runs the hash-verified direct extraction override", { timeout: 120000 }, async t => {
  const desktop = path.resolve(import.meta.dirname, "..");
  const require = createRequire(path.join(desktop, "package.json"));
  require("electron-builder");
  const windows = require("app-builder-lib/out/toolsets/windows.js");
  const [seven, makensis, pluginRoot] = await Promise.all([
    require("app-builder-lib/out/toolsets/7zip.js").getPath7za(),
    windows.getMakeNsisPath(null, null),
    windows.getNsisPluginsPath(null, null),
  ]);
  const owned = createPackagingStage(os.tmpdir());
  fs.mkdirSync(owned.directory);
  t.after(() => owned.dispose());
  const root = path.dirname(owned.directory);
  const source = path.join(root, "source");
  const relative = "package.json";
  const bytes = Buffer.from('{"name":"bostan-installer-probe"}\n');
  const hash = require("node:crypto").createHash("sha256").update(bytes).digest("hex");
  fs.mkdirSync(path.join(source, "resources/runtime"), { recursive: true });
  fs.writeFileSync(path.join(source, "resources/runtime", relative), bytes);
  const payload = [{ path: relative, kind: "file", sha256: hash }];
  const support = await prepareWindowsInstallerExtraction({ desktop, payload });
  t.after(() => support.dispose());
  const archive = path.join(root, "app-64.7z");
  const created = spawnSync(seven, ["a", "-t7z", archive, "resources/runtime/package.json"], {
    cwd: source, windowsHide: true, encoding: "utf8", timeout: 30000, stdio: "pipe",
  });
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const definitions = {};
  const commands = {};
  support.effectiveOptionComputed([definitions, commands]);
  const overrideDirectory = commands["!addincludedir"][0].replace(/^"|"$/g, "");
  const sentinel = path.join(root, "late-include");
  fs.mkdirSync(sentinel);
  fs.writeFileSync(path.join(sentinel, "extractAppPackage.nsh"), '!error "NSIS used the late stock include instead of the Bostan override"\n');
  const destination = path.join(root, "installed app");
  const installer = path.join(root, "Bostan extraction probe.exe");
  const phaseLog = path.join(root, "phases.log");
  const script = [
    `!addplugindir /x86-unicode "${path.join(makensis.env.NSISDIR, "Plugins/x86-unicode")}"`,
    `!addplugindir /x86-unicode "${path.join(pluginRoot, "x86-unicode")}"`,
    `!include "${support.include}"`,
    `!addincludedir "${sentinel}"`,
    '!include "extractAppPackage.nsh"',
    'LangString appCannotBeClosed 1033 "Close Bostan before retrying extraction."',
    'RequestExecutionLevel user',
    `OutFile "${installer}"`,
    'SilentInstall silent',
    'Section',
    '  InitPluginsDir',
    `  SetOutPath "${destination}"`,
    `  !insertmacro extractUsing7za "${archive}"`,
    'SectionEnd',
  ].join("\r\n");
  const scriptPath = path.join(root, "fixture.nsi");
  fs.writeFileSync(scriptPath, script);
  const args = ["-V2", "-WX", "-INPUTCHARSET", "UTF8"];
  for (const [name, value] of Object.entries(definitions)) args.push(`-D${name}=${value}`);
  for (const [name, value] of Object.entries(commands)) {
    for (const entry of Array.isArray(value) ? value : [value]) args.push(`-X${name} ${entry}`);
  }
  args.push(scriptPath);
  const compiled = spawnSync(makensis.path, args, { cwd: root, env: { ...process.env, ...(makensis.env ?? {}) }, windowsHide: true, encoding: "utf8", timeout: 30000 });
  assert.equal(compiled.status, 0, JSON.stringify({ stdout: compiled.stdout, stderr: compiled.stderr }));
  assert.equal(fs.realpathSync(overrideDirectory), fs.realpathSync(path.join(path.dirname(support.include), "include")));

  const executed = spawnSync(installer, ["/S"], {
    cwd: root, windowsHide: true, encoding: "utf8", timeout: 30000, stdio: "pipe",
    env: { ...process.env, BOSTAN_DESKTOP_INSTALLER_QA: "1", BOSTAN_INSTALLER_QA_LOG: phaseLog },
  });
  assert.equal(executed.status, 0, executed.stderr || executed.stdout);
  assert.equal(fs.readFileSync(phaseLog, "utf8").trim(), "extraction_direct_complete");
  assert.equal(fs.existsSync(destination), true, JSON.stringify({ root: fs.readdirSync(root), phase: fs.readFileSync(phaseLog, "utf8") }));
  const entries = fs.readdirSync(destination, { recursive: true });
  assert.deepEqual(fs.readFileSync(path.join(destination, "resources/runtime", relative)), bytes, JSON.stringify(entries));

  const corruptArchive = path.join(root, "truncated.7z");
  fs.copyFileSync(archive, corruptArchive);
  fs.truncateSync(corruptArchive, Math.max(32, Math.floor(fs.statSync(corruptArchive).size * 0.6)));
  const corruptDestination = path.join(root, "corrupt install");
  const corruptInstaller = path.join(root, "Bostan corrupt extraction probe.exe");
  const corruptPhaseLog = path.join(root, "corrupt-phases.log");
  const corruptScript = script
    .replace(installer, corruptInstaller)
    .replace(archive, corruptArchive)
    .replace(destination, corruptDestination);
  const corruptScriptPath = path.join(root, "corrupt-fixture.nsi");
  fs.writeFileSync(corruptScriptPath, corruptScript);
  const corruptCompile = spawnSync(makensis.path, [...args.slice(0, -1), corruptScriptPath], {
    cwd: root, env: { ...process.env, ...(makensis.env ?? {}) }, windowsHide: true, encoding: "utf8", timeout: 30000,
  });
  assert.equal(corruptCompile.status, 0, corruptCompile.stderr || corruptCompile.stdout);
  const corruptRun = spawnSync(corruptInstaller, ["/S"], {
    cwd: root, windowsHide: true, encoding: "utf8", timeout: 30000, stdio: "pipe",
    env: { ...process.env, BOSTAN_DESKTOP_INSTALLER_QA: "1", BOSTAN_INSTALLER_QA_LOG: corruptPhaseLog },
  });
  assert.equal(corruptRun.status, 2, corruptRun.stderr || corruptRun.stdout);
  assert.equal(fs.existsSync(corruptPhaseLog), false, "Failed extraction must not reach the success phase");
  assert.equal(fs.existsSync(path.join(corruptDestination, "resources/runtime", relative)), false);

  const fake7zaSource = path.join(root, "fake-7za.cs");
  const fake7za = path.join(root, "fake-7za.exe");
  const childPidFile = path.join(root, "owner-termination-child.pid");
  const lateWrite = path.join(root, "owner-termination-late-write.txt");
  fs.writeFileSync(fake7zaSource, `using System; using System.Diagnostics; using System.IO; using System.Threading; internal static class Fake7za { private static int Main() { File.WriteAllText(Environment.GetEnvironmentVariable("BOSTAN_TEST_CHILD_PID"), Process.GetCurrentProcess().Id.ToString()); Thread.Sleep(8000); File.WriteAllText(Environment.GetEnvironmentVariable("BOSTAN_TEST_LATE_WRITE"), "survived"); return 0; } }`);
  const fakeCompile = spawnSync(path.join(process.env.WINDIR || "C:/Windows", "Microsoft.NET/Framework64/v4.0.30319/csc.exe"), ["/nologo", "/target:exe", "/out:" + fake7za, fake7zaSource], { windowsHide: true, encoding: "utf8", timeout: 30000 });
  assert.equal(fakeCompile.status, 0, fakeCompile.stderr || fakeCompile.stdout);
  definitions.BOSTAN_7ZA = fake7za;
  const ownerInstaller = path.join(root, "Bostan owner termination probe.exe");
  const ownerScript = script.replace(installer, ownerInstaller);
  const ownerScriptPath = path.join(root, "owner-fixture.nsi");
  fs.writeFileSync(ownerScriptPath, ownerScript);
  const ownerArgs = ["-V2", "-WX", "-INPUTCHARSET", "UTF8"];
  for (const [name, value] of Object.entries(definitions)) ownerArgs.push(`-D${name}=${value}`);
  for (const [name, value] of Object.entries(commands)) for (const entry of Array.isArray(value) ? value : [value]) ownerArgs.push(`-X${name} ${entry}`);
  ownerArgs.push(ownerScriptPath);
  const ownerCompile = spawnSync(makensis.path, ownerArgs, { cwd: root, env: { ...process.env, ...(makensis.env ?? {}) }, windowsHide: true, encoding: "utf8", timeout: 30000 });
  assert.equal(ownerCompile.status, 0, ownerCompile.stderr || ownerCompile.stdout);
  const ownerProcess = spawn(ownerInstaller, ["/S"], { cwd: root, windowsHide: true, stdio: "ignore", env: { ...process.env, BOSTAN_TEST_CHILD_PID: childPidFile, BOSTAN_TEST_LATE_WRITE: lateWrite } });
  const ownerClosed = new Promise(resolve => ownerProcess.once("close", (code, signal) => resolve({ code, signal })));
  try {
    await waitForFile(childPidFile);
    const childPid = Number(fs.readFileSync(childPidFile, "utf8"));
    assert.ok(Number.isInteger(childPid) && childPid > 0);
    const taskkill = path.join(process.env.WINDIR || "C:/Windows", "System32/taskkill.exe");
    const killed = spawnSync(taskkill, ["/PID", String(ownerProcess.pid), "/F"], { windowsHide: true, encoding: "utf8", timeout: 10000 });
    assert.equal(killed.status, 0, killed.stderr || killed.stdout);
    await ownerClosed;
    const powershell = path.join(process.env.WINDIR || "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
    const childGone = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", `if (Get-Process -Id ${childPid} -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }`], { windowsHide: true, encoding: "utf8", timeout: 10000 });
    assert.equal(childGone.status, 0, "Killing NSIS must terminate the extractor process");
    await wait(8500);
    assert.equal(fs.existsSync(lateWrite), false, "Killing NSIS must prevent later extractor writes");
  } finally {
    if (ownerProcess.exitCode === null) spawnSync(path.join(process.env.WINDIR || "C:/Windows", "System32/taskkill.exe"), ["/PID", String(ownerProcess.pid), "/F"], { windowsHide: true, timeout: 10000, stdio: "ignore" });
  }
});
