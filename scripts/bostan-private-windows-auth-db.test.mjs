import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
const file=fileURLToPath(new URL("./bostan-private-windows-auth-db.mjs",import.meta.url));
const src=readFileSync(file,"utf8");
const live=fileURLToPath(new URL("./bostan-private-windows-live-http.mjs",import.meta.url));
const liveSource=readFileSync(live,"utf8");
const invoke=(...args)=>spawnSync(process.execPath,[file,...args],{encoding:"utf8"});
test("default is read-only, private and explicitly opted in",()=>{
  const out=invoke();
  assert.equal(out.status,0);
  const j=JSON.parse(out.stdout);
  assert.equal(j.run,false);
  assert.equal(j.releaseQualified,false);
  assert.equal(j.backendProductionServerQualified,false);
  assert.equal(j.authBrowserQualified,false);
  assert.equal(j.publishes,false);
});
test("reject unexpected args without starting a database",()=>{
  const out=invoke("--publish");
  assert.equal(out.status,2);
  assert.match(out.stderr,/Usage:/);
});
test("refuse non-Windows host before any dependency or process activity",()=>{
  if(process.platform==="win32")return;
  const out=invoke("--run");
  assert.equal(out.status,2);
  assert.match(out.stderr,/non-Windows/);
});
test("script keeps real HTTP/DB tests and process ownership boundaries",()=>{
  assert.match(src,/bootstrap-claim-routes\.test\.ts/);
  assert.match(src,/auth-routes\.test\.ts/);
  assert.match(src,/src\/client\.test\.ts/);
  assert.match(src,/bostan-native-windows-postgres-no-orphans\.ps1/);
  assert.match(src,/Bostan-B0/);
  assert.match(src,/PAPERCLIP_CLOUD_/);
  assert.match(src,/BOSTAN_WIN_AUTH_DB_REAL_POSTGRES_PASS/);
  assert.match(src,/npm_config_offline/);
  assert.doesNotMatch(src,/taskkill|Stop-Process|\bpublish\s*\(/);
});

test("live Windows server proof is inert by default",()=>{
  const got=spawnSync(process.execPath,[live],{encoding:"utf8"});
  assert.equal(got.status,0);
  assert.equal(JSON.parse(got.stdout).run,false);
  assert.match(liveSource,/BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS/);
});
test("live server QA rejects publication and non-Windows execution",()=>{
  const invalid=spawnSync(process.execPath,[live,"--publish"],{encoding:"utf8"});
  assert.equal(invalid.status,2);
  if(process.platform!=="win32"){
    const got=spawnSync(process.execPath,[live,"--run"],{encoding:"utf8"});
    assert.equal(got.status,2);
    assert.match(got.stderr,/isolated Bostan/);
  }
});

test("Windows live probe separates static imports from runtime startup",()=>{
  const stage=fileURLToPath(new URL("./bostan-private-windows-server-entry.mjs",import.meta.url));
  const source=readFileSync(stage,"utf8");
  assert.match(source,/BOSTAN_WIN_SERVER_STAGE=/);
  assert.match(source,/static_import_start/);
  assert.match(source,/static_import_complete/);
  assert.match(source,/runtime_start/);
  assert.match(source,/runtime_ready/);
  assert.match(source,/runtime_failed/);
  assert.match(liveSource,/BOSTAN_WINDOWS_LIVE_IMPORT_STAGE/);
  assert.match(liveSource,/BOSTAN_WINDOWS_LIVE_HTTP_OBSERVATION/);
  assert.match(liveSource,/BOSTAN_WINDOWS_LIVE_SERVER_SECONDS/);
  assert.match(liveSource,/if\(failed\)process\.exit\(1\)/);
  assert.doesNotMatch(source,/console\.error\(error\)|JSON\.stringify\(process\.env\)/);
});

test("Windows staged server entry refuses any direct or unsentinelized invocation",()=>{
  const stage=fileURLToPath(new URL("./bostan-private-windows-server-entry.mjs",import.meta.url));
  const direct=spawnSync(process.execPath,[stage],{encoding:"utf8",timeout:6000,
    env:{...process.env,BOSTAN_PRIVATE_QA_ENTRY:""}});
  assert.equal(direct.status,2);
  assert.match(direct.stderr,/unsafe synthetic test fixture/);
  assert.match(liveSource,/BOSTAN_PRIVATE_QA_ENTRY/);
  assert.match(liveSource,/BOSTAN_PRIVATE_QA_MARKER/);
});
