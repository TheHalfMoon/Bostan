import test from 'node:test';
import assert from 'node:assert/strict';
import {win32} from 'node:path';
import {assertPrivateWindowsAuthDbWorkspace} from './bostan-private-windows-auth-db-workspace-admission.mjs';

const ROOT='C:\\QA\\Bostan-B211-qa';
const TEMP='D:\\Scratch\\Bostan-B211-temp';
const git=win32.join(ROOT,'.git');
const dirs=[
  'C:\\','C:\\QA',ROOT,git,
  'D:\\','D:\\Scratch',TEMP,
];
function fakeFs({linked=[],aliases={},missing=[],file=[]}={}){
  const nodes=new Map(dirs.map(path=>[path.toLowerCase(),'dir']));
  for(const p of missing)nodes.delete(p.toLowerCase());
  for(const p of file)nodes.set(p.toLowerCase(),'file');
  const visited=[];
  return {
    visited,
    statPath:path=>{
      visited.push(['lstat',path]);
      const type=nodes.get(path.toLowerCase());
      if(!type)throw Error('missing synthetic path');
      return {isDirectory:()=>type==='dir',isSymbolicLink:()=>linked.some(x=>x.toLowerCase()===path.toLowerCase())};
    },
    realPath:path=>{
      visited.push(['realpath',path]);
      return aliases[path.toLowerCase()]??path;
    },
  };
}
const admit=(options={},paths={})=>{
  const fs=fakeFs(options);
  return {fs,run:()=>assertPrivateWindowsAuthDbWorkspace({root:ROOT,temp:TEMP,platform:'win32',...fs,...paths})};
};

test('valid separate-volume, exact matching QA wave and ordinary ancestors are accepted read-only',()=>{
  const {fs,run}=admit();
  assert.deepEqual(run(),{root:ROOT,temp:TEMP});
  assert.ok(fs.visited.some(([op,p])=>op==='lstat'&&p===git));
  assert.ok(fs.visited.some(([op,p])=>op==='realpath'&&p==='D:\\Scratch'));
});
test('linked checkout ancestor is refused before any child or disk work',()=>{
  const {run}=admit({linked:['C:\\QA']});
  assert.throws(run,/refused/);
});
test('linked temp ancestor is refused even when leaf basename matches',()=>{
  const {run}=admit({linked:['D:\\Scratch']});
  assert.throws(run,/refused/);
});
test('realpath alias of a temp ancestor is refused',()=>{
  const {run}=admit({aliases:{'d:\\scratch':'D:\\Foreign'}});
  assert.throws(run,/refused/);
});
test('linked, missing, or non-directory Git metadata is refused',()=>{
  for(const opts of [{linked:[git]},{missing:[git]},{file:[git]}]){
    assert.throws(admit(opts).run,/refused/);
  }
});
test('different wave, UNC/device, drive-relative, traversal, ADS and noncanonical paths refuse',()=>{
  for(const path of [
    {temp:'D:\\Scratch\\Bostan-B212-temp'},
    {temp:'\\\\server\\share\\Bostan-B211-temp'},
    {root:'\\\\?\\C:\\QA\\Bostan-B211-qa'},
    {root:'C:Bostan-B211-qa'},
    {root:'C:\\QA\\..\\QA\\Bostan-B211-qa'},
    {temp:'D:\\Scratch\\.\\Bostan-B211-temp'},
    {temp:'D:\\Scratch\\Bostan-B211-temp:stream'},
    {temp:'D:\\Scratch\\Bostan-B211-temp\\'},
    {temp:'D:/Scratch/Bostan-B211-temp'},
  ])assert.throws(admit({},path).run,/refused/);
});
test('foreign OS and invalid/missing input are refused',()=>{
  for(const paths of [{platform:'linux'},{root:''},{temp:null},{root:'C:\\QA\\Bostan-B211-qa\n'}])
    assert.throws(admit({},paths).run,/refused/);
});
test('read-only fs errors fail closed',()=>{
  const {run}=admit({missing:['D:\\']});
  assert.throws(run,/refused/);
});
