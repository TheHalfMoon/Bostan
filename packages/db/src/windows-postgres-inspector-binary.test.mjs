import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveWindowsPostgresInspectorBinary as resolve} from './windows-postgres-inspector-binary.mjs';
const directory=()=>({isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false});
const file=()=>({isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false});
const stat=path=>path.toLowerCase().endsWith('powershell.exe')?file():directory();
const allowed=(root='C:\\Windows',fn=stat)=>resolve({platform:'win32',systemRoot:root,statPath:fn});
test('pins a canonical direct OS binary and verifies every ancestor',()=>{
  const paths=[];
  const binary=allowed('C:\\Windows',p=>{paths.push(p);return stat(p);});
  assert.equal(binary,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(paths,['C:\\Windows','C:\\Windows\\System32',
    'C:\\Windows\\System32\\WindowsPowerShell',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',binary]);
});
test('accepts an alternate direct Windows drive root and optional single trailing slash',()=>{
  assert.equal(allowed('D:\\WINDOWS'),'D:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.equal(allowed('E:\\Windows\\'),'E:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});
test('rejects nested lookalike OS directories before any filesystem access',()=>{
  for(const root of ['C:\\Untrusted\\Windows','C:\\Users\\me\\Windows','C:\\Windows\\Windows','C:\\Windows\\..\\Windows']){
    let reads=0;
    assert.throws(()=>allowed(root,()=>{reads++;return directory();}),/retaining fixture/);
    assert.equal(reads,0);
  }
});
test('rejects UNC, device namespaces, drive-relative, alternate streams and untrusted roots',()=>{
  for(const root of ['','Windows','C:Windows','\\\\server\\share\\Windows',
    '\\\\?\\C:\\Windows','C:/Windows','C:\\Other','C:\\Windows\\.\\',
    'C:\\Windows\\..','C:\\Windows\\\\','C:\\Windows:evil',
    'C:\\Windows ','C:\\Windows\u0000'])assert.throws(()=>allowed(root),/retaining fixture/);
});
test('refuses linked/missing/foreign components throughout OS directory chain',()=>{
  const invalid=[null,()=>{throw Error('sensitive root');},
    ()=>({isDirectory:()=>false,isSymbolicLink:()=>false}),
    ()=>({isDirectory:()=>true,isSymbolicLink:()=>true}),
    ()=>({isDirectory:()=>true})];
  for(let index=0;index<4;index++)for(const bad of invalid){
    let seen=0;
    assert.throws(()=>allowed('C:\\Windows',path=>{
      const i=seen++;return i===index?(typeof bad==='function'?bad():bad):stat(path);
    }),/retaining fixture/);
  }
});
test('refuses linked, missing, or non-file PowerShell binary',()=>{
  for(const bad of [()=>{throw Error('sensitive key');},()=>null,
    ()=>({isFile:()=>false,isSymbolicLink:()=>false}),
    ()=>({isFile:()=>true,isSymbolicLink:()=>true}),
    ()=>({isFile:()=>true})])assert.throws(()=>allowed('C:\\Windows',p=>p.toLowerCase().endsWith('powershell.exe')?bad():directory()),/retaining fixture/);
});
test('refuses non-Windows and a malformed injector',()=>{
  assert.throws(()=>resolve({platform:'win32',systemRoot:undefined,statPath:stat}),/retaining fixture/);
  assert.throws(()=>resolve({platform:'linux',systemRoot:'C:\\Windows',statPath:stat}),/retaining fixture/);
  assert.throws(()=>resolve({platform:'win32',systemRoot:'C:\\Windows',statPath:null}),/retaining fixture/);
});
test('errors do not contain injected secrets or filesystem paths',()=>{
  assert.throws(()=>allowed('C:\\Sensitive\\Windows'),e=>!e.message.includes('Sensitive'));
  assert.throws(()=>allowed('C:\\Windows',()=>{throw Error('postgres://secret:p@localhost');}),e=>!e.message.includes('secret'));
});
