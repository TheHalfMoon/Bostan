import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const read=rel=>readFileSync(resolve(root,rel),"utf8");
const cases=[
 ["packages/plugins/examples/plugin-hello-world-example","@bostan/plugin-hello-world-example"],
 ["packages/plugins/examples/plugin-authoring-smoke-example","@bostan/plugin-authoring-smoke-example"],
 ["packages/plugins/plugin-llm-wiki","@bostan/plugin-llm-wiki"],
 ["packages/plugins/plugin-workspace-diff","@bostan/plugin-workspace-diff"],
 ["packages/plugins/bostan-plugin-fake-sandbox","@bostan/plugin-fake-sandbox"],
];
for(const [dir,name] of cases) {
 test("Bostan owns private plugin package "+name,()=>{
   const pkg=JSON.parse(read(dir+"/package.json"));
   assert.equal(pkg.name,name);
   assert.equal(pkg.private,true);
   assert.equal(pkg.publishConfig,undefined);
   assert.equal(pkg.repository.url,"https://github.com/TheHalfMoon/Bostan");
   assert.ok(pkg.scripts.prepack.startsWith("node "));
   assert.equal(pkg.scripts.prepack,pkg.scripts.prepublishOnly);
   assert.equal(resolve(root,dir,pkg.scripts.prepack.slice(5)),
     resolve(root,"scripts/bostan-release-disabled.mjs"));
   assert.equal(pkg.scripts.postpack,undefined);
   assert.ok(existsSync(resolve(root,dir,"src")));
 });
}
test("Bostan bundled plugin route uses owned names",()=>{
 const source=read("server/src/routes/plugins.ts");
 assert.ok(source.includes('"@bostan/plugin-llm-wiki"'));
 assert.ok(source.includes('"@bostan/plugin-workspace-diff"'));
 assert.ok(!source.includes('"@paperclipai/plugin-llm-wiki"'));
});
test("Bostan fake sandbox example owns actual build path without changing stored protocol",()=>{
 assert.ok(existsSync(resolve(root,"packages/plugins/bostan-plugin-fake-sandbox/src/worker.ts")));
 assert.ok(!existsSync(resolve(root,"packages/plugins/paperclip-plugin-fake-sandbox")));
 assert.ok(read("Dockerfile").includes("packages/plugins/bostan-plugin-fake-sandbox/package.json"));
 assert.ok(read("pnpm-lock.yaml").includes("packages/plugins/bostan-plugin-fake-sandbox:"));
 assert.ok(read("packages/plugins/bostan-plugin-fake-sandbox/package.json").includes('"paperclipPlugin"'));
});
test("private Bostan workspace-diff is release-disabled in checked-in inventory",()=>{
 const manifest=JSON.parse(read("scripts/release-package-manifest.json"));
 const e=manifest.find(x=>x.dir==="packages/plugins/plugin-workspace-diff");
 assert.equal(e?.name,"@bostan/plugin-workspace-diff");
 assert.equal(e?.publishFromCi,false);
});
