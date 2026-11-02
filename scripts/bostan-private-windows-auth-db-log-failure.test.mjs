import test from 'node:test';
import assert from 'node:assert/strict';
import {executePrivateWindowsAuthDbSteps} from './bostan-private-windows-auth-db-steps.mjs';
const names = ['read-only orphan gate','shared TypeScript build','shared legal asset copy',
  'plugin SDK TypeScript build','HTTP authentication and first-admin route tests',
  'real embedded PostgreSQL migration/reset','final read-only orphan gate'];
const commands = names.map(name=>({name,binary:'C:\\trusted\\node.exe',args:[],cwd:'C:\\qa',timeout:1000}));
const result = (opts={}) => {
  const called=[];
  const invoke = command => { const i=commands.indexOf(command); called.push(i); return {status: opts.failAt===i ? 1 : 0}; };
  const log = line => { if(opts.logThrow?.(line)) throw Error('synthetic closed stdout'); };
  const error = line => { if(opts.errorThrow?.(line)) throw Error('synthetic closed stderr'); };
  let outcome;
  assert.doesNotThrow(()=>{outcome=executePrivateWindowsAuthDbSteps({commands,invoke,log,error});});
  return {called,outcome};
};
test('closed stdout on successful intermediate receipt still performs final orphan scan',()=>{
  const {called,outcome}=result({logThrow:s=>s==='BOSTAN_WIN_AUTH_DB_PLUGIN_SDK_PASS'});
  assert.deepEqual(called,[0,1,2,3,6]);
  assert.equal(outcome.finalGateAttempted,true);
  assert.equal(outcome.diagnosticFailed,true);
  assert.equal(outcome.passed,false);
});
test('closed stderr on failing workload still performs final orphan scan',()=>{
  const {called,outcome}=result({failAt:5,errorThrow:s=>s==='BOSTAN_WIN_AUTH_DB_STEP_FAILED=5'});
  assert.deepEqual(called,[0,1,2,3,4,5,6]);
  assert.equal(outcome.finalGateAttempted,true);
  assert.equal(outcome.passed,false);
});
test('closed stdout before a workload never skips the final orphan scan',()=>{
  const {called,outcome}=result({logThrow:s=>s==='BOSTAN_WIN_AUTH_DB_STEP=shared TypeScript build'});
  assert.deepEqual(called,[0,6]);
  assert.equal(outcome.finalGateAttempted,true);
  assert.equal(outcome.passed,false);
});
test('closed stdout on final receipt fails closed without losing final scan evidence',()=>{
  const {called,outcome}=result({logThrow:s=>s==='BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS'});
  assert.deepEqual(called,[0,1,2,3,4,5,6]);
  assert.equal(outcome.finalGatePassed,true);
  assert.equal(outcome.passed,false);
});
test('healthy diagnostic sinks retain success',()=>{
  const {called,outcome}=result();
  assert.deepEqual(called,[0,1,2,3,4,5,6]);
  assert.equal(outcome.passed,true);
});

test('closed stdout during initial gate receipt still scans without starting workloads',()=>{
  const {called,outcome}=result({logThrow:s=>s==='BOSTAN_WIN_AUTH_DB_STEP=read-only orphan gate'});
  assert.deepEqual(called,[0,6]);
  assert.equal(outcome.diagnosticFailed,true);
  assert.equal(outcome.passed,false);
});
test('closed stderr on initial gate failure cannot start workloads',()=>{
  const {called,outcome}=result({failAt:0,errorThrow:s=>s==='BOSTAN_WIN_AUTH_DB_INITIAL_ORPHAN_GATE_FAILED'});
  assert.deepEqual(called,[0]);
  assert.equal(outcome.finalGateAttempted,false);
  assert.equal(outcome.passed,false);
});
test('closed stderr after final gate failure returns fail closed',()=>{
  const {called,outcome}=result({failAt:6,errorThrow:s=>s==='BOSTAN_WIN_AUTH_DB_FINAL_ORPHAN_GATE_FAILED'});
  assert.deepEqual(called,[0,1,2,3,4,5,6]);
  assert.equal(outcome.finalGateAttempted,true);
  assert.equal(outcome.finalGatePassed,false);
  assert.equal(outcome.passed,false);
});
