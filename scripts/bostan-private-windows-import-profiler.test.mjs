import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {pathToFileURL,fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {makeModuleProfiler,safeModuleName} from "./bostan-private-windows-import-profiler.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const profiler=fileURLToPath(new URL("./bostan-private-windows-import-profiler.mjs",import.meta.url));
test("safe module names never expose outside paths or URLs",()=>{
  assert.equal(safeModuleName("node:fs",root),"virtual_or_builtin");
  assert.equal(safeModuleName(pathToFileURL(path.join(root,"server/src/app.ts")).href,root),
    "server/src/app.ts");
  assert.equal(safeModuleName(pathToFileURL(path.join(root,"node_modules/secret.js")).href,root),
    "third_party");
  assert.equal(safeModuleName(pathToFileURL(path.join(os.tmpdir(),"private-user.env")).href,root),
    "external_file");
  assert.equal(safeModuleName("http://private.example/key"),"virtual_or_builtin");
});
test("real hooks can be mocked without resolving imports or running a server",()=>{
  let hooks,clock=0;
  const reports=[];
  const tool=makeModuleProfiler({register(value){hooks=value;},now:()=>++clock,
    emit:x=>reports.push(x),root,every:2});
  const url=pathToFileURL(path.join(root,"server/src/app.ts")).href;
  assert.deepEqual(hooks.resolve("any",{},()=>({url})),{url});
  assert.deepEqual(hooks.load(url,{},()=>({format:"module"})),{format:"module"});
  hooks.load("node:fs",{},()=>({format:"builtin"}));
  assert.equal(reports.length,1);
  assert.equal(reports[0].reason,"periodic");
  assert.equal(reports[0].resolveCount,1);
  assert.equal(reports[0].loadCount,2);
  assert.equal(reports[0].runtimeEvaluationTimed,false);
  assert.ok(reports[0].topLoads.some(x=>x.module==="server/src/app.ts"));
  assert.equal(reports[0].topLoads.some(x=>x.module.includes(os.homedir())),false);
  tool.emitFinal();
  assert.equal(reports[1].reason,"exit");
});
test("hook failures propagate while still counted",()=>{
  let hooks;const profile=makeModuleProfiler({register:h=>{hooks=h;}});
  assert.throws(()=>hooks.load("node:fs",{},()=>{throw Error("fixture-error");}),/fixture-error/);
  assert.equal(profile.snapshot("manual").errorCount,1);
});
function subprocess(allow){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"bostan-profile-fixture-"));
  const marker=path.join(directory,"BOSTAN_QA_OWNED");
  fs.writeFileSync(marker,"BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
  try{
    const env={...process.env,
      BOSTAN_PRIVATE_QA_ENTRY:allow?"B087_TEST_ONLY":"DISABLED",
      BOSTAN_PRIVATE_QA_MARKER:marker,
      PAPERCLIP_DEPLOYMENT_MODE:"authenticated",
      PAPERCLIP_DEPLOYMENT_EXPOSURE:"private",
      DATABASE_URL:"postgresql://synthetic:token@127.0.0.1:54321/fixture",
    };
    return spawnSync(process.execPath,[
      "--import",pathToFileURL(profiler).href,"--input-type=module","-e",
      "await import('node:fs/promises'); await import('node:crypto');"],
      {cwd:root,env,encoding:"utf8",timeout:12000});
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
test("module hooks emit an actual bounded native Node load receipt only with a synthetic owned marker",()=>{
  const received=subprocess(true);
  assert.equal(received.status,0,received.stderr.slice(-300));
  const markers=received.stderr.split("\n").filter(s=>s.startsWith("BOSTAN_WIN_IMPORT_PROFILE="));
  assert.ok(markers.length>0,"expected real Node loader profile");
  const report=JSON.parse(markers.at(-1).slice("BOSTAN_WIN_IMPORT_PROFILE=".length));
  assert.equal(report.schema,"bostan.private-module-load-profile.v1");
  assert.equal(report.reason,"exit");
  assert.ok(report.loadCount>0);
  assert.equal(report.moduleLoadOnly,true);
  assert.ok(!received.stderr.includes("synthetic:token"));
  assert.ok(!received.stderr.includes(directoryPrefix()));
});
function directoryPrefix(){return os.homedir();}
test("profiler remains entirely inert without the private synthetic opt-in",()=>{
  const received=subprocess(false);
  assert.equal(received.status,0);
  assert.doesNotMatch(received.stderr,/BOSTAN_WIN_IMPORT_PROFILE=/);
});
