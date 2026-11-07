import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {captureLocalPinnedPnpm as pin} from './bostan-local-pnpm-entry.mjs';
const refusal=/Bostan local pnpm entry unverified; retaining fixture/;
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b235-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const pkg=path.join(root,'pnpm-package');fs.mkdirSync(pkg,{mode:0o700});
 const bin=path.join(pkg,'bin');fs.mkdirSync(bin,{mode:0o700});
 const manifest=path.join(pkg,'package.json');
 fs.writeFileSync(manifest,JSON.stringify({name:'pnpm',version:'9.15.4',bin:{pnpm:'bin/pnpm.cjs'}}));
 const cli=path.join(bin,'pnpm.cjs');
 fs.writeFileSync(cli,"process.stdout.write('LOCAL_PINNED_PNPM_9.15.4')\n",{mode:0o600});
 return {root,pkg,bin,manifest,cli};
}
test('executes exact pinned package entry via host Node, not a PATH shim',t=>{
 const f=fixture(t),p=pin(f.pkg),child=spawnSync(process.execPath,[p.pathForNode(),'--version'],{encoding:'utf8',env:{PATH:'/not-here'}});
 assert.equal(child.status,0);assert.equal(child.stdout,'LOCAL_PINNED_PNPM_9.15.4');
});
test('PATH shadow named pnpm.cmd cannot alter the selected JS entry',t=>{
 const f=fixture(t),shadow=path.join(f.root,'shadow');fs.mkdirSync(shadow);
 fs.writeFileSync(path.join(shadow,'pnpm.cmd'),'echo WRONG');
 const p=pin(f.pkg);const r=spawnSync(process.execPath,[p.pathForNode()],{encoding:'utf8',env:{PATH:shadow}});
 assert.equal(r.stdout,'LOCAL_PINNED_PNPM_9.15.4');
});
test('same-path replacement of pnpm JS refuses even if bytes match',t=>{
 const f=fixture(t),p=pin(f.pkg);fs.renameSync(f.cli,f.cli+'.original');fs.copyFileSync(f.cli+'.original',f.cli);
 assert.throws(()=>p.pathForNode(),refusal);
});
test('in-place mutation of original CLI refuses by digest',t=>{
 const f=fixture(t),p=pin(f.pkg);fs.writeFileSync(f.cli,"process.stdout.write('WRONG_PINNED_PNPM_9.15.4')\n");
 assert.throws(()=>p.pathForNode(),refusal);
});
test('manifest version change after capture is refused',t=>{
 const f=fixture(t),p=pin(f.pkg);fs.writeFileSync(f.manifest,JSON.stringify({name:'pnpm',version:'9.15.5',bin:{pnpm:'bin/pnpm.cjs'}}));
 assert.throws(()=>p.pathForNode(),refusal);
});
test('manifest mutation with original version is refused by digest',t=>{
 const f=fixture(t),p=pin(f.pkg);fs.writeFileSync(f.manifest,JSON.stringify({name:'pnpm',version:'9.15.4',bin:{pnpm:'bin/pnpm.cjs'},bad:true}));
 assert.throws(()=>p.pathForNode(),refusal);
});
test('symlinked, renamed or missing CLI are refused',t=>{
 const f=fixture(t),p=pin(f.pkg);fs.renameSync(f.cli,f.cli+'.original');fs.symlinkSync(f.cli+'.original',f.cli);
 assert.throws(()=>p.pathForNode(),refusal);fs.unlinkSync(f.cli);assert.throws(()=>p.pathForNode(),refusal);
});
test('symlinked or replacement package directory refused',t=>{
 const f=fixture(t),p=pin(f.pkg);fs.renameSync(f.pkg,f.pkg+'.original');fs.mkdirSync(f.pkg,{mode:0o700});
 assert.throws(()=>p.pathForNode(),refusal);
});
test('unexpected package name/version/bin entry refuses at capture',t=>{
 for(const bad of [{name:'not-pnpm',version:'9.15.4',bin:{pnpm:'bin/pnpm.cjs'}},
    {name:'pnpm',version:'11.0.0',bin:{pnpm:'bin/pnpm.mjs'}},
    {name:'pnpm',version:'9.15.4',bin:{pnpm:'../foreign.js'}}]){
  const f=fixture(t);fs.writeFileSync(f.manifest,JSON.stringify(bad));assert.throws(()=>pin(f.pkg),refusal);
 }
});
test('hardlinked pnpm entry is refused',t=>{
 const f=fixture(t);fs.linkSync(f.cli,f.cli+'.alias');assert.throws(()=>pin(f.pkg),refusal);
});
test('group writable package, bin, or JS is refused on POSIX',t=>{
 for(const part of ['pkg','bin','cli']){
  const f=fixture(t);fs.chmodSync(f[part],0o777);assert.throws(()=>pin(f.pkg),refusal);
 }
});
test('invalid, absent or relative explicit package paths refuse safely',t=>{
 const f=fixture(t);for(const x of [undefined,'',null,'./pnpm-package','/nonexistent',f.root]){
  assert.throws(()=>pin(x),err=>err.message==='Bostan local pnpm entry unverified; retaining fixture');
 }
});
test('physical package folder alias and parent indirection are rejected',t=>{
 const f=fixture(t),alias=path.join(f.root,'alias');fs.symlinkSync(f.pkg,alias,'dir');assert.throws(()=>pin(alias),refusal);
});
test('root expected pin cannot be silently overridden',t=>{
 const f=fixture(t);assert.throws(()=>pin(f.pkg,{expectedVersion:'9.15.3'}),refusal);
});
