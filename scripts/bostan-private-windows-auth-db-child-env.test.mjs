import test from 'node:test';
import assert from 'node:assert/strict';
import {invokePrivateWindowsAuthDbCaptured} from './bostan-private-windows-auth-db-captured-child.mjs';
const command={binary:process.execPath,args:['-e','process.exit(0)'],cwd:process.cwd(),timeout:5000};
const fixture='D:\\Bostan-B217-temp';
const native=Object.freeze({
  SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',SystemDrive:'C:',
  PATH:'C:\\Windows\\System32',PATHEXT:'.COM;.EXE;.BAT;.CMD',
  ComSpec:'C:\\Windows\\System32\\cmd.exe',
  HOME:fixture,USERPROFILE:fixture,TEMP:fixture,TMP:fixture,
  APPDATA:fixture,LOCALAPPDATA:fixture,XDG_CONFIG_HOME:fixture,
  CI:'1',DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1',npm_config_offline:'true',
  PAPERCLIP_TEST_POSTGRES_TEMPLATE:'0',
});
const run=env=>{let called=0;const result=invokePrivateWindowsAuthDbCaptured(command,{env,spawn:()=>{called++;return {status:0};}});return {result,called};};
test('accepts exact native synthetic offline environment',()=>{
  assert.deepEqual(run(native),{result:{status:0},called:1});
});
test('rejects enabling package-network access or PostgreSQL template reuse',()=>{
  for(const [key,value] of [['npm_config_offline','false'],['PAPERCLIP_TEST_POSTGRES_TEMPLATE','1'],
    ['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD','0'],['OTEL_SDK_DISABLED','false'],['DO_NOT_TRACK','0'],['CI','0']])
    assert.deepEqual(run({...native,[key]:value}),{result:{status:1},called:0});
});
test('rejects missing native offline controls before spawn',()=>{
  for(const key of ['npm_config_offline','PAPERCLIP_TEST_POSTGRES_TEMPLATE','CI']){
    const env={...native};delete env[key];
    assert.deepEqual(run(env),{result:{status:1},called:0});
  }
});
test('rejects foreign profile and split synthetic scratch directories',()=>{
  for(const key of ['HOME','USERPROFILE','TMP','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME'])
    assert.deepEqual(run({...native,[key]:'C:\\Users\\Operator'}),{result:{status:1},called:0});
});
test('rejects non-wave, UNC, device, traversal and ADS TEMP paths',()=>{
  for(const temp of ['C:\\Users\\Operator','\\\\server\\share\\Bostan-B217-temp',
    '\\\\?\\C:\\Bostan-B217-temp','D:\\tmp\\..\\Bostan-B217-temp',
    'D:\\Bostan-B217-temp:stream','D:\\NUL\\Bostan-B217-temp',
    'D:\\Bostan-B217-temp.']){
    const env={...native};for(const key of ['HOME','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME'])env[key]=temp;
    assert.deepEqual(run(env),{result:{status:1},called:0});
  }
});
test('rejects ambient synthetic paths without Windows SystemRoot',()=>{
  assert.deepEqual(run({CI:'1',PATH:'',HOME:'C:\\Users\\Operator'}),{result:{status:1},called:0});
});
test('preserves minimal offline unit fixture and rejects disabling controls',()=>{
  assert.deepEqual(run({CI:'1',PATH:''}),{result:{status:0},called:1});
  assert.deepEqual(run({CI:'1',PATH:'',npm_config_offline:'false'}),{result:{status:1},called:0});
});
