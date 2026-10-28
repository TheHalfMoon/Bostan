import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolvePrivateWindowsPowerShellBinary as resolve} from './bostan-private-windows-powershell-binary.mjs';

const safeStat = () => ({isFile:()=>true,isSymbolicLink:()=>false});
const allowed = (systemRoot='C:\\Windows',statBinary=safeStat) =>
  resolve({platform:'win32',systemRoot,statBinary});

test('resolves the actual system executable, not a PATH search',()=>{
  let requested='';
  const binary=allowed('C:\\Windows',path=>{requested=path;return safeStat();});
  assert.equal(binary,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.equal(requested,binary);
  assert.equal(allowed('D:\\WINDOWS'), 'D:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});
test('rejects non-Windows platform and missing/relative/UNC/system-root substitutions',()=>{
  assert.throws(()=>resolve({platform:'linux',systemRoot:'C:\\Windows',statBinary:safeStat}),/unavailable/);
  for(const root of [undefined,'','Windows','C:Windows','\\\\host\\share\\Windows',
    'C:/Windows','C:\\Other','C:\\Windows\\..\\Evil','C:\\Windows\\.\\',
    'C:\\Windows\\..','C:\\Windows\u0000','C:\\Windows\n',
    'C:\\Windows:alt','C:\\Windows\\*', 'C:\\Windows'.repeat(50)]) {
    let calls=0;
    assert.throws(()=>resolve({platform:'win32',systemRoot:root,statBinary:()=>{calls++;return safeStat();}}),/unavailable/);
    assert.equal(calls,0);
  }
});
test('refuses missing binary, directories, symlinks and metadata failures',()=>{
  for(const statBinary of [()=>{throw Error('secret path');},
    ()=>({isFile:()=>false,isSymbolicLink:()=>false}),
    ()=>({isFile:()=>true,isSymbolicLink:()=>true}),
    ()=>({isFile:()=>true}),()=>null,()=>{throw Error('access denied');}]) {
    assert.throws(()=>allowed('C:\\Windows',statBinary),/unavailable/);
  }
});
test('never leaks malicious path, exception or token in rejection',()=>{
  const secret='C:\\Windows\\..\\SECRET_PASSWORD';
  try {allowed(secret);}catch(error){assert.equal(String(error).includes('SECRET_PASSWORD'),false);}
  try {allowed('C:\\Windows',()=>{throw Error('postgres://secret@host');});}
  catch(error){assert.equal(String(error).includes('postgres://'),false);}
});
test('real zero-exit child does not bypass unavailable native executable',()=>{
  const child=spawnSync(process.execPath,['-e','process.exit(0)'],{encoding:'utf8',timeout:5000});
  assert.equal(child.status,0);
  assert.throws(()=>resolve({platform:'win32',systemRoot:'C:\\Windows'}),/unavailable/);
});
