import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkPrivateWindowsSourceWorkspaceDependencies as check} from './bostan-private-windows-source-workspace-admission.mjs';
const scopes=['server','packages/adapter-utils','packages/bostan-runner'];
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b193-package-identity-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const scope of scopes){
    const p=path.join(root,scope);
    fs.mkdirSync(path.join(p,'node_modules','smol-toml'),{recursive:true});
    fs.writeFileSync(path.join(p,'package.json'),JSON.stringify({dependencies:{'smol-toml':'^1.9.1'}}));
    fs.writeFileSync(path.join(p,'node_modules','smol-toml','package.json'),JSON.stringify({name:'smol-toml',main:'index.js'}));
    fs.writeFileSync(path.join(p,'node_modules','smol-toml','index.js'),'module.exports={};');
  }
  return {root,manifest:path.join(root,'server','node_modules','smol-toml','package.json')};
}
test('accepts all three real package names and locally installed files',t=>{
  const f=fixture(t);assert.deepEqual(check({root:f.root}),{allowed:true,reason:'pass'});
});
test('refuses a foreign package masquerading under smol-toml directory name',t=>{
  const f=fixture(t);fs.writeFileSync(f.manifest,JSON.stringify({name:'untrusted-package',main:'index.js'}));
  assert.equal(check({root:f.root}).reason,'invalid_workspace_dependency_identity');
});
test('refuses installed package without a package identity manifest',t=>{
  const f=fixture(t);fs.unlinkSync(f.manifest);
  assert.equal(check({root:f.root}).reason,'invalid_workspace_dependency_identity');
});
test('refuses linked package manifest even if target is within same checkout',t=>{
  const f=fixture(t);const copy=path.join(path.dirname(f.manifest),'other.json');
  fs.renameSync(f.manifest,copy);fs.symlinkSync(copy,f.manifest);
  assert.equal(check({root:f.root}).reason,'invalid_workspace_dependency_identity');
});
test('refuses malformed or oversized installed package metadata without echoing paths',t=>{
  const f=fixture(t);for(const body of ['{invalid', ' '.repeat(131073)]){
    fs.writeFileSync(f.manifest,body);const r=check({root:f.root});
    assert.equal(r.reason,'invalid_workspace_dependency_identity');
    assert.equal(JSON.stringify(r).includes(f.root),false);
  }
});
