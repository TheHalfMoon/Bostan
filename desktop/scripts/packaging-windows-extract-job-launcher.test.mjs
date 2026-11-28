import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createPackagingStage } from "./packaging-stage.mjs";
import { writeInstallPayloadManifest } from "./install-payload-manifest.mjs";

const windowsTest = process.platform === "win32" ? test : test.skip;

function run(executable, args, options = {}) {
  return spawnSync(executable, args, { windowsHide: true, encoding: "utf8", timeout: 30000, ...options });
}

function csharpCompiler() {
  const root = process.env.WINDIR || "C:/Windows";
  for (const relative of ["Microsoft.NET/Framework64/v4.0.30319/csc.exe", "Microsoft.NET/Framework/v4.0.30319/csc.exe"]) {
    const candidate = path.join(root, ...relative.split("/"));
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate;
  }
  throw new Error("Windows .NET Framework C# compiler unavailable");
}

function hash(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

windowsTest("job-contained 7-Zip extraction verifies the full runtime payload", { timeout: 90000 }, async t => {
  const desktop = path.resolve(import.meta.dirname, "..");
  const require = createRequire(path.join(desktop, "package.json"));
  require("electron-builder");
  const { getPath7za } = require("app-builder-lib/out/toolsets/7zip.js");
  const seven = await getPath7za();
  assert.equal(hash(fs.readFileSync(seven)), "223b873c50380fe9a39f1a22b6abf8d46db506e1c08d08312902f6f3cd1f7ac3");

  const owned = createPackagingStage(os.tmpdir());
  fs.mkdirSync(owned.directory);
  t.after(() => owned.dispose());
  const root = path.dirname(owned.directory);
  const helperDirectory = path.join(root, "helper");
  fs.mkdirSync(helperDirectory);
  const launcher = path.join(helperDirectory, "BostanExtractor.exe");
  fs.copyFileSync(seven, path.join(helperDirectory, "7za.exe"));
  const source = path.join(root, "source");
  const shortRelative = "deep path/payload.txt";
  const longRelative = Array.from({ length: 8 }, (_, i) => `segment${i}-${"x".repeat(30)}`).join("/") + "/long.txt";
  const shortBytes = Buffer.from("job launcher extraction\n");
  const longBytes = Buffer.from("long Windows path\n");
  fs.mkdirSync(path.dirname(path.join(source, "resources/runtime", shortRelative)), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(source, "resources/runtime", longRelative)), { recursive: true });
  fs.writeFileSync(path.join(source, "resources/runtime", shortRelative), shortBytes);
  fs.writeFileSync(path.join(source, "resources/runtime", longRelative), longBytes);
  const manifest = path.join(root, "runtime.tsv");
  writeInstallPayloadManifest([
    { path: shortRelative, kind: "file", sha256: hash(shortBytes) },
    { path: longRelative, kind: "file", sha256: hash(longBytes) },
  ], manifest);

  const launcherSource = path.join(desktop, "scripts/windows-extract-job-launcher.cs");
  const compile = run(csharpCompiler(), ["/nologo", "/target:exe", "/platform:anycpu", "/out:" + launcher, launcherSource]);
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);

  const archive = path.join(root, "runtime.7z");
  const create = run(seven, ["a", "-t7z", archive, "resources/runtime/" + shortRelative, "resources/runtime/" + longRelative], { cwd: source });
  assert.equal(create.status, 0, create.stderr || create.stdout);
  const destination = path.join(root, "installed app");
  fs.mkdirSync(destination);
  const extracted = run(launcher, [archive, destination, manifest, String(process.pid)]);
  assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
  assert.deepEqual(fs.readFileSync(path.join(destination, "resources/runtime", shortRelative)), shortBytes);
  assert.deepEqual(fs.readFileSync(path.join(destination, "resources/runtime", longRelative)), longBytes);

  const mismatchManifest = path.join(root, "mismatch.tsv");
  writeInstallPayloadManifest([{ path: shortRelative, kind: "file", sha256: "0".repeat(64) }], mismatchManifest);
  const mismatch = run(launcher, [archive, destination, mismatchManifest, String(process.pid)]);
  assert.equal(mismatch.status, 78, "A checksum or unexpected-entry mismatch must fail installation");

  const extra = path.join(destination, "resources/runtime/unexpected.txt");
  fs.writeFileSync(extra, "unexpected");
  const unexpected = run(launcher, [archive, destination, manifest, String(process.pid)]);
  assert.equal(unexpected.status, 78, "Unexpected installed runtime files must fail verification");
  fs.rmSync(extra);

  const corruptArchive = path.join(root, "truncated.7z");
  fs.copyFileSync(archive, corruptArchive);
  fs.truncateSync(corruptArchive, Math.max(32, Math.floor(fs.statSync(corruptArchive).size * 0.6)));
  const corrupt = run(launcher, [corruptArchive, path.join(root, "corrupt app"), manifest, String(process.pid)]);
  assert.notEqual(corrupt.status, 0, "A truncated archive must be rejected");

  const childSource = path.join(root, "fake-7za.cs");
  const childExe = path.join(root, "fake-7za.exe");
  const started = path.join(root, "extractor-child.pid");
  const marker = path.join(root, "extractor-child-survived.txt");
  fs.writeFileSync(childSource, `using System; using System.Diagnostics; using System.IO; using System.Threading; internal static class Child { private static int Main() { File.WriteAllText(Environment.GetEnvironmentVariable("BOSTAN_CHILD_PID"), Process.GetCurrentProcess().Id.ToString()); Thread.Sleep(8000); File.WriteAllText(Environment.GetEnvironmentVariable("BOSTAN_CHILD_MARKER"), "survived"); return 0; } }`);
  const compileChild = run(csharpCompiler(), ["/nologo", "/target:exe", "/out:" + childExe, childSource]);
  assert.equal(compileChild.status, 0, compileChild.stderr || compileChild.stdout);
  const childDirectory = path.join(root, "child helper");
  fs.mkdirSync(childDirectory);
  fs.copyFileSync(launcher, path.join(childDirectory, "BostanExtractor.exe"));
  fs.copyFileSync(childExe, path.join(childDirectory, "7za.exe"));
  const childProcess = spawn(path.join(childDirectory, "BostanExtractor.exe"), [archive, root, manifest, String(process.pid)], {
    windowsHide: true, stdio: "ignore",
    env: { ...process.env, BOSTAN_CHILD_PID: started, BOSTAN_CHILD_MARKER: marker },
  });
  const closed = new Promise(resolve => childProcess.once("close", (code, signal) => resolve({ code, signal })));
  await wait(1000);
  assert.equal(childProcess.exitCode, null, "The child fixture must be active before its owner is terminated");
  const taskkill = run(path.join(process.env.WINDIR || "C:/Windows", "System32/taskkill.exe"), ["/PID", String(childProcess.pid), "/F"]);
  assert.equal(taskkill.status, 0, taskkill.stderr || taskkill.stdout);
  await closed;
  assert.equal(fs.existsSync(started), true, "The extractor child must have started");
  const childPid = Number(fs.readFileSync(started, "utf8"));
  const powershell = path.join(process.env.WINDIR || "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
  const childGone = run(powershell, ["-NoProfile", "-NonInteractive", "-Command", `if (Get-Process -Id ${childPid} -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }`]);
  assert.equal(childGone.status, 0, "Terminating the installer owner must close its extraction job");
  await wait(8500);
  assert.equal(fs.existsSync(marker), false, "A terminated installer must not leave an extractor writing after it exits");
});
