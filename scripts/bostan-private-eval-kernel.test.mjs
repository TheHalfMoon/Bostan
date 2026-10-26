import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const read=path=>readFileSync(resolve(root,path),"utf8");

test("Bostan eval kernel has a private and release-blocked workspace identity",()=>{
 const pkg=JSON.parse(read("packages/bostan-eval-kernel/package.json"));
 assert.equal(pkg.name,"@bostan/eval-kernel");
 assert.equal(pkg.private,true);
 assert.equal(pkg.publishConfig,undefined);
 assert.equal(pkg.repository.url,"https://github.com/TheHalfMoon/Bostan");
 for (const hook of ["prepack","prepublishOnly"]) {
   const command=pkg.scripts[hook].match(/^node (\S+)$/);
   assert.ok(command);
   assert.equal(resolve(root,"packages/bostan-eval-kernel",command[1]),
     resolve(root,"scripts/bostan-release-disabled.mjs"));
 }
 assert.ok(!existsSync(resolve(root,"packages/paperclip-eval-kernel")));
});

test("Bostan runner imports reviewed eval kernel only as a private workspace dependency",()=>{
 const runner=JSON.parse(read("packages/paperclip-runner/package.json"));
 assert.equal(runner.devDependencies["@bostan/eval-kernel"],"workspace:*");
 assert.equal(runner.devDependencies["@paperclipai/paperclip-eval-kernel"],undefined);
 const src=read("packages/paperclip-runner/src/eval/workflow-harness.ts");
 assert.ok(src.includes('from "@bostan/eval-kernel"'));
 const lock=read("pnpm-lock.yaml");
 assert.ok(lock.includes("packages/bostan-eval-kernel:"));
 assert.ok(!lock.includes("packages/paperclip-eval-kernel:"));
 assert.ok(read("packages/paperclip-runner/scripts/build-inputs.mjs")
   .includes('EVAL_KERNEL_PACKAGE_RELATIVE = "packages/bostan-eval-kernel"'));
});

test("Bostan eval package identity preserves the versioned wire schema",()=>{
 const source=read("packages/bostan-eval-kernel/src/index.ts");
 assert.ok(source.includes('packageName: "@bostan/eval-kernel"'));
 assert.ok(source.includes('schema: "paperclip.eval-kernel.compatibility.v1"'));
});

test("Runner import-boundary guard restricts old and Bostan workspace namespaces",()=>{
 const guard=read("packages/paperclip-runner/scripts/lib/forbidden-imports.mjs");
 assert.ok(guard.includes('"@bostan/"'));
 assert.ok(guard.includes('"@paperclipai/"'));
 assert.ok(guard.includes('const REVIEWED_EVAL_KERNEL = "@bostan/eval-kernel"'));
 assert.ok(guard.includes("isOwnedWorkspacePackage(specifier)"));
 assert.ok(guard.includes("isOwnedWorkspacePackage(name)"));
});
