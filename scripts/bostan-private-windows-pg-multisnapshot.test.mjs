import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  evaluateWindowsPgOrphanCheck as check,
  WINDOWS_PG_ORPHAN_CHECK_LINES as LINES,
  WINDOWS_PG_ORPHAN_REQUIRED_SNAPSHOTS as REQUIRED,
} from './bostan-private-windows-pg-orphan-proof.mjs';

const stdout=LINES.join('\r\n')+'\r\n';
const actual=(opts={})=>check({status:0,signal:null,errorCode:null,stdout,stderr:'',...opts});
test('three independent zero snapshots, exact receipt, clean exit qualify',()=>{
  assert.equal(REQUIRED,3);
  assert.equal(LINES.length,4);
  assert.deepEqual(actual(),{schema:'bostan.private-windows-pg-orphan-check.v1',noOrphanPostgresProcessVerified:true,outcome:'pass'});
});
test('legacy one-snapshot three-record receipt is not sufficient',()=>{
  const old=['BOSTAN_WINDOWS_PG_OWNED_PROCESSES=0','BOSTAN_WINDOWS_PG_UNINSPECTABLE=0','BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS'].join('\n')+'\n';
  assert.equal(actual({stdout:old}).noOrphanPostgresProcessVerified,false);
});
test('fewer, more or malformed snapshot count are rejected',()=>{
  for(const n of ['0','1','2','4','-1','3.0','03','3\t']){
    assert.equal(actual({stdout:stdout.replace('PG_SNAPSHOTS=3','PG_SNAPSHOTS='+n)}).noOrphanPostgresProcessVerified,false,n);
  }
});
test('any observed owned, foreign/uninspectable PostgreSQL worker denies',()=>{
  for(const [old,changed] of [['PROCESSES=0','PROCESSES=1'],['UNINSPECTABLE=0','UNINSPECTABLE=2']]){
    assert.equal(actual({stdout:stdout.replace(old,changed)}).noOrphanPostgresProcessVerified,false);
  }
});
test('reordered, duplicated, missing, whitespace and appended receipts denied',()=>{
  for(const out of [stdout+LINES[3]+'\n',stdout+'\n',stdout.slice(0,-1),
    [LINES[1],LINES[0],LINES[2],LINES[3]].join('\n')+'\n',
    LINES.slice(1).join('\n')+'\n','extra\n'+stdout,
    stdout.replace('=3','=3 '),stdout.replace('PROCESSES=0','PROCESSES=0\t')]){
    assert.equal(actual({stdout:out}).noOrphanPostgresProcessVerified,false);
  }
});
test('nonzero, timeout, signals, stderr and oversized output fail closed',()=>{
  for(const opts of [{status:1},{status:2},{status:null},{signal:'SIGKILL'},{errorCode:'ETIMEDOUT'},
    {stderr:'warning'},{stdout:'x'.repeat(8193)},{stdout:null},{stderr:null}]){
    assert.equal(actual(opts).noOrphanPostgresProcessVerified,false);
  }
});
test('failure diagnostics never echo supplied connection secrets',()=>{
  const secret='postgres://user:password@localhost:5432/db';
  const result=actual({stdout:stdout+secret});
  assert.equal(result.noOrphanPostgresProcessVerified,false);
  assert(!JSON.stringify(result).includes(secret));
  assert(Object.isFrozen(result));
});
test('scanner source takes three independent reads before emitting success',()=>{
  const source=readFileSync(fileURLToPath(new URL('./bostan-native-windows-postgres-no-orphans.ps1',import.meta.url)),'utf8');
  assert.match(source,/\$requiredSnapshots\s*=\s*3/);
  assert.match(source,/for\s*\(\$sample\s*=\s*0;\s*\$sample\s*-lt\s*\$requiredSnapshots;\s*\$sample\+\+\)/);
  assert.match(source,/if\s*\(\$sample\s*-gt\s*0\)\s*\{\s*Start-Sleep\s+-Milliseconds\s+250\s*\}/);
  const body=source.slice(source.indexOf('for ($sample = 0;'));
  assert(body.indexOf('Get-CimInstance Win32_Process')>0);
  assert(body.indexOf('Get-CimInstance Win32_Process')<body.indexOf('Write-Output ("BOSTAN_WINDOWS_PG_SNAPSHOTS='));
  assert.match(source,/\$owned \+= \$proc/);
  assert.match(source,/\$uninspected\+\+/);
  assert.match(source,/if \(\$owned.Count -ne 0 -or \$uninspected -ne 0\) \{ exit 1 \}/);
  assert.doesNotMatch(source,/\b(?:Stop-Process|taskkill|TerminateProcess|Remove-Item)\b/i);
});
