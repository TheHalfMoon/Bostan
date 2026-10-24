import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const source = new URL("../bostan-preview.mjs", import.meta.url).pathname;
const cli = new URL("../../dist/bostan.js", import.meta.url).pathname;
const nodeDir = dirname(process.execPath);
const nativeTest = process.platform === "darwin" || process.platform === "linux" ? test : test.skip;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "bostan-native-install-test-"));
  const home = join(dir, "home");
  mkdirSync(home);
  return { dir, home, clean: () => rmSync(dir, { recursive: true, force: true }) };
}
function invoke(home, args, executable = source) {
  const result = spawnSync(executable === "shim" ? join(home, ".local", "bin", "bostan") : process.execPath,
    executable === "shim" ? args : [executable, ...args], {
      env: { HOME: home, PATH: nodeDir + ":/usr/bin:/bin", NODE_ENV: "test" },
      timeout: 4000, encoding: "utf8",
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
      join(f.home, ".local", "bin", "bostan"),
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

nativeTest("installer refuses to replace another command with the same name", () => {
  const f = fixture();
  try {
    mkdirSync(join(f.home, ".local", "bin"), { recursive: true });
    const bin = join(f.home, ".local", "bin", "bostan");
    writeFileSync(bin, "#!/bin/sh\necho OTHER\n");
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.match(readFileSync(bin, "utf8"), /OTHER/);
    assert.equal(existsSync(join(f.home, ".bostan")), false);
  } finally { f.clean(); }
});

nativeTest("refuses an inherited-home symlink without touching its target", () => {
  const f = fixture();
  try {
    const inherited = join(f.home, ".paperclip");
    mkdirSync(inherited);
    writeFileSync(join(inherited, "do-not-touch"), "protected");
    symlinkSync(inherited, join(f.home, ".bostan"), "dir");
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.deepEqual(readdirSync(inherited), ["do-not-touch"]);
    assert.equal(existsSync(join(f.home, ".local")), false);
  } finally { f.clean(); }
});

nativeTest("refuses a symlinked local-bin directory or shim", () => {
  const f = fixture();
  try {
    const other = join(f.dir, "other");
    mkdirSync(other);
    mkdirSync(join(f.home, ".local"));
    symlinkSync(other, join(f.home, ".local", "bin"), "dir");
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
    for (const args of [["app", "doctor"], ["app", "run", "--local"], ["app", "recover", "--local"], ["install"], ["install", "--repo", "paperclipai/paperclip", "--ref", "main"], ["onboard"], ["run"], ["service", "start"], ["uninstall"], ["update"], ["upgrade"]]) {
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

nativeTest("refuses a symlinked command path without touching the target", () => {
  const f = fixture();
  try {
    mkdirSync(join(f.home, ".local", "bin"), { recursive: true });
    const target = join(f.dir, "protected");
    writeFileSync(target, "protected");
    symlinkSync(target, join(f.home, ".local", "bin", "bostan"));
    mustRefuse(invoke(f.home, ["install", "--local"]));
    assert.equal(readFileSync(target, "utf8"), "protected");
  } finally { f.clean(); }
});
