import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const runner=fileURLToPath(new URL('./bostan-local-http-postgres-smoke.sh',import.meta.url));
const scenario=fileURLToPath(new URL('./bostan-private-staged-authz-e2e.mjs',import.meta.url));
test('shared real PostgreSQL writes require dedicated opt-in mode, not inherited environment',()=>{
  const shell=readFileSync(runner,'utf8');
  assert.ok(shell.includes('--run-packed-authz-concurrent'));
  assert.ok(shell.includes('unset BOSTAN_AUTHZ_API_FIRST_ADMIN BOSTAN_AUTHZ_BROWSER_UI BOSTAN_AUTHZ_SHARED_DB_CONCURRENT'));
  assert.ok(shell.includes('if [ "$MODE" = "--run-packed-authz-concurrent" ]; then export BOSTAN_AUTHZ_SHARED_DB_CONCURRENT=1; fi'));
  assert.ok(shell.includes('BOSTAN_PACKED_SHARED_POSTGRES_CONCURRENT_WRITES_QUALIFIED'));
  // Native Windows may resolve bash.exe to WSL, which cannot open a D: path
  // without conversion; the same *real shell CLI* is separately executed by
  // native Linux/WSL2 and macOS. Windows still validates source contracts.
  if(process.platform!=='win32'){
    const help=spawnSync('bash',[runner,'--help'],{encoding:'utf8',timeout:5000});
    assert.equal(help.status,0);
    assert.ok(help.stdout.includes('--run-packed-authz-concurrent'));
    for(const args of [['--run-packed-authz-concurrent','--publish'],['--publish'],[]]){
      const result=spawnSync('bash',[runner,...args],{encoding:'utf8',timeout:5000});
      assert.equal(result.status,2);
    }
  }
});
test('shared-PG stress tests actual HTTP client overlap, scoped record readbacks and denied writes',()=>{
  const source=readFileSync(scenario,'utf8');
  for(const marker of [
    "if(env.BOSTAN_AUTHZ_SHARED_DB_CONCURRENT==='1')",
    "Array.from({length:12}",
    "await Promise.all(prepared.map",
    "Math.max(...committed.map(x=>x.began))",
    "Math.min(...committed.map(x=>x.ended))",
    "new Set(committed.map(x=>x.id)).size!==committed.length",
    "const [aRows,bRows]=await Promise.all",
    "ownA.size!==6||ownB.size!==6",
    "BOSTAN_SHARED_REAL_POSTGRES_CONCURRENT_WRITES_PASS",
    "concurrentForbiddenWritesDenied:2",
  ]) assert.ok(source.includes(marker),marker);
  assert.doesNotMatch(source,/console\.log\([^\n]*invitation\.token/);
});
