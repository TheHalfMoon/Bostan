import test from 'node:test';
import assert from 'node:assert/strict';
import * as child from './bostan-private-windows-auth-db-captured-child.mjs';
const {invokePrivateWindowsAuthDbCaptured}=child;

const minimal=Object.freeze({CI:'1',PATH:''});
const command=Object.freeze({binary:process.execPath,args:['-e','process.exit(0)'],cwd:process.cwd(),timeout:20000});
const run=(timeout,env=minimal)=>{
  let calls=0,passedTimeout;
  const result=invokePrivateWindowsAuthDbCaptured({...command,timeout},{env,spawn:(_bin,_args,opts)=>{
    calls++;passedTimeout=opts.timeout;return {status:0};
  }});
  return {result,calls,passedTimeout};
};

test('planner maximum 240 seconds remains accepted and forwarded unchanged',()=>{
  assert.equal(child.PRIVATE_WINDOWS_AUTH_DB_CHILD_MAX_TIMEOUT_MS,240000);
  assert.deepEqual(run(240000),{result:{status:0},calls:1,passedTimeout:240000});
});
test('refuses 240001 ms before any child can delay final PostgreSQL orphan scan',()=>{
  assert.deepEqual(run(240001),{result:{status:1},calls:0,passedTimeout:undefined});
});
test('refuses near-maximum Node timeout without attempting child execution',()=>{
  assert.deepEqual(run(2147483647),{result:{status:1},calls:0,passedTimeout:undefined});
});
test('refuses zero, negative, fractional, NaN and unsafe integer timeouts',()=>{
  for(const timeout of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])
    assert.deepEqual(run(timeout),{result:{status:1},calls:0,passedTimeout:undefined});
});
test('preserves 20-second read-only PostgreSQL gate budget',()=>{
  assert.deepEqual(run(20000),{result:{status:0},calls:1,passedTimeout:20000});
});
test('real short-lived synthetic child still succeeds within budget',()=>{
  assert.deepEqual(invokePrivateWindowsAuthDbCaptured(command,{env:minimal}),{status:0});
});
test('real timed-out synthetic child fails closed without leaking child diagnostics',()=>{
  const timed={...command,args:['-e',"process.stderr.write('PRIVATE_TEST_SECRET');setTimeout(()=>{},1500)"],timeout:100};
  const result=invokePrivateWindowsAuthDbCaptured(timed,{env:minimal});
  assert.deepEqual(result,{status:1});
  assert.equal(JSON.stringify(result).includes('PRIVATE_TEST_SECRET'),false);
});
