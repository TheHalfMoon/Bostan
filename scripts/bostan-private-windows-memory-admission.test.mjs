import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  checkBostanWindowsMemory as check,assertBostanWindowsMemory as assertMemory,
  MIN_TOTAL_MEMORY_BYTES as MIN_TOTAL,MIN_FREE_MEMORY_BYTES as MIN_FREE,
} from './bostan-private-windows-memory-admission.mjs';

const GIB=1024**3;
const win=(free,total)=>check({platform:'win32',readFree:()=>free,readTotal:()=>total});
const path=fileURLToPath(new URL('./bostan-private-windows-memory-admission.mjs',import.meta.url));

test('minimum memory boundaries pass exactly; result is frozen and non-sensitive',()=>{
  const v=win(MIN_FREE,MIN_TOTAL);
  assert.equal(v.allowed,true);
  assert.equal(v.reason,'pass');
  assert.equal(v.freeGiB,2);
  assert.equal(v.totalGiB,6);
  assert.equal(Object.isFrozen(v),true);
  assert.equal(assertMemory({platform:'win32',readFree:()=>MIN_FREE,readTotal:()=>MIN_TOTAL}).allowed,true);
});
test('one byte below free or total thresholds is refused',()=>{
  assert.equal(win(MIN_FREE-1,MIN_TOTAL).reason,'low_free_memory');
  assert.equal(win(MIN_FREE,MIN_TOTAL-1).reason,'low_total_memory');
  assert.equal(win(MIN_FREE-1,MIN_TOTAL-1).allowed,false);
  assert.throws(()=>assertMemory({platform:'win32',readFree:()=>MIN_FREE-1,readTotal:()=>MIN_TOTAL}),/low_free_memory/);
});
test('invalid, misleading or unsafe OS memory readings fail closed',()=>{
  for(const [free,total] of [[-1,MIN_TOTAL],[NaN,MIN_TOTAL],[Infinity,MIN_TOTAL],[0,0],
    [MIN_TOTAL+1,MIN_TOTAL],[1.5,MIN_TOTAL],[MIN_FREE,'8 GB'],[MIN_FREE,2**54],
    [undefined,MIN_TOTAL],[null,MIN_TOTAL]]){
    const v=win(free,total);
    assert.equal(v.allowed,false,JSON.stringify([free,total]));
    assert.equal(v.reason,'invalid_memory');
  }
});
test('platform and unavailable probe are denied without invoking the host',()=>{
  let called=0;
  const v=check({platform:'linux',readFree:()=>{called++;throw Error('not called');},readTotal:()=>{called++;throw Error('not called');}});
  assert.equal(v.reason,'not_windows');
  assert.equal(called,0);
  assert.equal(check({platform:'win32',readFree:null,readTotal:()=>MIN_TOTAL}).reason,'invalid_probe');
  assert.equal(check({platform:'win32',readFree:()=>{throw Error('private system detail');},readTotal:()=>MIN_TOTAL}).reason,'memory_unavailable');
});
test('failure receipts never include exceptions, paths or secrets',()=>{
  const secret='postgres://user:secret@127.0.0.1/private';
  const v=check({platform:'win32',readFree:()=>{throw Error(secret);},readTotal:()=>MIN_TOTAL});
  assert.equal(JSON.stringify(v).includes(secret),false);
  assert.equal(v.allowed,false);
});
test('inert plan is reproducible and does not execute a native check',()=>{
  const r=spawnSync(process.execPath,[path,'--plan'],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,0);
  const v=JSON.parse(r.stdout);
  assert.equal(v.checking,false);
  assert.equal(v.readOnly,true);
  assert.equal(v.publishes,false);
});
test('unknown command is rejected without side effects',()=>{
  for(const option of ['--run','--cleanup','--publish','--extra']){
    const r=spawnSync(process.execPath,[path,option],{encoding:'utf8',timeout:5000});
    assert.equal(r.status,2,option);
  }
});
test('real local non-Windows --check refuses native qualification',()=>{
  if(process.platform==='win32')return;
  const r=spawnSync(process.execPath,[path,'--check'],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,2);
  const v=JSON.parse(r.stdout);
  assert.equal(v.allowed,false);
  assert.equal(v.reason,'not_windows');
});
