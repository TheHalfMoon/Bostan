import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureOwnedLocalPostgresScratch as capture } from './bostan-local-postgres-scratch-identity.mjs';

const text='This directory belongs only to Bostan local qualification.\n';
function fixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b227-isolated-'));
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const scratch = fs.mkdtempSync(path.join(parent,'bostan-pg-qualification-'));
  const marker = path.join(scratch,'BOSTAN_OWNED_DISPOSABLE_CLUSTER');
  fs.writeFileSync(marker,text);
  return {parent,scratch,marker,proof:capture({scratch,marker,markerText:text})};
}
test('ordinary original scratch and cluster file remain verifiable',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.scratch,'cluster'));assert.equal(f.proof(),true);
});
test('moving scratch and replacing with copied ordinary marker must fail even with same bytes',t=>{
  const f=fixture(t);const original=path.join(f.parent,'retained-original');
  fs.renameSync(f.scratch,original);fs.mkdirSync(f.scratch);
  fs.writeFileSync(f.marker,text);fs.mkdirSync(path.join(f.scratch,'cluster'));
  fs.writeFileSync(path.join(f.scratch,'KEEP.txt'),'foreign');
  assert.equal(f.proof(),false);
  assert.equal(fs.readFileSync(path.join(f.scratch,'KEEP.txt'),'utf8'),'foreign');
});
test('copied marker at the original path is not original ownership',t=>{
  const f=fixture(t);fs.renameSync(f.marker,f.marker+'.old');fs.writeFileSync(f.marker,text);
  assert.equal(f.proof(),false);
});
test('linked marker is refused without reading through it',t=>{
  const f=fixture(t);fs.renameSync(f.marker,f.marker+'.old');fs.symlinkSync(f.marker+'.old',f.marker);
  assert.equal(f.proof(),false);
});
test('hardlinked marker is refused and foreign alias remains',t=>{
  const f=fixture(t);const alias=path.join(f.parent,'other-owner');fs.linkSync(f.marker,alias);
  assert.equal(f.proof(),false);assert.equal(fs.readFileSync(alias,'utf8'),text);
});
test('linked replacement scratch is refused and target not touched',t=>{
  const f=fixture(t);const original=path.join(f.parent,'retained-original');
  fs.renameSync(f.scratch,original);fs.symlinkSync(original,f.scratch,'dir');
  assert.equal(f.proof(),false);assert.equal(fs.readFileSync(path.join(original,'BOSTAN_OWNED_DISPOSABLE_CLUSTER'),'utf8'),text);
});
test('missing scratch and missing marker deny ownership',t=>{
  const f=fixture(t);fs.unlinkSync(f.marker);assert.equal(f.proof(),false);
});
test('a foreign or malformed capture cannot grant ownership or leak paths',t=>{
  const f=fixture(t);
  for(const opts of [{scratch:'relative',marker:f.marker,markerText:text},
    {scratch:os.tmpdir(),marker:f.marker,markerText:text},
    {scratch:f.scratch,marker:path.join(f.parent,'marker'),markerText:text},
    {scratch:f.scratch,marker:f.marker,markerText:''}]){
    assert.throws(()=>capture(opts),err=>err.message.includes('retaining fixture')&&!err.message.includes(f.parent));
  }
});
test('differently sized marker contents fail without leaking input',t=>{
  const f=fixture(t);fs.appendFileSync(f.marker,'different');assert.equal(f.proof(),false);
});
