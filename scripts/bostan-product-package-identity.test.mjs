import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildReleasePackagePlan, getReleasePackages } from "./release-package-map.mjs";

const read = (relativePath) => readFileSync(fileURLToPath(new URL("../" + relativePath, import.meta.url)), "utf8");
const json = (relativePath) => JSON.parse(read(relativePath));

test("Bostan product CLI owns the command and blocks packaging/publishing", () => {
  const cli = json("cli/package.json");
  assert.equal(cli.name, "bostan");
  assert.equal(cli.private, true);
  assert.equal(cli.bin?.bostan, "./dist/bostan.js");
  assert.match(cli.scripts.prepack, /bostan-release-disabled/);
  assert.match(cli.scripts.prepublishOnly, /bostan-release-disabled/);
  assert.equal(cli.repository.url, "https://github.com/TheHalfMoon/Bostan");
});

test("Bostan catalog packages and generated metadata use the owned identity", () => {
  for (const category of ["skills", "teams"]) {
    const prefix = "packages/" + category + "-catalog/";
    const pkg = json(prefix + "package.json");
    const catalog = json(prefix + "generated/catalog.json");
    const expected = "@bostan/" + category + "-catalog";
    assert.equal(pkg.name, expected);
    assert.equal(catalog.packageName, expected);
    assert.equal(pkg.homepage, "https://github.com/TheHalfMoon/Bostan");
    assert.equal(pkg.bugs.url, "https://github.com/TheHalfMoon/Bostan/issues");
    assert.equal(pkg.repository.url, "https://github.com/TheHalfMoon/Bostan");
    assert.equal(pkg.repository.directory, prefix.replace(/\/$/, ""));
  }
});

test("Bostan board UI package is private and cannot be packed or published", () => {
  const ui = json("ui/package.json");
  assert.equal(ui.name, "@bostan/ui");
  assert.equal(ui.private, true);
  assert.equal(ui.repository.url, "https://github.com/TheHalfMoon/Bostan");
  assert.equal(ui.publishConfig, undefined);
  assert.match(ui.scripts.prepack, /bostan-release-disabled/);
  assert.match(ui.scripts.prepublishOnly, /bostan-release-disabled/);
  assert.equal(ui.scripts.postpack, undefined);
  assert.equal(read("scripts/generate-ui-package-json.mjs").includes("bostan-release-disabled.mjs"), true);
});

test("Bostan server workspace and CLI provider imports use private Bostan ownership", () => {
  const server = json("server/package.json");
  const cli = json("cli/package.json");
  assert.equal(server.name, "@bostan/server");
  assert.equal(server.private, true);
  assert.equal(server.publishConfig, undefined);
  assert.equal(server.repository.url, "https://github.com/TheHalfMoon/Bostan");
  assert.match(server.scripts.prepack, /bostan-release-disabled/);
  assert.match(server.scripts.prepublishOnly, /bostan-release-disabled/);
  assert.equal(server.scripts.postpack, undefined);
  assert.equal(cli.dependencies["@bostan/server"], "workspace:*");
  assert.equal(cli.dependencies["@paperclipai/server"], undefined);
  assert.match(read("cli/src/commands/run.ts"), /import\("@bostan\/server"\)/);
  assert.match(read("cli/src/commands/runtime.ts"), /resolve\("@bostan\/server"\)/);
});

test("all inherited CI release packages are disabled and cannot be published", () => {
  const manifest = json("scripts/release-package-manifest.json");
  assert.ok(manifest.length > 0);
  assert.ok(manifest.every(entry => !entry.dir.startsWith("packages/plugins/sandbox-providers/")), "private sandbox providers cannot appear in public release inventory");
  assert.ok(manifest.every((entry) => entry.publishFromCi === false));
  assert.ok(manifest.some(entry => entry.name === "@bostan/skills-catalog"));
  assert.ok(manifest.some(entry => entry.name === "@bostan/teams-catalog"));
  assert.ok(manifest.some(entry => entry.name === "bostan" && entry.dir === "cli"));
  assert.ok(buildReleasePackagePlan().every(pkg => !pkg.publishFromCi));
  assert.throws(() => getReleasePackages(), /Bostan publishing disabled/);
});

test("historical catalog item keys remain readable across package rebranding", () => {
  const teams = json("packages/teams-catalog/generated/catalog.json");
  const skills = json("packages/skills-catalog/generated/catalog.json");
  assert.ok(teams.teams.some(team => team.key === "paperclipai/bundled/company-defaults/core-exec-team"));
  assert.ok(skills.skills.some(skill => skill.key === "paperclipai/bundled/docs/doc-maintenance"));
});
