import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const file=fileURLToPath(new URL("./bostan-private-mac-source-import.mjs",import.meta.url));
const source=readFileSync(file,"utf8");
const invoke=(...args)=>spawnSync(process.execPath,[file,...args],{
  encoding:"utf8",timeout:6000,
  env:{...process.env,BOSTAN_MAC_SOURCE_IMPORT_QA:""},
});
test("default and plan mode are inert, private, and not release qualified",()=>{
  for(const args of [[],["--plan"]]){
    const r=invoke(...args);
    assert.equal(r.status,0);
    const p=JSON.parse(r.stdout);
    assert.equal(p.run,false);
    assert.equal(p.macSourceImportQualified,false);
    assert.equal(p.releaseQualified,false);
    assert.equal(p.httpQualified,false);
    assert.equal(p.publishes,false);
  }
});
test("refuses unknown actions and publication",()=>{
  for(const arg of ["--publish","--deploy","--install","--run-now"]){
    const r=invoke(arg);
    assert.equal(r.status,2);
    assert.match(r.stderr,/Usage:/);
  }
});
test("requires opt-in before any real source import",()=>{
  const r=invoke("--run");
  assert.equal(r.status,2);
  assert.match(r.stderr,/unsafe or unowned fixture/);
  assert.doesNotMatch(r.stdout,/BOSTAN_MAC_IMPORT_COMPLETE_MS/);
});
test("strict test-owned home and bounded private import with no credentials",()=>{
  assert.match(source,/BOSTAN_MAC_SOURCE_IMPORT_QA==="SYNTHETIC_ONLY"/);
  assert.match(source,/mkdtempSync\("\/private\/tmp\/bostan-mac-source-qa-"/);
  assert.match(source,/rmSync\(home,\{recursive:true,force:true\}\)/);
  assert.match(source,/timeout:60000/);
  assert.match(source,/PAPERCLIP_HOME:home/);
  assert.match(source,/process\.argv\[1\]="bostan-import-only"/);
  assert.match(source,/--import","tsx"/);
  assert.doesNotMatch(source,/\.\.\.process\.env|process\.env\.OPENAI_API_KEY|taskkill|Stop-Process/);
});
