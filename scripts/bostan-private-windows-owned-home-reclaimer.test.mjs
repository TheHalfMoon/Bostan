import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureOwnedWindowsHttpHomeReclaimer} from './bostan-private-windows-owned-home-reclaimer.mjs';

function fixture(callback){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b198-exclusive-'));
  const home=fs.mkdtempSync(path.join(temp,'bostan-private-auth-http-'));
  const marker=path.join(home,'BOSTAN_QA_OWNED');
  fs.writeFileSync(marker,'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n');
  try { callback({temp,home,marker}); }
  finally {
    // Only this exclusive test-owned fixture is removed, not any user path.
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
const refused=/BOSTAN_WINDOWS_LIVE_OWNED_HOME_RECLAIM_REFUSED/;

test('reclaims unchanged exclusive owned home once',()=>fixture(({home,temp})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  reclaim();
  assert.equal(fs.existsSync(home),false);
  assert.throws(reclaim,refused);
}));
test('refuses a same-path replacement and preserves its KEEP file',()=>fixture(({home,temp})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  fs.renameSync(home,home+'.original');
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(home,'BOSTAN_QA_OWNED'),'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n');
  fs.writeFileSync(path.join(home,'KEEP.txt'),'foreign fixture');
  assert.throws(reclaim,refused);
  assert.equal(fs.readFileSync(path.join(home,'KEEP.txt'),'utf8'),'foreign fixture');
}));
test('refuses a linked replacement and preserves its target',()=>fixture(({home,temp})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  const target=path.join(temp,'owned-target');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target,'KEEP.txt'),'keep');
  fs.renameSync(home,home+'.original');
  fs.symlinkSync(target,home,'dir');
  assert.throws(reclaim,refused);
  assert.equal(fs.readFileSync(path.join(target,'KEEP.txt'),'utf8'),'keep');
}));
test('refuses a replaced marker even when bytes match',()=>fixture(({home,temp,marker})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  fs.renameSync(marker,marker+'.original');
  fs.writeFileSync(marker,'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n');
  assert.throws(reclaim,refused);
  assert.equal(fs.existsSync(home),true);
}));
test('refuses a hardlinked marker and preserves other link',()=>fixture(({home,temp,marker})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  const alias=path.join(temp,'alias');
  fs.linkSync(marker,alias);
  assert.throws(reclaim,refused);
  assert.equal(fs.existsSync(alias),true);
}));
test('refuses missing marker without deleting owned directory',()=>fixture(({home,temp,marker})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  fs.unlinkSync(marker);
  assert.throws(reclaim,refused);
  assert.equal(fs.existsSync(home),true);
}));
test('refuses a home outside the exact temp child boundary',()=>fixture(({home,temp})=>{
  const foreign=path.join(temp,'foreign-home');
  fs.mkdirSync(foreign);
  assert.throws(()=>captureOwnedWindowsHttpHomeReclaimer({home:foreign,temp}),refused);
}));
test('refuses marker-content mutation before cleanup',()=>fixture(({home,temp,marker})=>{
  const reclaim=captureOwnedWindowsHttpHomeReclaimer({home,temp});
  fs.writeFileSync(marker,'BOSTAN_PRIVATE_SYNTHETIC_FAKE\n');
  assert.throws(reclaim,refused);
  assert.equal(fs.existsSync(home),true);
}));
