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
  const success=source.indexOf("if(qualified){",source.indexOf("const qualified=proof.windowsAuthenticatedHttpQualified;"));
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
  assert.match(source,/postgresProcessTreeVerified=pgProof.noOrphanPostgresProcessVerified/);
  assert.doesNotMatch(source,/if\(existsSync\(join\(home,"BOSTAN_QA_OWNED"\)\)&&lstatSync\(home\)/);
});
test("native Windows heavy work remains gated by disk and disposable ownership",()=>{
  const resourceGate=source.indexOf("checkBostanWindowsDisk({workspace:root,tempDir:temp})");
  const memoryGate=source.indexOf("const memoryAdmission=checkBostanWindowsMemory()");
  const home=source.indexOf('const home=mkdtempSync(');
  const database=source.indexOf("startEmbeddedPostgresTestDatabase");
  assert.ok(resourceGate>0&&resourceGate<memoryGate&&memoryGate<home&&home<database);
  assert.match(source,/^if\(process\.platform!=="win32"/m);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_STORAGE_REFUSED/);
});

test("failed child spawn cannot produce a green HTTP or cleanup receipt",()=>{
  assert.match(source,/childExited:\(\)=>serverObserver\.exitedOrFailed/);
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
  assert.equal(stages.length,16);
  for(const stage of stages) assert.ok(source.includes('markHttpStage("'+stage+'")'),stage);
  assert.match(source,/evaluateWindowsPrivateHttpEvidence\(\{/);
  assert.match(source,/events:httpEvents,httpComplete:completedHttpChecks,childClosed:serverClosed/);
  assert.match(source,/const qualified=proof\.windowsAuthenticatedHttpQualified/);
  assert.match(source,/noOrphanPostgresProcessVerified:false|\.\.\.proof/);
});

test("native Windows startup uses one bounded localhost deadline rather than 180 slow probes",()=>{
  assert.match(source,/waitForWindowsPrivateHealth\(\{/);
  assert.match(source,/endpoint:origin\+"\/api\/health"/);
  assert.match(source,/childExited:\(\)=>serverObserver\.exitedOrFailed/);
  assert.match(source,/if\(!healthProbe\.healthy\)/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_STARTUP_OUTCOME/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_STARTUP_PROBES/);
  assert.doesNotMatch(source,/for\(let i=0;i<180;i\+\+\)/);
  assert.doesNotMatch(source,/const sleep=ms=>/);
});

test("native owned PostgreSQL scan is required after database cleanup and before receipt",()=>{
  const db=source.indexOf("await db.cleanup();");
  const pg=source.indexOf("const pgProof=evaluateWindowsPgOrphanCheck({");
  const fixture=source.indexOf("rmSync(home,");
  const receipt=source.indexOf("const qualified=proof.windowsAuthenticatedHttpQualified;");
  assert.ok(db>0&&pg>db&&fixture>pg&&receipt>fixture);
  assert.match(source,/spawnSync\("powershell.exe",\[/);
  assert.match(source,/bostan-native-windows-postgres-no-orphans\.ps1/);
  assert.match(source,/timeout:20000,maxBuffer:8192/);
  assert.match(source,/if\(serverClosed&&dbCleaned&&postgresProcessTreeVerified&&existsSync\(marker\)/);
  assert.match(source,/markHttpStage\("BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS"\)/);
  assert.match(source,/postgresCleaned:dbCleaned,postgresProcessTreeVerified/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_POSTGRES_PROCESS_PROOF/);
});

test("native Windows RAM is checked again after PG and before server spawn",()=>{
  const db=source.indexOf('db=await startEmbeddedPostgresTestDatabase(');
  const postDb=source.indexOf("const afterDbMemory=checkBostanWindowsMemory()");
  const spawn=source.indexOf("server=spawn(process.execPath,");
  const final=source.indexOf("}finally{");
  assert.ok(db>0&&postDb>db&&spawn>postDb&&final>spawn);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_MEMORY_REFUSED/);
  assert.match(source,/BOSTAN_WINDOWS_LIVE_MEMORY_POSTGRES_REFUSED/);
  assert.match(source,/if\(db&&serverClosed&&dbCleaned\)\{/);
  assert.match(source,/serverStartedAt>0\?Math\.round/);
  assert.match(source,/serverStartedAt>0\?Math\.round\(\(Date\.now\(\)-serverStartedAt\)\/1000\):"not_started"/);
});
