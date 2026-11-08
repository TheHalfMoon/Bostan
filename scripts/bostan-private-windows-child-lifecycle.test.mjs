import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {observeOwnedQaChild} from './bostan-private-windows-child-lifecycle.mjs';

const child = code => spawn(process.execPath,['-e',code],{stdio:['ignore','pipe','pipe']});

test('normal finished owned child is observed closed without force or failure',async()=>{
  const processHandle=child('process.exit(0)');
  const observer=observeOwnedQaChild(processHandle);
  const receipt=await observer.stop({graceMs:1000,forceMs:1000});
  assert.deepEqual(receipt,{closed:true,spawnError:false,forceUsed:false});
  assert.equal(observer.closeSeen,true);
});
test('missing executable is safely observed instead of unhandled error',async()=>{
  const processHandle=spawn('__bostan_qa_child_missing_executable_2026__',[],{stdio:'ignore'});
  const observer=observeOwnedQaChild(processHandle);
  const receipt=await observer.stop({graceMs:1000,forceMs:1000});
  assert.equal(receipt.closed,true);
  assert.equal(receipt.spawnError,true);
  assert.equal(observer.exitedOrFailed,true);
});
test('force-kill fallback waits for an actual close event after SIGTERM is ignored', {skip:process.platform==='win32'}, async()=>{
  const processHandle=child("process.on('SIGTERM',()=>{});process.stdout.write('READY\\n');setInterval(()=>{},100)");
  const observer=observeOwnedQaChild(processHandle);
  await new Promise((resolve,reject)=>{
    processHandle.once('error',reject);
    processHandle.stdout.once('data',resolve);
  });
  const receipt=await observer.stop({graceMs:40,forceMs:1000});
  assert.deepEqual(receipt,{closed:true,spawnError:false,forceUsed:true});
});
test('same stop call is idempotent and does not terminate unrelated processes',async()=>{
  const processHandle=child('setInterval(()=>{},100)');
  const observer=observeOwnedQaChild(processHandle);
  const [first,second]=await Promise.all([
    observer.stop({graceMs:1000,forceMs:1000}),
    observer.stop({graceMs:1000,forceMs:1000}),
  ]);
  assert.deepEqual(first,second);
  assert.equal(first.closed,true);
});
test('invalid timeouts and non-child inputs refuse',async()=>{
  assert.throws(()=>observeOwnedQaChild({}),/ChildProcess/);
  const processHandle=child('setInterval(()=>{},100)');
  const observer=observeOwnedQaChild(processHandle);
  await assert.rejects(observer.stop({graceMs:0}),/Invalid bounded/);
  const receipt=await observer.stop({graceMs:1000,forceMs:1000});
  assert.equal(receipt.closed,true);
});
import {EventEmitter} from 'node:events';

test('exitCode alone never permits cleanup without close event',async()=>{
  const fake=new EventEmitter();
  fake.exitCode=0;
  fake.signalCode=null;
  const signals=[];
  fake.kill=signal=>{signals.push(signal);return true;};
  const observer=observeOwnedQaChild(fake);
  const receipt=await observer.stop({graceMs:10,forceMs:10});
  assert.deepEqual(receipt,{closed:false,spawnError:false,forceUsed:true});
  assert.deepEqual(signals,['SIGTERM','SIGKILL']);
});
test('spawn error then close is never a successful teardown',async()=>{
  const fake=new EventEmitter();
  fake.kill=()=>{throw Error('must not kill spawn failure');};
  const observer=observeOwnedQaChild(fake);
  fake.emit('error',Error('synthetic path missing'));
  setImmediate(()=>fake.emit('close',-2,null));
  const receipt=await observer.stop({graceMs:100,forceMs:100});
  assert.deepEqual(receipt,{closed:true,spawnError:true,forceUsed:false});
});
