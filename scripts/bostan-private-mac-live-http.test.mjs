import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const file=fileURLToPath(new URL("./bostan-private-mac-live-http.mjs",import.meta.url));
const source=readFileSync(file,"utf8");
const run=(arg,env={})=>spawnSync(process.execPath,[file,...(arg?[arg]:[])],{
  encoding:"utf8",timeout:6000,
  env:{...process.env,BOSTAN_MAC_HTTP_QA:"",BOSTAN_MAC_HTTP_QA_CHILD:"",...env},
});

test("read-only default and plan never claim a release or browser qualification",()=>{
  for(const arg of [undefined,"--plan"]){
    const result=run(arg);
    assert.equal(result.status,0);
    const receipt=JSON.parse(result.stdout);
    assert.equal(receipt.run,false);
    assert.equal(receipt.macAuthenticatedHttpQualified,false);
    assert.equal(receipt.releaseQualified,false);
    assert.equal(receipt.windowsQualified,false);
    assert.equal(receipt.browserQualified,false);
    assert.equal(receipt.agentQualified,false);
    assert.equal(receipt.publishes,false);
  }
});
test("reject invalid, deployment and publishing actions",()=>{
  for(const option of ["--publish","--deploy","--install","--cleanup"]){
    const result=run(option);
    assert.equal(result.status,2);
    assert.match(result.stderr,/Usage:/);
  }
});
test("reject real localhost test without explicit synthetic opt-in",()=>{
  const result=run("--run");
  assert.equal(result.status,2);
  assert.match(result.stderr,/refuses unsafe or unowned fixture/);
});
test("reject direct child invocation, even when child intent is supplied",()=>{
  const result=run("--child",{BOSTAN_MAC_HTTP_QA_CHILD:"SYNTHETIC_ONLY"});
  assert.equal(result.status,2);
  assert.match(result.stderr,/refuses unsafe synthetic invocation/);
});
test("fail-closed evidence includes termination and real post-claim health",()=>{
  assert.match(source,/BOSTAN_MAC_HTTP_QA!=="SYNTHETIC_ONLY"/);
  assert.match(source,/TMPDIR:home/);
  assert.match(source,/PAPERCLIP_HOME:home/);
  assert.match(source,/BOSTAN_MAC_HTTP_QA_MARKER:marker/);
  assert.match(source,/timeout:110000/);
  assert.match(source,/stdio:\["ignore",fd,fd\]/);
  assert.match(source,/result\.status===0&&!result\.error&&!result\.signal/);
  assert.match(source,/withinBudget&&flags\.every\(Boolean\)/);
  assert.match(source,/bootstrapStatus!=="ready"/);
  assert.match(source,/server\.shutdown\("SIGTERM"\)/);
  assert.match(source,/db\.cleanup\(\)/);
  assert.match(source,/process\.exit\(process\.exitCode\|\|0\)/);
  assert.doesNotMatch(source,/\.\.\.process\.env|console\.error\(error\)|JSON\.stringify\(process\.env\)/);
});
