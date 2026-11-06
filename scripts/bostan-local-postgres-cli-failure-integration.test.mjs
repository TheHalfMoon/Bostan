import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {formatLocalPostgresCliFailure} from './bostan-local-postgres-cli-failure.mjs';
const source=readFileSync(new URL('./bostan-local-postgres-migration-qualification.mjs',import.meta.url),'utf8');
const begin=source.indexOf('function exec(command, args, options = {}) {');
const end=source.indexOf('\n\nasync function availablePort()',begin);
function runWithSpawn(spawnSync) {
  assert(begin>=0 && end>begin && end-begin<3000);
  const script=source.slice(begin,end)+'\nexec';
  return vm.runInNewContext(script,{spawnSync,root:'/tmp/isolated',process:{env:{}},formatLocalPostgresCliFailure,Error});
}
const secret='postgres://user:privatepassword@localhost/a';
test('source-integrated child stderr and stdout cannot escape a failed operation',()=>{
  const runner=runWithSpawn(()=>({status:28,error:null,stdout:secret,stderr:secret,signal:null}));
  assert.throws(()=>runner('pg_ctl',['-D',secret]),e=>e.message.includes('exit=28')&&!e.message.includes(secret));
});
test('source-integrated synchronous spawn exceptions do not echo credentials',()=>{
  const runner=runWithSpawn(()=>{throw Error('Cannot spawn binary at '+secret);});
  assert.throws(()=>runner(secret,[secret]),e=>e.message.includes('tool=other')&&!e.message.includes(secret));
});
test('source-integrated timeout error has only a known error code',()=>{
  const runner=runWithSpawn(()=>({status:null,error:{code:'ETIMEDOUT',message:secret},stderr:secret,stdout:'',signal:'SIGKILL'}));
  assert.throws(()=>runner('psql',[]),e=>e.message.includes('code=ETIMEDOUT')&&!e.message.includes(secret));
});
test('successful child output remains available for migration assertions',()=>{
  const runner=runWithSpawn(()=>({status:0,error:undefined,stdout:' Migrations complete\n',stderr:'',signal:null}));
  assert.equal(runner('pnpm',[]),'Migrations complete');
});
test('full runner declares source-owned formatter and has no raw failure tail',()=>{
  assert(source.includes('formatLocalPostgresCliFailure({command,error})'));
  assert(source.includes('formatLocalPostgresCliFailure({\n      command,status:result.status,signal:result.signal,error:result.error,'));
  const onlyExec=source.slice(begin,end);
  assert(!onlyExec.includes('const tail = String('));
  assert(!onlyExec.includes('error?.message'));
});
