import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  checkBostanWindowsDisk,assertBostanWindowsDisk
} from "./bostan-private-windows-disk-admission.mjs";

const gib=1024n**3n;
const params=(space,extras={})=>({
  platform:"win32",workspace:"D:\\Bostan-B091-qa",
  systemDrive:"C:",tempDir:"D:\\Bostan-B091-temp",
  statfs:(vol)=>{
    const capacity=space[vol.toUpperCase()];
    if(capacity===undefined)throw Error("fake drive unavailable");
    return {bavail:BigInt(capacity),bsize:gib};
  },...extras,
});
test("low Windows system drive fails closed while workspace has space",()=>{
  const result=checkBostanWindowsDisk(params({"C:\\":0,"D:\\":11}));
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"low_disk");
  assert.equal(result.checks.length,2);
  assert.deepEqual(result.checks.map(x=>x.purpose),["system","workspace+temp"]);
  assert.equal(result.checks[0].sufficient,false);
  assert.equal(result.checks[1].sufficient,true);
});
test("all Windows volumes meet 2 GiB system and 6 GiB temporary/checkout floor",()=>{
  const result=assertBostanWindowsDisk(params({"C:\\":2,"D:\\":6}));
  assert.equal(result.allowed,true);
  assert.equal(result.reason,"pass");
  assert.equal(result.checks[0].requiredGiB,2);
  assert.equal(result.checks[1].requiredGiB,6);
});
test("shared system/workspace/temp drive is checked against maximum required headroom",()=>{
  const result=checkBostanWindowsDisk(params({"C:\\":5},{
    workspace:"C:\\Bostan-B091-qa",tempDir:"C:\\Bostan-B091-temp"}));
  assert.equal(result.allowed,false);
  assert.equal(result.checks.length,1);
  assert.equal(result.checks[0].purpose,"system+workspace+temp");
  assert.equal(result.checks[0].requiredGiB,6);
});
test("separate temporary volume must also pass and cannot silently fall back",()=>{
  const result=checkBostanWindowsDisk(params({"C:\\":5,"D:\\":10,"E:\\":1},{
    tempDir:"E:\\Bostan-B091-temp"}));
  assert.equal(result.reason,"low_disk");
  assert.equal(result.checks.length,3);
  assert.equal(result.checks[2].purpose,"temp");
  assert.equal(result.checks[2].sufficient,false);
});
test("unknown, invalid and unreadable volumes always refuse",()=>{
  for(const options of [
    params({"C:\\":2,"D:\\":10},{systemDrive:"UNC"}),
    params({"C:\\":2,"D:\\":10},{tempDir:"/tmp/misplaced"}),
    params({"C:\\":2}),
    params({"C:\\":2,"D:\\":10},{statfs:()=>{throw Error("private path unavailable");}}),
    params({"C:\\":2,"D:\\":10},{statfs:()=>({bavail:-1n,bsize:gib})}),
  ]){
    const result=checkBostanWindowsDisk(options);
    assert.equal(result.allowed,false);
    assert.throws(()=>assertBostanWindowsDisk(options),/disk admission refused/);
    assert.equal(JSON.stringify(result).includes("private path unavailable"),false);
  }
});
test("non-Windows returns a refusal, no disk inspection",()=>{
  const result=checkBostanWindowsDisk(params({},{
    platform:"darwin",statfs:()=>{throw Error("must not inspect filesystem");}}));
  assert.equal(result.reason,"not_windows");
});
test("read-only CLI default and unknown actions",()=>{
  const file=fileURLToPath(new URL("./bostan-private-windows-disk-admission.mjs",import.meta.url));
  const plan=spawnSync(process.execPath,[file],{encoding:"utf8"});
  assert.equal(plan.status,0);
  assert.equal(JSON.parse(plan.stdout).checking,false);
  const unknown=spawnSync(process.execPath,[file,"--publish"],{encoding:"utf8"});
  assert.equal(unknown.status,2);
});

test("real Windows auth/DB and localhost QA runners enforce disk admission before any DB startup",()=>{
  const auth=readFileSync(new URL("./bostan-private-windows-auth-db.mjs",import.meta.url),"utf8");
  const live=readFileSync(new URL("./bostan-private-windows-live-http.mjs",import.meta.url),"utf8");
  const authAdmission=auth.indexOf("checkBostanWindowsDisk({workspace:root,tempDir:tmp})");
  const liveAdmission=live.indexOf("checkBostanWindowsDisk({workspace:root,tempDir:temp})");
  assert.ok(authAdmission>0);
  assert.ok(authAdmission<auth.indexOf("pinned plugin SDK and legal assets"));
  assert.ok(liveAdmission>0);
  assert.ok(liveAdmission<live.indexOf("const home=mkdtempSync"));
  assert.ok(liveAdmission<live.indexOf("startEmbeddedPostgresTestDatabase"));
  assert.match(auth,/BOSTAN_WINDOWS_AUTH_DB_STORAGE_REFUSED/);
  assert.match(live,/BOSTAN_WINDOWS_LIVE_STORAGE_REFUSED/);
});
