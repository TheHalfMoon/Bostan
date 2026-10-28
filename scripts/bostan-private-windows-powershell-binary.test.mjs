import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolvePrivateWindowsPowerShellBinary as resolve} from './bostan-private-windows-powershell-binary.mjs';

const dir = () => ({isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false});
const file = () => ({isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>false});
const safeStat = path => path.toLowerCase().endsWith('powershell.exe') ? file() : dir();
const allowed = (systemRoot='C:\\Windows',statPath=safeStat) =>
  resolve({platform:'win32',systemRoot,statPath});

test('pins direct OS Windows path and inspects every ancestor and leaf',()=>{
  const paths=[];
  const binary=allowed('C:\\Windows',path=>{paths.push(path);return safeStat(path);});
  assert.equal(binary,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(paths,[
    'C:\\Windows',
    'C:\\Windows\\System32',
    'C:\\Windows\\System32\\WindowsPowerShell',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
    binary,
  ]);
  assert.equal(allowed('D:\\WINDOWS'), 'D:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.equal(allowed('E:\\Windows\\'), 'E:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});

test('rejects nested lookalike Windows directories BEFORE filesystem access',()=>{
  for(const systemRoot of ['C:\\Untrusted\\Windows','C:\\Users\\me\\Windows',
    'D:\\Temp\\Windows','C:\\Windows\\Windows','C:\\Windows\\..\\Windows']){
    let calls=0;
    assert.throws(()=>resolve({platform:'win32',systemRoot,statPath:()=>{calls++;return safeStat('powershell.exe');}}),/unavailable/);
    assert.equal(calls,0);
  }
});

test('rejects non-Windows, relative, UNC, device, alternate-stream and malformed roots',()=>{
  assert.throws(()=>resolve({platform:'linux',systemRoot:'C:\\Windows',statPath:safeStat}),/unavailable/);
  for(const systemRoot of [undefined,'','Windows','C:Windows','\\\\host\\share\\Windows',
    '\\\\?\\C:\\Windows','C:/Windows','C:\\Other','C:\\Windows\\.\\',
    'C:\\Windows\\..','C:\\Windows\u0000','C:\\Windows\n','C:\\Windows:alt',
    'C:\\Windows\\*','C:\\Windows\\\\','C:\\Windows ', 'C:\\Windows'.repeat(50)]){
    let calls=0;
    assert.throws(()=>resolve({platform:'win32',systemRoot,statPath:()=>{calls++;return safeStat('powershell.exe');}}),/unavailable/);
    assert.equal(calls,0);
  }
});

test('rejects any missing, linked, or non-directory ancestor',()=>{
  for(let failIndex=0;failIndex<4;failIndex++){
    for(const broken of [()=>{throw Error('sensitive path');},
      ()=>({isDirectory:()=>false,isSymbolicLink:()=>false}),
      ()=>({isDirectory:()=>true,isSymbolicLink:()=>true}),
      ()=>({isDirectory:()=>true}),()=>null]){
      let index=0;
      assert.throws(()=>allowed('C:\\Windows',path=>{
        const i=index++;
        return i===failIndex?broken():safeStat(path);
      }),/unavailable/);
    }
  }
});

test('rejects missing, linked, non-file and inaccessible binary',()=>{
  for(const broken of [()=>{throw Error('secret token');},
    ()=>({isFile:()=>false,isSymbolicLink:()=>false}),
    ()=>({isFile:()=>true,isSymbolicLink:()=>true}),
    ()=>({isFile:()=>true}),()=>null]){
    assert.throws(()=>allowed('C:\\Windows',path=>path.endsWith('powershell.exe')?broken():dir()),/unavailable/);
  }
});

test('never leaks malicious path or metadata error in rejection',()=>{
  const secret='C:\\Sensitive\\Windows';
  assert.throws(()=>allowed(secret),error=>!String(error).includes('Sensitive'));
  assert.throws(()=>allowed('C:\\Windows',()=>{throw Error('postgres://user:password@host');}),
    error=>!String(error).includes('password'));
});

test('real zero-exit subprocess cannot bypass absent native Windows system tree',()=>{
  const child=spawnSync(process.execPath,['-e','process.exit(0)'],{encoding:'utf8',timeout:5000});
  assert.equal(child.status,0);
  assert.throws(()=>resolve({platform:'win32',systemRoot:'C:\\Windows'}),/unavailable/);
});
