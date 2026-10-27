import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createZipArchive } from "../../../ui/src/lib/zip.ts";

const source = fileURLToPath(new URL("../bostan-preview.mjs", import.meta.url));
const cli = fileURLToPath(new URL("../../dist/bostan.js", import.meta.url));
const nodeDir = dirname(process.execPath);
// Windows is qualified only inside disposable, protected QA homes.
const nativeTest = ["darwin", "linux", "win32"].includes(process.platform) ? test : test.skip;
const commandName = process.platform === "win32" ? "bostan.cmd" : "bostan";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "bostan-native-install-test-"));
  const home = join(dir, "home");
  mkdirSync(home);
  return { dir, home, clean: () => rmSync(dir, { recursive: true, force: true }) };
}
function invoke(home, args, executable = source) {
  const env = { ...process.env, HOME: home,
    PATH: nodeDir + delimiter + (process.env.PATH ?? ""),
    BOSTAN_WINDOWS_TEMP_QA: "1", NODE_ENV: "test" };
  let command = process.execPath;
  let commandArgs = [executable, ...args];
  if (executable === "shim") {
    const shim = join(home, ".local", "bin", commandName);
    if (process.platform === "win32") {
      // Test an actual NTFS .cmd entrypoint; never enable the interactive shell
      // for source/installer subprocesses, nor interpolate arbitrary inputs.
      command = join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");
      commandArgs = ["/d", "/s", "/c",
        '\"' + '\"' + shim + '\"' + (args.length ? " " + args.map(x=> '\"' + x + '\"').join(" ") : "") + '\"'];
    } else {
      command = shim;
      commandArgs = args;
    }
  }
  const result = spawnSync(command, commandArgs, {
    env, timeout: 12000, encoding: "utf8", windowsHide: true,
    windowsVerbatimArguments: process.platform === "win32" && executable === "shim",
  });
  assert.equal(result.error, undefined);
  return result;
}
function mustRefuse(result) {
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /Bostan:/);
  assert.equal(result.stdout, "");
}

test("read-only status does not create a Bostan or inherited storage tree", () => {
  const f = fixture();
  try {
    assert.equal(invoke(f.home, ["status"]).status, 0);
    assert.deepEqual(readdirSync(f.home), []);
  } finally { f.clean(); }
});

nativeTest("local installation is isolated and the installed executable works without the source checkout", () => {
  const f = fixture();
  try {
    const inherited = join(f.home, ".paperclip");
    mkdirSync(inherited);
    writeFileSync(join(inherited, "marker"), "must survive");
    const result = invoke(f.home, ["install", "--local"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Installed Bostan CLI preview/);
    assert.equal(readFileSync(join(inherited, "marker"), "utf8"), "must survive");
    const paths = [
      join(f.home, ".bostan", "cli", "install.json"),
      join(f.home, ".local", "bin", commandName),
    ];
    for (const p of paths) assert.ok(existsSync(p), p);
    assert.equal(invoke(f.home, ["--version"], "shim").stdout.trim(), "0.3.1");
    assert.equal(invoke(f.home, ["status"], "shim").status, 0);
    mustRefuse(invoke(f.home, ["update", "--latest"], "shim"));
    const manifest = readFileSync(paths[0], "utf8");
    const parsed = JSON.parse(manifest);
    const installedPackage = JSON.parse(readFileSync(join(parsed.directory, "package.json"), "utf8"));
    assert.deepEqual(installedPackage, {
      name: "bostan", version: "0.3.1", type: "module",
      private: true, bin: { bostan: "dist/bostan.js" },
    });
    assert.equal(readFileSync(join(parsed.directory, "package.json"), "utf8").includes("@paperclipai"), false);
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.equal(readFileSync(paths[0], "utf8"), manifest);
    assert.equal(readFileSync(join(inherited, "marker"), "utf8"), "must survive");
  } finally { f.clean(); }
});

nativeTest("compiled distro CLI can install the local preview without contacting any remote provider", () => {
  const f = fixture();
  try {
    assert.equal(invoke(f.home, ["install", "--local"], cli).status, 0);
    assert.equal(invoke(f.home, ["status"], "shim").status, 0);
  } finally { f.clean(); }
});

nativeTest("installed Bostan CLI inspects real ZIP and verifies integrity of inspector module", () => {
  const f = fixture();
  try {
    const archive = join(f.home, "sample.zip");
    writeFileSync(archive, createZipArchive({
      "README.md": "# Synthetic private export",
      "agents/a/AGENT.md": "Synthetic data",
    }, "bostan-synthetic"));
    assert.equal(invoke(f.home, ["install", "--local"]).status, 0);
    const inspected = invoke(f.home, ["company", "inspect", archive], "shim");
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.equal(JSON.parse(inspected.stdout).files, 2);
    assert.equal(JSON.parse(inspected.stdout).supportedForImport, false);
    assert.equal(invoke(f.home, ["status"], "shim").status, 0);

    const manifest = JSON.parse(readFileSync(join(f.home, ".bostan", "cli", "install.json"), "utf8"));
    const inspector = join(manifest.directory, "dist", "bostan-company-export-inspect.mjs");
    assert.ok(existsSync(inspector));
    writeFileSync(inspector, "tampered test code");
    mustRefuse(invoke(f.home, ["status"], "shim"));
  } finally { f.clean(); }
});

nativeTest("installer refuses to replace another command with the same name", () => {
  const f = fixture();
  try {
    mkdirSync(join(f.home, ".local", "bin"), { recursive: true });
    const bin = join(f.home, ".local", "bin", commandName);
    writeFileSync(bin, "#!/bin/sh\necho OTHER\n");
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.match(readFileSync(bin, "utf8"), /OTHER/);
    assert.equal(existsSync(join(f.home, ".bostan")), false);
  } finally { f.clean(); }
});

nativeTest("refuses an inherited-home symlink without touching its target", (t) => {
  const f = fixture();
  try {
    const inherited = join(f.home, ".paperclip");
    mkdirSync(inherited);
    writeFileSync(join(inherited, "do-not-touch"), "protected");
    try { symlinkSync(inherited, join(f.home, ".bostan"), "dir"); }
    catch(error) { if(process.platform==="win32" && ["EPERM","EACCES"].includes(error?.code)) {t.skip("Windows symlink privilege unavailable");return;} throw error; }
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.deepEqual(readdirSync(inherited), ["do-not-touch"]);
    assert.equal(existsSync(join(f.home, ".local")), false);
  } finally { f.clean(); }
});

nativeTest("refuses a symlinked local-bin directory or shim", (t) => {
  const f = fixture();
  try {
    const other = join(f.dir, "other");
    mkdirSync(other);
    mkdirSync(join(f.home, ".local"));
    try { symlinkSync(other, join(f.home, ".local", "bin"), "dir"); }
    catch(error) { if(process.platform==="win32" && ["EPERM","EACCES"].includes(error?.code)) {t.skip("Windows symlink privilege unavailable");return;} throw error; }
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.deepEqual(readdirSync(other), []);
  } finally { f.clean(); }
});

nativeTest("read-only status fails closed when installed payload is tampered", () => {
  const f = fixture();
  try {
    assert.equal(invoke(f.home, ["install", "--local"]).status, 0);
    const manifest = JSON.parse(readFileSync(join(f.home, ".bostan", "cli", "install.json"), "utf8"));
    writeFileSync(join(manifest.directory, "dist", "bostan.js"), "tampered");
    mustRefuse(invoke(f.home, ["status"]));
    assert.ok(existsSync(join(manifest.directory, "dist", "bostan.js")));
  } finally { f.clean(); }
});

nativeTest("incomplete previous lock or unmanaged payload causes refusal, without deleting it", () => {
  const f = fixture();
  try {
    const root = join(f.home, ".bostan", "cli");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, ".install.lock"), "another-process");
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.equal(readFileSync(join(root, ".install.lock"), "utf8"), "another-process");
    mustRefuse(invoke(f.home, ["status"]));
  } finally { f.clean(); }
});

nativeTest("release and legacy operations remain disabled after local installation", () => {
  const f = fixture();
  try {
    assert.equal(invoke(f.home, ["install", "--local"]).status, 0);
    for (const args of [["app", "doctor"], ["app", "run", "--local"], ["app", "stop", "--local"], ["app", "recover", "--local"], ["app", "backup", "--local"], ["app", "verify", "--local", "/tmp/fake"], ["app", "restore", "--local", "/tmp/fake", "--into-new-home", "/tmp/fake-new-home"], ["install"], ["install", "--repo", "paperclipai/paperclip", "--ref", "main"], ["onboard"], ["run"], ["service", "start"], ["uninstall"], ["update"], ["upgrade"]]) {
      mustRefuse(invoke(f.home, args, "shim"));
    }
  } finally { f.clean(); }
});


nativeTest("the installed CLI survives deletion of its temporary staging directory", () => {
  const f = fixture();
  try {
    const staging = join(f.dir, "staging");
    mkdirSync(join(staging, "dist"), { recursive: true });
    copyFileSync(source, join(staging, "dist", "bostan.js"));
    copyFileSync(new URL("../bostan-local-install.mjs", import.meta.url), join(staging, "dist", "bostan-local-install.mjs"));
    copyFileSync(new URL("../bostan-company-export-inspect.mjs", import.meta.url), join(staging, "dist", "bostan-company-export-inspect.mjs"));
    copyFileSync(new URL("../../../scripts/bostan-windows-acl.mjs", import.meta.url), join(staging, "dist", "bostan-windows-acl.mjs"));
    copyFileSync(new URL("../../package.json", import.meta.url), join(staging, "package.json"));
    assert.equal(invoke(f.home, ["install", "--local"], join(staging, "dist", "bostan.js")).status, 0);
    rmSync(staging, { recursive: true, force: true });
    assert.equal(invoke(f.home, ["--version"], "shim").status, 0);
    assert.equal(invoke(f.home, ["status"], "shim").status, 0);
  } finally { f.clean(); }
});

nativeTest("quotes apostrophes and spaces in the installed command path safely", () => {
  const f = fixture();
  try {
    const customHome = join(f.dir, "home's local workspace");
    mkdirSync(customHome);
    assert.equal(invoke(customHome, ["install", "--local"]).status, 0);
    assert.equal(invoke(customHome, ["--version"], "shim").stdout.trim(), "0.3.1");
    assert.equal(readdirSync(customHome).includes(".paperclip"), false);
  } finally { f.clean(); }
});

nativeTest("refuses a symlinked command path without touching the target", (t) => {
  const f = fixture();
  try {
    mkdirSync(join(f.home, ".local", "bin"), { recursive: true });
    const target = join(f.dir, "protected");
    writeFileSync(target, "protected");
    try { symlinkSync(target, join(f.home, ".local", "bin", commandName)); }
    catch(error) { if(process.platform==="win32" && ["EPERM","EACCES"].includes(error?.code)) {t.skip("Windows symlink privilege unavailable");return;} throw error; }
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.equal(readFileSync(target, "utf8"), "protected");
  } finally { f.clean(); }
});
