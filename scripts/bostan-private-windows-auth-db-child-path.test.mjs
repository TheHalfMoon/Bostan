import test from 'node:test';
import assert from 'node:assert/strict';
import {invokePrivateWindowsAuthDbCaptured} from './bostan-private-windows-auth-db-captured-child.mjs';

const temp='D:\\Bostan-B218-temp';
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',SystemDrive:'C:',
  PATH:'C:\\Windows\\System32',PATHEXT:'.COM;.EXE;.BAT;.CMD',
  ComSpec:'C:\\Windows\\System32\\cmd.exe',CI:'1',
  HOME:temp,USERPROFILE:temp,TEMP:temp,TMP:temp,
  APPDATA:temp,LOCALAPPDATA:temp,XDG_CONFIG_HOME:temp,
  DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1',npm_config_offline:'true',
  PAPERCLIP_TEST_POSTGRES_TEMPLATE:'0'};
const base={binary:'C:\\Program Files\\nodejs\\node.exe',args:['--version'],cwd:'D:\\Bostan-QA',timeout:2000};
const run=(command,childEnv=env)=>{
  let calls=0;
  const result=invokePrivateWindowsAuthDbCaptured(command,{env:childEnv,spawn:()=>{calls++;return {status:0};}});
  return {result,calls};
};
test('canonical drive-rooted Windows executable and cwd are admitted in native-env simulation',()=>{
  assert.deepEqual(run(base),{result:{status:0},calls:1});
});
test('Windows environment refuses POSIX absolute executable and cwd even on Linux',()=>{
  assert.deepEqual(run({...base,binary:process.execPath,cwd:process.cwd()}),{result:{status:1},calls:0});
});
test('refuses UNC and device namespace paths before spawn',()=>{
  for(const bad of ['\\\\server\\share\\node.exe','\\\\?\\C:\\Program Files\\nodejs\\node.exe',
    '\\\\.\\C:\\Program Files\\nodejs\\node.exe']) {
    assert.deepEqual(run({...base,binary:bad}),{result:{status:1},calls:0});
    assert.deepEqual(run({...base,cwd:bad}),{result:{status:1},calls:0});
  }
});
test('refuses dot segments, mixed separators and ADS in Windows child paths',()=>{
  for(const bad of ['C:\\QA\\..\\node.exe','C:\\QA\\.\\node.exe',
    'C:/QA/node.exe','C:\\QA\\node.exe:stream','C:\\QA\\node.exe\\']) {
    assert.deepEqual(run({...base,binary:bad}),{result:{status:1},calls:0});
    assert.deepEqual(run({...base,cwd:bad}),{result:{status:1},calls:0});
  }
});
test('refuses Windows reserved names, control characters and trailing dot/space',()=>{
  for(const bad of ['C:\\QA\\CON.exe','C:\\QA\\AUX','C:\\QA\\folder.\\node.exe',
    'C:\\QA\\folder \\node.exe','C:\\QA\\bad\nnode.exe']) {
    assert.deepEqual(run({...base,binary:bad}),{result:{status:1},calls:0});
  }
});
test('minimal POSIX synthetic child remains available for isolated Linux tests',()=>{
  assert.deepEqual(run({binary:process.execPath,args:['--version'],cwd:process.cwd(),timeout:2000},
    {CI:'1',PATH:''}),{result:{status:0},calls:1});
});
