import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkPrivateWindowsSourceWorkspaceDependencies as check} from './bostan-private-windows-source-workspace-admission.mjs';

const scopes=['server','packages/adapter-utils','packages/paperclip-runner'];
const isWindows=process.platform==='win32';
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b199-owned-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const scope of scopes){
    const dir=path.join(root,scope);
    const pkg=path.join(dir,'node_modules','smol-toml');
    fs.mkdirSync(pkg,{recursive:true});
    fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({dependencies:{'smol-toml':'^1.9.1'}}));
    fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'smol-toml',version:'1.9.1',main:'index.js'}));
    fs.writeFileSync(path.join(pkg,'index.js'),'module.exports = {};');
  }
  return root;
}
function linkDirectory(target,destination){
  fs.symlinkSync(target,destination,isWindows?'junction':'dir');
}
const refuse={allowed:false,reason:'foreign_workspace_scope'};

test('unchanged ordinary source scopes and scoped packages pass',t=>{
  const root=fixture(t);
  assert.deepEqual(check({root}),{allowed:true,reason:'pass'});
});
test('linked adapter-utils scope is refused even when target and dependencies remain inside checkout',t=>{
  const root=fixture(t);
  const scope=path.join(root,'packages','adapter-utils');
  const target=scope+'-owned-target';
  fs.renameSync(scope,target);
  linkDirectory(target,scope);
  assert.deepEqual(check({root}),refuse);
  assert(fs.existsSync(path.join(target,'node_modules','smol-toml','index.js')));
});
test('linked packages ancestor is refused before reading nested manifests',t=>{
  const root=fixture(t);
  const ancestor=path.join(root,'packages');
  const target=path.join(root,'packages-owned-target');
  fs.renameSync(ancestor,target);
  linkDirectory(target,ancestor);
  assert.deepEqual(check({root}),refuse);
  assert(fs.existsSync(path.join(target,'adapter-utils','package.json')));
});
test('linked server scope is refused even when target and dependencies remain inside checkout',t=>{
  const root=fixture(t);
  const scope=path.join(root,'server');
  const target=path.join(root,'server-owned-target');
  fs.renameSync(scope,target);
  linkDirectory(target,scope);
  assert.deepEqual(check({root}),refuse);
});
test('legitimate pnpm-style package symlink within ordinary node_modules remains accepted',t=>{
  const root=fixture(t);
  const modules=path.join(root,'server','node_modules');
  const original=path.join(modules,'smol-toml');
  const store=path.join(modules,'.pnpm','smol-toml@1.9.1','node_modules','smol-toml');
  fs.mkdirSync(path.dirname(store),{recursive:true});
  fs.renameSync(original,store);
  linkDirectory(store,original);
  assert.deepEqual(check({root}),{allowed:true,reason:'pass'});
});
