import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureOwnedPostgresScratchReclaimer as capture} from './embedded-postgres-scratch-ownership.mjs';
const scratch=(t)=>{const parent=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b194-owned-'));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));return parent;};

test('reclaims the original small ordinary scratch directory once',t=>{const parent=scratch(t),dir=path.join(parent,'data');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'PG_VERSION'),'18');const reclaim=capture(dir);reclaim();assert(!fs.existsSync(dir));assert.throws(reclaim,/retaining fixture/);});
test('refuses a new directory installed at the same pathname and retains content',t=>{const parent=scratch(t),dir=path.join(parent,'data');fs.mkdirSync(dir);const reclaim=capture(dir);fs.renameSync(dir,path.join(parent,'original'));fs.mkdirSync(dir);const keep=path.join(dir,'KEEP.txt');fs.writeFileSync(keep,'operator');assert.throws(reclaim,/retaining fixture/);assert.equal(fs.readFileSync(keep,'utf8'),'operator');});
test('refuses a foreign symlink replacement even when it points to an ordinary directory',t=>{const parent=scratch(t),dir=path.join(parent,'data');fs.mkdirSync(dir);const reclaim=capture(dir);fs.renameSync(dir,path.join(parent,'original'));const foreign=path.join(parent,'foreign');fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign,'KEEP'),'private');fs.symlinkSync(foreign,dir,'dir');assert.throws(reclaim,/retaining fixture/);assert.equal(fs.readFileSync(path.join(foreign,'KEEP'),'utf8'),'private');});
test('refuses an absent original and does not create it',t=>{const parent=scratch(t),dir=path.join(parent,'data');fs.mkdirSync(dir);const reclaim=capture(dir);fs.rmdirSync(dir);assert.throws(reclaim,/retaining fixture/);assert(!fs.existsSync(dir));});
test('refuses preexisting arbitrary unrelated directory outside temp even if empty',t=>{const parent=scratch(t);assert.throws(()=>capture(path.parse(parent).root),/retaining fixture/);});
test('refuses a non-directory or linked initial capture',t=>{const parent=scratch(t),file=path.join(parent,'file'),target=path.join(parent,'target'),linked=path.join(parent,'linked');fs.writeFileSync(file,'no');fs.mkdirSync(target);fs.symlinkSync(target,linked,'dir');assert.throws(()=>capture(file),/retaining fixture/);assert.throws(()=>capture(linked),/retaining fixture/);});
test('refuses relative and dot-segment paths',t=>{const parent=scratch(t);const dir=path.join(parent,'data');fs.mkdirSync(dir);assert.throws(()=>capture('./data'),/retaining fixture/);assert.throws(()=>capture(path.join(parent,'..',path.basename(parent),'data')+'/..'+'/data'),/retaining fixture/);});
test('does not echo sensitive paths in errors',t=>{const parent=scratch(t),dir=path.join(parent,'data');fs.mkdirSync(dir);const reclaim=capture(dir);fs.renameSync(dir,path.join(parent,'original'));try{reclaim();assert.fail('expected refusal');}catch(e){assert(!e.message.includes(parent));assert.match(e.message,/retaining fixture/);}});
