import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {formatLocalPostgresCliFailure as classify} from './bostan-local-postgres-cli-failure.mjs';
const secret = 'postgres://password:very-sensitive@localhost/private';
test('real subprocess failure secret in stderr is never printed by classifier',()=>{
  const result=spawnSync(process.execPath,['-e',`process.stderr.write(${JSON.stringify(secret)});process.exit(42)`],{encoding:'utf8'});
  assert.equal(result.status,42);
  const safe=classify({command:'psql',...result,error:result.error});
  assert.equal(safe,'Bostan local PostgreSQL QA child failed (tool=psql,exit=42,code=unknown,signal=none)');
  assert.equal(safe.includes(secret),false);
});
test('real subprocess failure secret in stdout never reaches error',()=>{
  const result=spawnSync(process.execPath,['-e',`process.stdout.write(${JSON.stringify(secret)});process.exit(16)`],{encoding:'utf8'});
  const safe=classify({command:'pg_dump',...result,error:result.error});
  assert.equal(safe.includes(secret),false);assert.match(safe,/tool=pg_dump,exit=16/);
});
test('unexpected executable path or embedded credentials are classified without echoing',()=>{
  const safe=classify({command:'/home/operator/secrets/'+secret,status:1,error:{code:'ARBITRARY:'+secret,message:secret}});
  assert.equal(safe.includes(secret),false);assert.match(safe,/tool=other,exit=1,code=unknown/);
});
test('known command names retain safe classification only',()=>{
  for(const kind of ['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore','pnpm'])
    assert.match(classify({command:kind,status:1}),new RegExp('tool='+kind+','));
});
test('exit value is bounded and malformed input cannot inject diagnostics',()=>{
  for(const status of [null,undefined,-1,256,100000,1.2,secret,Infinity]){
    const safe=classify({command:'psql',status});assert.match(safe,/exit=unknown/);assert(!safe.includes(secret));
  }
});
test('only supported OS error codes and signals are exposed',()=>{
  const safe=classify({command:'pg_ctl',status:null,signal:'SIGKILL',error:{code:'ETIMEDOUT'}});
  assert.match(safe,/code=ETIMEDOUT,signal=SIGKILL/);
  const bad=classify({command:'pg_ctl',signal:secret,error:{code:secret}});
  assert.match(bad,/code=unknown,signal=none/);assert(!bad.includes(secret));
});
test('dangerous getters in injected error objects cannot escape',()=>{
  const hostile={get code(){throw Error(secret)}};
  const safe=classify({command:'psql',status:1,error:hostile});
  assert.match(safe,/code=unknown/);assert(!safe.includes(secret));
});
test('no raw subprocess diagnostics or paths appear in any output',()=>{
  const safe=classify({command:'pnpm.cmd /c '+secret,status:0,error:{message:secret,code:'EUNKNOWN'},signal:secret,stderr:secret,stdout:secret,args:[secret]});
  assert(safe.length<160);assert(!safe.includes(secret));
});
