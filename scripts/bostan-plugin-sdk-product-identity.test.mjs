import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = relative => readFileSync(resolve(root, relative), "utf8");
const packageJson = relative => JSON.parse(text(relative + "/package.json"));
const sdkName = "@bostan/plugin-sdk";

test("Bostan plugin SDK is a private source package with owned developer command", () => {
  const sdk = packageJson("packages/plugins/sdk");
  assert.equal(sdk.name, sdkName);
  assert.equal(sdk.private, true);
  assert.equal(sdk.publishConfig, undefined);
  assert.deepEqual(sdk.bin, { "bostan-plugin-dev-server": "./dist/dev-cli.js" });
  assert.equal(sdk.repository.url, "https://github.com/TheHalfMoon/Bostan");
  for (const name of ["prepack", "prepublishOnly"]) {
    const match = /^node (\S+)$/.exec(sdk.scripts[name]);
    assert.ok(match, name + " must explicitly refuse release");
    assert.equal(resolve(root, "packages/plugins/sdk", match[1]),
      resolve(root,"scripts/bostan-release-disabled.mjs"));
    assert.ok(existsSync(resolve(root,"scripts/bostan-release-disabled.mjs")));
  }
});

test("active Bostan consumers reference native SDK, never the donor npm name", () => {
  for (const relative of [
    "server/package.json", "ui/package.json",
    "packages/plugins/create-bostan-plugin/package.json",
    "packages/plugins/examples/plugin-file-browser-example/package.json",
    "packages/plugins/examples/plugin-kitchen-sink-example/package.json",
    "packages/plugins/plugin-workspace-diff/package.json",
    "packages/plugins/sdk/README.md",
    "package.json",
  ]) {
    const source = text(relative);
    assert.ok(source.includes(sdkName), "Bostan SDK reference missing: "+relative);
    assert.ok(!source.includes("@paperclipai/plugin-sdk"), "Donor npm identity remains: "+relative);
  }
});

test("Bostan plugin dev command is wired into owned example workflow", () => {
  const devPackage = packageJson("packages/plugins/plugin-llm-wiki");
  assert.ok(devPackage.scripts["dev:ui"].startsWith("bostan-plugin-dev-server "));
  assert.equal(devPackage.scripts["prebuild"], "pnpm --filter @bostan/plugin-sdk ensure-build-deps");
  assert.equal(devPackage.paperclipPlugin.manifest, "./dist/manifest.js",
    "persisted plugin protocol key intentionally remains compatible");
});

test("Bostan plugin SDK release inventory is disabled", () => {
  const manifest = JSON.parse(text("scripts/release-package-manifest.json"));
  const pkg = manifest.find(item => item.dir === "packages/plugins/sdk");
  assert.equal(pkg?.name,sdkName);
  assert.equal(pkg?.publishFromCi,false);
});
