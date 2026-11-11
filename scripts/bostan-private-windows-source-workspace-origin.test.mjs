import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPrivateWindowsSourceWorkspaceDependencies as check } from './bostan-private-windows-source-workspace-admission.mjs';

const scopes=['server','packages/adapter-utils','packages/bostan-runner'];
function fixture(t){
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b193-qa-'));
 t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}));
 const root=path.join(scratch,'owned');fs.mkdirSync(root);
 for(const scope of scopes){const dir=path.join(root,scope);fs.mkdirSync(path.join(dir,'node_modules'),{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({dependencies:{'smol-toml':'^1.9.1'}}));}
 function makePackage(dir){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'smol-toml',main:'index.js'}));fs.writeFileSync(path.join(dir,'index.js'),'module.exports={};');return dir;}
 function installLocal(scope){return makePackage(path.join(root,scope,'node_modules','smol-toml'));}
 function installAll(){scopes.forEach(installLocal);}
 return {scratch,root,makePackage,installLocal,installAll};
}
test('complete physical direct local dependencies pass',t=>{const f=fixture(t);f.installAll();assert.deepEqual(check({root:f.root}),{allowed:true,reason:'pass'});});
test('rejects a foreign symlinked package even when real Node resolution succeeds',t=>{const f=fixture(t);f.installAll();const foreign=f.makePackage(path.join(f.scratch,'foreign'));const target=path.join(f.root,scopes[1],'node_modules','smol-toml');fs.rmSync(target,{recursive:true});fs.symlinkSync(foreign,target,'dir');assert.equal(check({root:f.root}).reason,'foreign_workspace_dependency');});
test('rejects ancestor-hoisted package if declared scope has no direct entry',t=>{const f=fixture(t);f.installAll();f.makePackage(path.join(f.root,'node_modules','smol-toml'));fs.rmSync(path.join(f.root,scopes[2],'node_modules','smol-toml'),{recursive:true});assert.equal(check({root:f.root}).reason,'missing_workspace_dependency');});
test('accepts own pnpm-style virtual-store symlink per scope',t=>{const f=fixture(t);const virtual=f.makePackage(path.join(f.root,'node_modules','.pnpm','smol-toml@1.9.1','node_modules','smol-toml'));for(const s of scopes)fs.symlinkSync(virtual,path.join(f.root,s,'node_modules','smol-toml'),'dir');assert.deepEqual(check({root:f.root}),{allowed:true,reason:'pass'});});
test('refuses an entire linked node_modules directory',t=>{const f=fixture(t);f.installAll();const external=path.join(f.scratch,'foreign-modules');fs.renameSync(path.join(f.root,scopes[1],'node_modules'),external);fs.symlinkSync(external,path.join(f.root,scopes[1],'node_modules'),'dir');assert.equal(check({root:f.root}).reason,'foreign_workspace_dependency');});
test('a package symlink with a dangling target refuses',t=>{const f=fixture(t);f.installAll();const dest=path.join(f.root,scopes[0],'node_modules','smol-toml');fs.rmSync(dest,{recursive:true});fs.symlinkSync(path.join(f.scratch,'missing'),dest,'dir');assert.equal(check({root:f.root}).allowed,false);});
test('rejects injected resolver returning a foreign module file',t=>{const f=fixture(t);f.installAll();const foreign=f.makePackage(path.join(f.scratch,'foreign'));assert.equal(check({root:f.root,resolveDependency:()=>path.join(foreign,'index.js')}).reason,'foreign_workspace_dependency');});
test('rejects resolver pointing at a different local package from scoped link',t=>{const f=fixture(t);f.installAll();const different=f.makePackage(path.join(f.root,'unrelated'));assert.equal(check({root:f.root,resolveDependency:()=>path.join(different,'index.js')}).reason,'foreign_workspace_dependency');});
test('invalid and malformed manifest fail closed without path disclosure',t=>{const f=fixture(t);f.installAll();const m=path.join(f.root,scopes[0],'package.json');fs.writeFileSync(m,'{invalid');const result=check({root:f.root});assert.equal(result.reason,'invalid_workspace_manifest');assert(!JSON.stringify(result).includes(f.scratch));});
test('missing dependency declaration refuses even if installed',t=>{const f=fixture(t);f.installAll();const m=path.join(f.root,scopes[0],'package.json');fs.writeFileSync(m,'{"dependencies":{}}');assert.equal(check({root:f.root}).reason,'undeclared_workspace_dependency');});
test('rejects symlinked owned checkout root',t=>{const f=fixture(t);f.installAll();const link=path.join(f.scratch,'linked-root');fs.symlinkSync(f.root,link,'dir');assert.equal(check({root:link}).reason,'invalid_source_root');});
test('rejects relative root and nonfunction resolver',t=>{const f=fixture(t);assert.equal(check({root:'./'}).reason,'invalid_source_root');assert.equal(check({root:f.root,resolveDependency:null}).reason,'invalid_source_root');});
test('refuses resolvers giving bare/relative module identifiers',t=>{const f=fixture(t);f.installAll();for(const value of ['', 'smol-toml','../../escape'])assert.equal(check({root:f.root,resolveDependency:()=>value}).allowed,false);});
test('accepts only three scoped checks and frozen success',t=>{const f=fixture(t);f.installAll();let n=0;const result=check({root:f.root,resolveDependency:manifest=>{n++;return path.join(path.dirname(manifest),'node_modules','smol-toml','index.js')}});assert.equal(n,3);assert.equal(result.allowed,true);assert(Object.isFrozen(result));});
