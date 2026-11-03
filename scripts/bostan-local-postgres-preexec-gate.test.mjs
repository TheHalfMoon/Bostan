import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalPostgresPreExecGate as gate } from './bostan-local-postgres-preexec-gate.mjs';

function fixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'bostan-b228-unit-'));
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const scratch = path.join(parent, 'bostan-pg-qualification-owned');
  fs.mkdirSync(scratch);
  const cluster = path.join(scratch, 'cluster');
  let owned = true;
  const g=gate({scratch,cluster,ownedScratch:()=>owned});
  return {parent,scratch,cluster,g,setOwned:v=>{owned=v;}};
}
function initialize(f){ assert.equal(f.g.beforeInitdb(),true); fs.mkdirSync(f.cluster); assert.equal(f.g.afterInitdb(),true); }
test('new scratch can be initialized and started after original inode is captured',t=>{
  const f=fixture(t);initialize(f);assert.equal(f.g.beforeStart(),true);assert.equal(f.g.ownedForFinalizer(),true);
});
test('a planted ordinary cluster with a foreign KEEP file refuses initdb and finalizer',t=>{
  const f=fixture(t);fs.mkdirSync(f.cluster);const keep=path.join(f.cluster,'KEEP.txt');fs.writeFileSync(keep,'unrelated');
  assert.throws(()=>f.g.beforeInitdb(),/retaining fixture/);assert.equal(f.g.ownedForFinalizer(),false);
  assert.equal(fs.readFileSync(keep,'utf8'),'unrelated');
});
test('linked pre-planted cluster refuses initdb without modifying linked target',t=>{
  const f=fixture(t),foreign=path.join(f.parent,'outside');fs.mkdirSync(foreign);fs.symlinkSync(foreign,f.cluster,'dir');
  assert.throws(()=>f.g.beforeInitdb(),/retaining fixture/);assert.equal(f.g.ownedForFinalizer(),false);
  assert(fs.lstatSync(f.cluster).isSymbolicLink());
});
test('replacement of initialized cluster before pg_ctl start remains untouched',t=>{
  const f=fixture(t);initialize(f);fs.renameSync(f.cluster,f.cluster+'-original');fs.mkdirSync(f.cluster);
  const keep=path.join(f.cluster,'KEEP.txt');fs.writeFileSync(keep,'foreign');
  assert.throws(()=>f.g.beforeStart(),/retaining fixture/);assert.equal(f.g.ownedForFinalizer(),false);
  assert.equal(fs.readFileSync(keep,'utf8'),'foreign');
});
test('replacement of the initialized cluster by symlink refuses before start',t=>{
  const f=fixture(t);initialize(f);fs.renameSync(f.cluster,f.cluster+'-original');fs.symlinkSync(f.cluster+'-original',f.cluster,'dir');
  assert.throws(()=>f.g.beforeStart(),/retaining fixture/);assert.equal(f.g.ownedForFinalizer(),false);
});
test('marker/root ownership mutation is refused before initdb and before start',t=>{
  const f=fixture(t);f.setOwned(false);
  assert.throws(()=>f.g.beforeInitdb(),/retaining fixture/);assert.equal(f.g.ownedForFinalizer(),false);
  const other=fixture(t);initialize(other);other.setOwned(false);
  assert.throws(()=>other.g.beforeStart(),/retaining fixture/);assert.equal(other.g.ownedForFinalizer(),false);
});
test('initdb failure before cluster existence leaves still-original scratch reclaimable',t=>{
  const f=fixture(t);assert.equal(f.g.beforeInitdb(),true);assert.equal(f.g.ownedForFinalizer(),true);
});
test('missing initialized cluster prevents pg_ctl and fails closed',t=>{
  const f=fixture(t);initialize(f);fs.rmdirSync(f.cluster);
  assert.throws(()=>f.g.beforeStart(),/retaining fixture/);assert.equal(f.g.ownedForFinalizer(),false);
});
test('out-of-order and repeated transitions refuse instead of reauthorizing',t=>{
  const f=fixture(t);assert.throws(()=>f.g.beforeStart(),/retaining fixture/);
  assert.equal(f.g.ownedForFinalizer(),false);
  const other=fixture(t);assert.equal(other.g.beforeInitdb(),true);
  assert.throws(()=>other.g.beforeInitdb(),/retaining fixture/);assert.equal(other.g.ownedForFinalizer(),false);
});
test('input errors have fixed reason without leaking scratch path',t=>{
  const f=fixture(t);
  assert.throws(()=>gate({scratch:f.scratch,cluster:path.join(f.parent,'foreign'),ownedScratch:()=>true}),e=>
    e.message.includes('retaining fixture')&&!e.message.includes(f.parent));
});

test('failed initdb with unverified newly existing cluster must not authorize deletion',t=>{
  const f=fixture(t);
  assert.equal(f.g.beforeInitdb(),true);
  fs.mkdirSync(f.cluster);
  const keep=path.join(f.cluster,'KEEP.txt');
  fs.writeFileSync(keep,'foreign');
  assert.equal(f.g.ownedForFinalizer(),false);
  assert.equal(fs.readFileSync(keep,'utf8'),'foreign');
});
test('failed initdb with a linked cluster path must not authorize deletion',t=>{
  const f=fixture(t);
  assert.equal(f.g.beforeInitdb(),true);
  const outside=path.join(f.parent,'unrelated');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside,'KEEP.txt'),'foreign');
  fs.symlinkSync(outside,f.cluster,'dir');
  assert.equal(f.g.ownedForFinalizer(),false);
  assert.equal(fs.readFileSync(path.join(outside,'KEEP.txt'),'utf8'),'foreign');
});
