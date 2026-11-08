import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {validateLinuxBuildClosure} from './bostan-private-linux-native-build-closure.mjs';
const executable=fileURLToPath(new URL('./bostan-private-linux-native-build-closure.mjs',import.meta.url));
const packages={
  'shared:typescript':{name:'typescript',version:'7.0.2',
    optionalDependencies:{'@typescript/typescript-linux-x64':'7.0.2'}},
  'typescript:@typescript/typescript-linux-x64':{name:'@typescript/typescript-linux-x64',version:'7.0.2'},
  'shared:@types/node':{name:'@types/node',version:'24.0.0'},
  'ui:@types/react':{name:'@types/react',version:'19.2.18'},
  'ui:vite':{name:'vite',version:'8.2.2'},
  'vite:rolldown':{name:'rolldown',version:'1.2.5',
    optionalDependencies:{'@rolldown/binding-linux-x64-gnu':'1.2.5'}},
  'rolldown:@rolldown/binding-linux-x64-gnu':{name:'@rolldown/binding-linux-x64-gnu',version:'1.2.5'},
};
function inspect(mutated={}){
  return validateLinuxBuildClosure({readPackage:(parent,name)=>{
    const key=parent+':'+name;
    if(Object.prototype.hasOwnProperty.call(mutated,key))return mutated[key];
    if(!packages[key])throw Error('missing '+key);
    return packages[key];
  }});
}
test('real Linux compiler/rolldown native optional bindings remain mandatory',()=>{
  const r=inspect();
  assert.equal(r.qualified,true);
  assert.equal(r.releaseQualified,false);
  assert.equal(r.installedPackagesChecked,7);
  assert.equal(r.nativeTypeScriptVersion,'7.0.2');
  assert.equal(r.rolldownNativeVersion,'1.2.5');
  assert.equal(r.optionalNativePackagesRequired,true);
});
test('reject non-Linux/glibc platforms and obsolete Node',()=>{
  for(const bad of [{platform:'darwin'},{platform:'win32'}, {arch:'arm64'},
    {glibc:false},{nodeMajor:22}])
    assert.throws(()=>validateLinuxBuildClosure({readPackage:()=>({}),...bad}),/requires Linux x64 glibc/);
});
test('rejects absent TypeScript native binary, React types, Node types or Rolldown native',()=>{
  for(const key of ['typescript:@typescript/typescript-linux-x64',
    'shared:@types/node','ui:@types/react','rolldown:@rolldown/binding-linux-x64-gnu']){
    assert.throws(()=>inspect({[key]:null}),/Missing native Linux build dependency|Invalid native Linux build dependency/);
  }
});
test('rejects version mismatches in native optional compiler/rolldown closure',()=>{
  assert.throws(()=>inspect({
    'typescript:@typescript/typescript-linux-x64':{name:'@typescript/typescript-linux-x64',version:'7.0.1'},
  }),/does not match TypeScript/);
  assert.throws(()=>inspect({
    'rolldown:@rolldown/binding-linux-x64-gnu':{name:'@rolldown/binding-linux-x64-gnu',version:'1.2.3'},
  }),/does not match its parent/);
});
test('does not permit publication or background installation',()=>{
  for(const args of [[],['--plan']]){
    const r=spawnSync(process.execPath,[executable,...args],{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(r.stdout).run,false);
  }
  for(const args of [['--publish'],['--run'],['--check','--publish']]){
    const r=spawnSync(process.execPath,[executable,...args],{encoding:'utf8'});
    assert.equal(r.status,2);
  }
  if(process.platform!=='linux'){
    const r=spawnSync(process.execPath,[executable,'--check'],{encoding:'utf8'});
    assert.equal(r.status,2);
  }
});
