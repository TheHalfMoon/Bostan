import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const file=fileURLToPath(new URL("./bostan-private-windows-live-http.mjs",import.meta.url));
const source=readFileSync(file,"utf8");

test("default plan is inert and does not claim Windows HTTP qualification",()=>{
  const p=spawnSync(process.execPath,[file,"--plan"],{encoding:"utf8",timeout:8000});
  assert.equal(p.status,0);
  const receipt=JSON.parse(p.stdout);
  assert.equal(receipt.run,false);
  assert.equal(receipt.releaseQualified,false);
  assert.equal(receipt.authenticatedBrowserQualified,false);
  assert.equal(receipt.publishes,false);
});
test("unknown deploy and publish options are rejected",()=>{
  for(const arg of ["--publish","--deploy","--cleanup"]){
    const r=spawnSync(process.execPath,[file,arg],{encoding:"utf8",timeout:8000});
    assert.equal(r.status,2);
  }
});
test("the real app child receives only isolated environment keys",()=>{
  assert.match(source,/buildPrivateWindowsHttpQaEnvironment\(\{/);
  assert.match(source,/inherited:process\.env,home,origin,connectionString:db\.connectionString/);
  assert.match(source,/mkdirSync\(env\.APPDATA/);
  assert.match(source,/mkdirSync\(env\.LOCALAPPDATA/);
  assert.doesNotMatch(source,/const env=\{\.\.\.process\.env/);
  assert.doesNotMatch(source,/stdio:\["inherit"/);
});
test("success is reported only after real server exit and owned database cleanup",()=>{
  const success=source.indexOf("windowsAuthenticatedHttpQualified:true");
  const final=source.indexOf("}finally{");
  const pg=source.indexOf("await db.cleanup()",final);
  const home=source.indexOf("rmSync(home,",final);
  const qualified=source.indexOf("const qualified=proof.windowsAuthenticatedHttpQualified;");
  assert.ok(final>0&&pg>final&&home>pg&&qualified>home&&success>qualified);
  assert.match(source,/serverObserver=observeOwnedQaChild\(server\)/);
  assert.match(source,/const childState=await serverObserver\.stop\(\)/);
  assert.match(source,/serverClosed=childState\.closed&&!childState\.spawnError/);
  assert.match(source,/if\(childState\.forceUsed\)/);
  assert.doesNotMatch(source,/const stopped=\(\)=>server\.exitCode/);
  assert.match(source,/readFileSync\(marker,"utf8"\)==="BOSTAN_PRIVATE_SYNTHETIC_ONLY"\+String\.fromCharCode\(10\)/);
  assert.match(source,/manualOwnedFixtureInspectionRequired:!ownedHomeCleaned/);
  assert.match(source,/noOrphanPostgresProcessVerified:false/);
  assert.doesNotMatch(source,/if\(existsSync\(join\(home,"BOSTAN_QA_OWNED"\)\)&&lstatSync\(home\)/);
});
test("native Windows heavy work remains gated by disk and disposable ownership",()=>{
  const resourceGate=source.indexOf("checkBostanWindowsDisk({workspace:root,tempDir:temp})");
  const home=source.indexOf('const home=mkdtempSync(');
  const database=source.indexOf("startEmbeddedPostgresTestDatabase");
  assert.ok(resourceGate>0&&resourceGate<home&&resourceGate<database);
  assert.match(source,/^if\(process\.platform!=="win32"/m);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_STORAGE_REFUSED/);
});

test("failed child spawn cannot produce a green HTTP or cleanup receipt",()=>{
  assert.match(source,/if\(serverObserver\.exitedOrFailed\)break/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_SERVER_SPAWN_FAILED/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_SERVER_TEARDOWN_UNCERTAIN/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_SERVER_FORCE_TERMINATION/);
  assert.match(source,/if\(serverClosed\)\{/);
  const observer=source.indexOf("serverObserver=observeOwnedQaChild(server)");
  const streams=source.indexOf("for(const stream of [server.stdout,server.stderr])");
  assert.ok(observer>0&&observer<streams);
});

test("real Windows first-admin steps bind synthetic user and refuse anonymous or replay",()=>{
  for(const pattern of [
    /anonymousClaim\.status!==401/,
    /sessionBody\?\.user\?\.id!==body\.user\.id/,
    /sessionBody\?\.user\?\.email!==email/,
    /sessionBody\?\.session\?\.userId!==body\.user\.id/,
    /hostileOrigin\.status!==403/,
    /forgedReferer\.status!==403/,
    /noOrigin\.status!==403/,
    /pendingBody\?\.bootstrapStatus!=="bootstrap_pending"/,
    /claimedBody\?\.claimed!==true/,
    /claimedBody\?\.userId!==body\.user\.id/,
    /repeat\.status!==409/,
    /bootstrapStatus!=="ready"/,
  ]) assert.match(source,pattern);
});
test("the complete Windows proof is exact ordered and required for the green receipt",async()=>{
  const {WINDOWS_HTTP_REQUIRED_STAGES:stages}=
    await import("./bostan-private-windows-http-evidence.mjs");
  assert.equal(stages.length,15);
  for(const stage of stages) assert.ok(source.includes('markHttpStage("'+stage+'")'),stage);
  assert.match(source,/evaluateWindowsPrivateHttpEvidence\(\{/);
  assert.match(source,/events:httpEvents,httpComplete:completedHttpChecks,childClosed:serverClosed/);
  assert.match(source,/const qualified=proof\.windowsAuthenticatedHttpQualified/);
  assert.match(source,/noOrphanPostgresProcessVerified:false|\.\.\.proof/);
});
