import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
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
test("exact PowerShell records reject blank lines, whitespace and missing final newline",()=>{
  for(const output of [
    proof+"\r\n",proof+"\n",proof.replace(/\r\n$/, ""),
    proof.replace("PROCESSES=0","PROCESSES=0 "),
    proof.replace("UNINSPECTABLE=0","UNINSPECTABLE=0\t"),
    proof.replace("\r\n","\n\n"),
    "\n"+proof,
  ]) assert.equal(checkResult({stdout:output}).noOrphanPostgresProcessVerified,false);
  assert.equal(checkResult({stdout:LINES.join("\n")+"\n"}).noOrphanPostgresProcessVerified,true);
});
test("native scanner refuses all unattributed PostgreSQL executables and remains read-only",()=>{
  const source=readFileSync(fileURLToPath(new URL("./bostan-native-windows-postgres-no-orphans.ps1",import.meta.url)),"utf8");
  assert.match(source,/Get-CimInstance Win32_Process -Filter "Name = 'postgres\.exe'"/);
  assert.match(source,/if \(\$full\.StartsWith\(\$rootPrefix, \[System\.StringComparison\]::OrdinalIgnoreCase\)\) \{/);
  assert.match(source,/\$owned \+= \$proc\s*\} else \{[\s\S]*?\$uninspected\+\+/);
  assert.match(source,/IsNullOrWhiteSpace\(\$exe\)[\s\S]*?\$uninspected\+\+/);
  assert.match(source,/if \(\$owned\.Count -ne 0 -or \$uninspected -ne 0\) \{ exit 1 \}/);
  assert.doesNotMatch(source,/\b(?:Stop-Process|taskkill|TerminateProcess|Remove-Item)\b/i);
});
