import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const entry = new URL("../bostan-preview.mjs", import.meta.url);
const releaseGuard = new URL("../../../scripts/bostan-release-disabled.mjs", import.meta.url);
const version = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

function isolatedRun(args, path = entry) {
  const home = mkdtempSync(join(tmpdir(), "bostan-cli-isolation-"));
  try {
    const result = spawnSync(process.execPath, [path.pathname, ...args], {
      encoding: "utf8",
      env: { HOME: home, PATH: "/usr/bin:/bin", NODE_ENV: "test" },
      timeout: 3000,
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(readdirSync(home), [], "CLI command must not create managed state");
    return result;
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("Bostan help contains the correct name and no inherited product name", () => {
  for (const args of [[], ["--help"], ["-h"]]) {
    const result = isolatedRun(args);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Bostan/);
    assert.doesNotMatch(result.stdout, /Paperclip|paperclipai/i);
  }
});

test("Bostan version reads the package version without touching the network", () => {
  const result = isolatedRun(["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), version);
});

test("inherited high-risk commands are uniformly refused with no side effects", () => {
  for (const args of [
    ["install"], ["install", "--repo", "paperclipai/paperclip", "--ref", "master", "--yes"],
    ["update"], ["upgrade"], ["uninstall"], ["service", "install"], ["service", "start"],
    ["onboard", "--install-service"], ["run"], ["runtime", "setup", "pi"],
    ["--nonsense"],
  ]) {
    const result = isolatedRun(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, /No operation was performed/);
    assert.equal(result.stdout, "");
  }
});

test("publishing scripts reject any requested release action", () => {
  const result = isolatedRun([], releaseGuard);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /disabled/);
});

test("workspace and package metadata cannot expose the inherited CLI or publish it", () => {
  const cli = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const root = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(readFileSync(new URL("../../../scripts/release-package-manifest.json", import.meta.url), "utf8"));
  const cliRelease = manifest.filter((entry) => entry.dir === "cli");
  assert.equal(cli.name, "bostan");
  assert.deepEqual(cli.bin, { bostan: "./dist/bostan.js" });
  assert.equal(cli.private, true);
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.match(readme, /Bostan CLI/);
  assert.doesNotMatch(readme, /paperclipai|paperclip\.ing|github\.com\/paperclipai/i);
  assert.equal(root.name, "bostan");
  assert.equal(root.scripts.paperclipai, undefined);
  assert.equal(root.scripts.bostan, "node cli/src/bostan-preview.mjs");
  assert.equal(cli.scripts.build, "node scripts/build-bostan-preview.mjs");
  assert.equal(cli.scripts.prepack, "node ../scripts/bostan-release-disabled.mjs");
  assert.equal(cli.scripts.prepublishOnly, "node ../scripts/bostan-release-disabled.mjs");
  assert.deepEqual(cliRelease, [{ dir: "cli", name: "bostan", publishFromCi: false }]);
  for (const key of ["release", "release:canary", "release:stable", "release:github", "release:rollback", "build:npm", "release:bootstrap-package"]) {
    assert.equal(root.scripts[key], "node scripts/bostan-release-disabled.mjs");
  }
});
