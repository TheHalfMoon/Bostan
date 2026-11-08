import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = rel => readFileSync(resolve(root, rel),"utf8");

test("Bostan plugin scaffold package and command are private with release hooks blocked", () => {
  const pkg = JSON.parse(read("packages/plugins/create-bostan-plugin/package.json"));
  assert.equal(pkg.name,"@bostan/create-bostan-plugin");
  assert.equal(pkg.private,true);
  assert.equal(pkg.publishConfig,undefined);
  assert.deepEqual(pkg.bin, {"create-bostan-plugin":"./dist/bin.js"});
  assert.equal(pkg.repository.url,"https://github.com/TheHalfMoon/Bostan");
  for (const key of ["prepack","prepublishOnly"]) {
    const match=/^node (\S+)$/.exec(pkg.scripts[key]);
    assert.ok(match);
    assert.equal(resolve(root,"packages/plugins/create-bostan-plugin",match[1]),
      resolve(root,"scripts/bostan-release-disabled.mjs"));
  }
});

test("scaffolder links to local private Bostan SDK instead of packing SDK releases", () => {
  const source=read("packages/plugins/create-bostan-plugin/src/index.ts");
  assert.match(source,/sdkDependency = useWorkspaceSdk/);
  assert.match(source,/link:\$\{toPosixPath\(path\.relative\(outputDir, localSdkPath\)\)\}/);
  assert.match(source,/assertBostanSdk\(localSdkPath\)/);
  assert.doesNotMatch(source,/execFileSync\("pnpm",\s*\["pack"/);
  assert.doesNotMatch(source,/\.paperclip-sdk/);
  assert.match(source,/bostan plugin install/);
  assert.ok(source.includes("paperclipPlugin: {"),"Persisted plugin manifest compatibility must remain");
});

test("Bostan CLI next steps and scaffold help use Bostan without claiming npm publication", () => {
  const cli=read("cli/src/commands/client/plugin.ts");
  const scaffoldCli=read("packages/plugins/create-bostan-plugin/src/bin.ts");
  const readme=read("packages/plugins/create-bostan-plugin/README.md");
  assert.match(cli,/bostan plugin install/);
  assert.doesNotMatch(cli,/paperclipai plugin install/);
  assert.match(scaffoldCli,/Usage: create-bostan-plugin/);
  assert.ok(!readme.includes("npx @bostan/create-bostan-plugin"));
  assert.ok(readme.includes("private"));
  assert.ok(readme.includes("local"));
});

test("private disabled release manifest uses new Bostan-owned source path", () => {
  const entries=JSON.parse(read("scripts/release-package-manifest.json"));
  assert.ok(entries.some(e=>e.dir==="packages/plugins/create-bostan-plugin" &&
    e.name==="@bostan/create-bostan-plugin" && e.publishFromCi===false));
  assert.ok(!entries.some(e=>e.dir==="packages/plugins/create-paperclip-plugin"));
  assert.ok(existsSync(resolve(root,"packages/plugins/create-bostan-plugin/src/index.ts")));
});

test("Bostan developer skill and local plugin docs forbid private SDK packing", () => {
  const skill = read(".agents/skills/bostan-create-plugin/SKILL.md");
  assert.ok(!existsSync(resolve(root,".agents/skills/paperclip-create-plugin/SKILL.md")));
  assert.match(skill,/name: bostan-create-plugin/);
  assert.match(skill,/bostan plugin init/);
  assert.match(skill,/Bostan SDK source/);
  assert.doesNotMatch(skill,/paperclipai plugin install/);
  const docs=read("doc/plugins/PLUGIN_AUTHORING_GUIDE.md");
  assert.ok(docs.includes("local `link:` dependency"));
  assert.ok(!docs.includes("scaffold snapshots `@bostan/plugin-sdk`"));
});
