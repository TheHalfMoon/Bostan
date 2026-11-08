import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {copyClipLabNotices} from './copy-cliplab-notices.mjs';
const roots=[];
afterEach(()=>{for(const r of roots.splice(0))rmSync(r,{recursive:true,force:true})});
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'bostan-shared-legal-'));
 roots.push(root);
 mkdirSync(join(root,'src','cliplab'),{recursive:true});
 writeFileSync(join(root,'src','cliplab','LICENSE'),'required source copyright\n');
 writeFileSync(join(root,'src','cliplab','PROVENANCE.md'),'third-party provenance\n');
 return root;
}
test('copies both legal notices byte-identically and can safely retake',()=>{
 const root=fixture();
 for(let i=0;i<2;i++){
  const result=copyClipLabNotices(root);
  assert.equal(result.byteIdentical,true);
  assert.deepEqual(result.files,['LICENSE','PROVENANCE.md']);
  for(const name of result.files){
   assert.deepEqual(readFileSync(join(root,'dist','cliplab',name)),
     readFileSync(join(root,'src','cliplab',name)));
  }
 }
});
test('does not silently build with missing source legal notices',()=>{
 const root=fixture();
 rmSync(join(root,'src','cliplab','LICENSE'));
 assert.throws(()=>copyClipLabNotices(root),/legal file missing/);
});
test('refuses symlinked destination escape before copying notices',()=>{
 if(process.platform==='win32')return;
 const root=fixture(),outside=mkdtempSync(join(tmpdir(),'bostan-legal-outside-'));
 roots.push(outside);
 mkdirSync(join(root,'dist'));
 symlinkSync(outside,join(root,'dist','cliplab'),'dir');
 assert.throws(()=>copyClipLabNotices(root),/symlinked/);
});
