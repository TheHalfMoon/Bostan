import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {evaluateWindowsPgOrphanCheck as check, WINDOWS_PG_ORPHAN_CHECK_LINES as LINES} from "./bostan-private-windows-pg-orphan-proof.mjs";

const proof = LINES.join("\r\n")+"\r\n";
const checkResult = input => check({status:0,signal:null,errorCode:null,stdout:proof,stderr:"",...input});

test("strict zero-owned and zero-uninspectable proof qualifies a clean process tree",()=>{
  const v=checkResult();
  assert.equal(LINES.length,3);
  assert.deepEqual(v,{
    schema:"bostan.private-windows-pg-orphan-check.v1",
    noOrphanPostgresProcessVerified:true,outcome:"pass",
  });
  assert.equal(Object.isFrozen(v),true);
});
test("real subprocess clean exit alone cannot substitute missing proof",()=>{
  const child=spawnSync(process.execPath,["-e","process.exit(0)"],{encoding:"utf8",timeout:5000});
  const v=check({status:child.status,signal:child.signal,stdout:child.stdout,stderr:child.stderr,errorCode:child.error?.code});
  assert.equal(child.status,0);
  assert.equal(v.noOrphanPostgresProcessVerified,false);
});
test("any nonzero PostgreSQL worker or uninspectable process fails",()=>{
  for(const output of [
    proof.replace("PROCESSES=0","PROCESSES=1"),
    proof.replace("UNINSPECTABLE=0","UNINSPECTABLE=1"),
    proof.replace("PROCESSES=0","PROCESSES=-1"),
  ]) assert.equal(checkResult({stdout:output}).noOrphanPostgresProcessVerified,false);
});
test("duplicate, reordered, missing and prefixed success markers fail",()=>{
  for(const output of [
    LINES.slice(0,2).join("\n"),proof+LINES[2]+"\n",
    [LINES[1],LINES[0],LINES[2]].join("\n"),
    "SAFE_START\n"+proof,proof+"PG_DONE\n",
    proof.replace("POSTGRES_NO_ORPHANS_PASS","POSTGRES_NO_ORPHANS_PASS forged"),
  ]) assert.equal(checkResult({stdout:output}).noOrphanPostgresProcessVerified,false);
});
test("nonclean process exit, timeout, signal and stderr fail",()=>{
  for(const opts of [
    {status:1},{status:2},{status:null},{signal:"SIGTERM"},
    {errorCode:"ETIMEDOUT"},{errorCode:"ENOENT"},
    {stderr:"warning"},{stdout:42},{stderr:null},
    {stdout:"x".repeat(8193)},
  ]) assert.equal(checkResult(opts).noOrphanPostgresProcessVerified,false);
});
test("no secrets or input text are ever echoed by failure receipts",()=>{
  const key="postgres://user:password@127.0.0.1:64321/private";
  const v=checkResult({stdout:proof+key});
  assert.equal(v.noOrphanPostgresProcessVerified,false);
  assert.equal(JSON.stringify(v).includes(key),false);
});
