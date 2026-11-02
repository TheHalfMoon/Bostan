import test from 'node:test';
import assert from 'node:assert/strict';
import {executePrivateWindowsAuthDbSteps} from './bostan-private-windows-auth-db-steps.mjs';

const names = [
  'read-only orphan gate',
  'shared TypeScript build',
  'shared legal asset copy',
  'plugin SDK TypeScript build',
  'HTTP authentication and first-admin route tests',
  'real embedded PostgreSQL migration/reset',
  'final read-only orphan gate',
];
const commands = names.map((name, i) => ({name, binary:'/owned/'+i, args:[], cwd:'/owned',timeout:20000}));
function scenario({bad=-1,throwAt=-1,signalAt=-1,errorAt=-1}={}) {
  const calls=[],out=[],err=[];
  const invoke = command => {
    const i=commands.indexOf(command);
    calls.push(i);
    if(i===throwAt) throw Error('synthetic untrusted error: secret');
    return {status:i===bad?1:0,signal:i===signalAt?'SIGTERM':null,
      error:i===errorAt?Error('synthetic untrusted error: secret'):undefined};
  };
  const result=executePrivateWindowsAuthDbSteps({commands,invoke,
    log:line=>out.push(line),error:line=>err.push(line)});
  return {result,calls,out,err};
}
test('complete sequence retains seven steps and all safe pass receipts',()=>{
  const {result,calls,out}=scenario();
  assert.deepEqual(calls,[0,1,2,3,4,5,6]);
  assert.equal(result.passed,true);
  assert.equal(result.finalGateAttempted,true);
  assert.equal(result.finalGatePassed,true);
  for(const token of ['PLUGIN_SDK_PASS','HTTP_TESTS_PASS','REAL_POSTGRES_PASS','NO_POSTGRES_ORPHANS_PASS'])
    assert.ok(out.some(line=>line.endsWith(token)));
});
test('failed shared build skips later workloads but still runs final orphan scan',()=>{
  const {result,calls,out}=scenario({bad:1});
  assert.deepEqual(calls,[0,1,6]);
  assert.equal(result.passed,false);
  assert.equal(result.failedStep,1);
  assert.equal(result.finalGatePassed,true);
  assert.ok(!out.some(line=>line.endsWith('HTTP_TESTS_PASS')));
});
test('failed real database migration still runs final read-only orphan scan',()=>{
  const {result,calls,out}=scenario({bad:5});
  assert.deepEqual(calls,[0,1,2,3,4,5,6]);
  assert.equal(result.passed,false);
  assert.equal(result.failedStep,5);
  assert.ok(!out.some(line=>line.endsWith('REAL_POSTGRES_PASS')));
});
test('thrown child execution error is redacted and does not bypass final scan',()=>{
  const {result,calls,err}=scenario({throwAt:4});
  assert.deepEqual(calls,[0,1,2,3,4,6]);
  assert.equal(result.passed,false);
  assert.ok(!err.join(' ').includes('secret'));
});
test('child signal and spawn error fail closed and still run final scan',()=>{
  for(const key of ['signalAt','errorAt']) {
    const {result,calls}=scenario({[key]:2});
    assert.equal(result.passed,false);
    assert.deepEqual(calls,[0,1,2,6]);
  }
});
test('failed initial read-only gate never starts a build or database',()=>{
  const {result,calls}=scenario({bad:0});
  assert.deepEqual(calls,[0]);
  assert.equal(result.passed,false);
  assert.equal(result.finalGateAttempted,false);
});
test('failed final gate cannot produce an overall pass',()=>{
  const {result,calls,out}=scenario({bad:6});
  assert.deepEqual(calls,[0,1,2,3,4,5,6]);
  assert.equal(result.passed,false);
  assert.equal(result.finalGateAttempted,true);
  assert.equal(result.finalGatePassed,false);
  assert.ok(!out.some(line=>line.endsWith('NO_POSTGRES_ORPHANS_PASS')));
});
test('malformed command plan is refused before executing anything',()=>{
  let called=false;
  assert.throws(()=>executePrivateWindowsAuthDbSteps({
    commands:commands.slice(0,6),invoke:()=>{called=true;return {status:0};}
  }));
  assert.throws(()=>executePrivateWindowsAuthDbSteps({
    commands:commands.map((c,i)=>i===6?{...c,name:'untrusted executable'}:c),
    invoke:()=>{called=true;return {status:0};}
  }));
  assert.equal(called,false);
});
test('final orphan scan exception cannot be treated as a pass',()=>{
  const {result,calls,err}=scenario({throwAt:6});
  assert.deepEqual(calls,[0,1,2,3,4,5,6]);
  assert.equal(result.passed,false);
  assert.equal(result.finalGatePassed,false);
  assert.ok(err.includes('BOSTAN_WIN_AUTH_DB_FINAL_ORPHAN_GATE_FAILED'));
});
test('missing synchronous spawn result is treated as failure with final scan',()=>{
  const calls=[];
  const result=executePrivateWindowsAuthDbSteps({commands,
    invoke:c=>{const i=commands.indexOf(c);calls.push(i);return i===4?null:{status:0};}});
  assert.deepEqual(calls,[0,1,2,3,4,6]);
  assert.equal(result.passed,false);
  assert.equal(result.finalGatePassed,true);
});
