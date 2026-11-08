import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  admitLinuxPrivateTmpfs,inspectLinuxTmpfs
} from './bostan-private-linux-tmpfs-admission.mjs';
const filename=fileURLToPath(new URL('./bostan-private-linux-tmpfs-admission.mjs',import.meta.url));
const good={platform:'linux',root:'/tmp',filesystemType:0x01021994,
  freeKiB:3670016,availableMemoryKiB:5242880};
const run=(...args)=>spawnSync(process.execPath,[filename,...args],{encoding:'utf8',timeout:12000});

test('narrow read-only Linux tmpfs admission passes exactly defined limits',()=>{
  const receipt=admitLinuxPrivateTmpfs(good);
  assert.equal(receipt.qualified,true);
  assert.equal(receipt.releaseQualified,false);
  assert.equal(receipt.temporaryStageOnly,true);
  assert.equal(receipt.stageFreeMinimumKiB,3670016);
  assert.equal(receipt.standardSourceFreeMinimumKiB,4194304);
  assert.equal(receipt.paidModelsUsed,false);
});
test('rejects real disk, unexpected temporary root and all non-Linux hosts',()=>{
  for(const mutation of [
    {platform:'darwin'},{platform:'win32'},{filesystemType:0xEF53},
    {root:'/home/owner'},{root:'/mnt/d'}, {root:'/tmp/elsewhere'},
  ])assert.throws(()=>admitLinuxPrivateTmpfs({...good,...mutation}),/real Linux \/tmp tmpfs/);
});
test('fails on insufficient tmpfs capacity, unknown and float measurements',()=>{
  for(const freeKiB of [0,3670015,-1,3.5,NaN,Infinity])
    assert.throws(()=>admitLinuxPrivateTmpfs({...good,freeKiB}),/at least 3.5 GiB/);
});
test('fails on insufficient Linux MemAvailable, unknown or stale readings',()=>{
  for(const availableMemoryKiB of [0,5242879,-1,NaN,Infinity])
    assert.throws(()=>admitLinuxPrivateTmpfs({...good,availableMemoryKiB}),/at least 5 GiB/);
});
test('default and plan are inert, release/publish flags rejected',()=>{
  for(const args of [[],['--plan']]){
    const r=run(...args);
    assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(r.stdout).run,false);
    assert.equal(JSON.parse(r.stdout).requiresExplicitOptIn,true);
  }
  for(const args of [['--publish'],['--check','--release'],['--run']]){
    const r=run(...args);assert.equal(r.status,2,r.stderr);
  }
});
test('no Linux tmpfs admission possible on Mac or Windows',()=>{
  if(process.platform==='linux'){
    // A Linux machine may qualify or legitimately fail the resource gate.
    try{const r=inspectLinuxTmpfs();assert.equal(r.releaseQualified,false)}
    catch(error){assert.match(error.message,/tmpfs|GiB|memory/)}
  }else{
    assert.throws(()=>inspectLinuxTmpfs(),/only on canonical \/tmp/);
    const r=run('--check');assert.equal(r.status,2);
  }
});
