import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {observeOwnedQaChild} from './bostan-private-windows-child-lifecycle.mjs';
import {admitPrivateWindowsProbeChildExit} from './bostan-private-windows-import-probe-outcome.mjs';
import {waitForPrivateWindowsImportProbeChild} from './bostan-private-windows-import-probe-deadline.mjs';

test('early child close cancels the full 36-second timer and removes listener',async()=>{
  const child=new EventEmitter();
  const timer={};
  let scheduled=0, cancelled=0;
  const outcome=waitForPrivateWindowsImportProbeChild(child,{
    deadlineMs:36000,
    schedule:(fn,ms)=>{assert.equal(ms,36000);scheduled++;return timer;},
    cancel:token=>{assert.equal(token,timer);cancelled++;},
  });
  assert.equal(child.listenerCount('close'),1);
  child.emit('close',0);
  assert.equal(await outcome,'child_exited');
  assert.equal(scheduled,1);
  assert.equal(cancelled,1);
  assert.equal(child.listenerCount('close'),0);
});

test('deadline removes close listener and never reports a late success',async()=>{
  const child=new EventEmitter();
  let expire;
  let cancelled=0;
  const outcome=waitForPrivateWindowsImportProbeChild(child,{
    deadlineMs:20,
    schedule:fn=>{expire=fn;return 123;},
    cancel:()=>{cancelled++;},
  });
  expire();
  assert.equal(await outcome,'bounded_36s');
  assert.equal(child.listenerCount('close'),0);
  child.emit('close',0);
  assert.equal(cancelled,1);
});

test('invalid deadlines and child objects fail closed',()=>{
  assert.throws(()=>waitForPrivateWindowsImportProbeChild(null),/refused/);
  assert.throws(()=>waitForPrivateWindowsImportProbeChild(new EventEmitter(),{deadlineMs:0}),/refused/);
  assert.throws(()=>waitForPrivateWindowsImportProbeChild(new EventEmitter(),{deadlineMs:36001}),/refused/);
});

test('real native Node child exits promptly without retaining deadline timer',async()=>{
  const child=spawn(process.execPath,['-e','process.exit(0)'],{stdio:'ignore'});
  const started=Date.now();
  const outcome=await waitForPrivateWindowsImportProbeChild(child,{deadlineMs:36000});
  assert.equal(outcome,'child_exited');
  assert.equal(child.exitCode,0);
  assert.ok(Date.now()-started<5000,'quick child must not wait for 36s deadline');
});

test('an already-observed close cannot be lost before deadline registration',async()=>{
  const child=new EventEmitter();
  child.emit('close',0);
  let scheduled=0;
  const outcome=await waitForPrivateWindowsImportProbeChild(child,{
    alreadyClosed:true,
    schedule:()=>{scheduled++;throw Error('deadline must not start');},
  });
  assert.equal(outcome,'child_exited');
  assert.equal(scheduled,0);
  assert.equal(child.listenerCount('close'),0);
});

test('invalid alreadyClosed observer snapshot fails closed',()=>{
  const child=new EventEmitter();
  assert.throws(()=>waitForPrivateWindowsImportProbeChild(child,{
    alreadyClosed:'true',
  }),/refused/);
});

test('real already-closed Node child is classified immediately and nonzero remains refused',async()=>{
  const child=spawn(process.execPath,['-e','process.exit(7)'],{stdio:'ignore'});
  const observer=observeOwnedQaChild(child);
  await once(child,'close');
  assert.equal(observer.closeSeen,true);
  let scheduled=0;
  const outcome=await waitForPrivateWindowsImportProbeChild(child,{
    alreadyClosed:observer.closeSeen,
    schedule:()=>{scheduled++;throw Error('deadline must not start');},
  });
  assert.equal(outcome,'child_exited');
  assert.equal(scheduled,0);
  assert.equal(child.exitCode,7);
  assert.equal(admitPrivateWindowsProbeChildExit({
    outcome,exitCode:child.exitCode,
  }),false);
  assert.equal((await observer.stop({graceMs:100,forceMs:100})).closed,true);
});
