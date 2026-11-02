import test from 'node:test';
import assert from 'node:assert/strict';
import {invokePrivateWindowsAuthDbCaptured} from './bostan-private-windows-auth-db-captured-child.mjs';

const base={binary:process.execPath,args:['--version'],cwd:process.cwd(),timeout:2000};
const env={CI:'1',PATH:''};
const exercise=(command,childEnv=env)=>{
  let called=0;
  const result=invokePrivateWindowsAuthDbCaptured(command,{env:childEnv,spawn:()=>{called++;return {status:0};}});
  return {result,called};
};
test('rejects PATH-resolved bare executable before child spawn',()=>{
  assert.deepEqual(exercise({...base,binary:'node'}),{result:{status:1},called:0});
});
test('rejects relative working directory before child spawn',()=>{
  assert.deepEqual(exercise({...base,cwd:'.'}),{result:{status:1},called:0});
});
test('rejects inherited credential and Node preload environment before child spawn',()=>{
  for(const key of ['AWS_SECRET_ACCESS_KEY','NODE_OPTIONS','NODE_PATH','LD_PRELOAD','BOSTAN_FOREIGN_SECRET']){
    assert.deepEqual(exercise(base,{...env,[key]:'SYNTHETIC_SENTINEL'}),{result:{status:1},called:0});
  }
});
test('rejects case-folded duplicate Windows environment keys before child spawn',()=>{
  assert.deepEqual(exercise(base,{...env,path:'/untrusted'}),{result:{status:1},called:0});
});
test('allows only absolute planned child and explicit safe environment',()=>{
  assert.deepEqual(exercise(base),{result:{status:0},called:1});
});

test('rejects foreign PATH even when its name is allowlisted',()=>{
  const windowsEnv={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',SystemDrive:'C:',
    PATH:'C:\\untrusted',ComSpec:'C:\\Windows\\System32\\cmd.exe'};
  assert.deepEqual(exercise(base,windowsEnv),{result:{status:1},called:0});
});
test('accepts canonical pinned Windows search path with only allowed keys',()=>{
  const temp='D:\\Bostan-B217-temp';
  const windowsEnv={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',SystemDrive:'C:',
    PATH:'C:\\Windows\\System32',PATHEXT:'.COM;.EXE;.BAT;.CMD',
    ComSpec:'C:\\Windows\\System32\\cmd.exe',CI:'1',
    HOME:temp,USERPROFILE:temp,TEMP:temp,TMP:temp,
    APPDATA:temp,LOCALAPPDATA:temp,XDG_CONFIG_HOME:temp,
    DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1',npm_config_offline:'true',
    PAPERCLIP_TEST_POSTGRES_TEMPLATE:'0'};
  assert.deepEqual(exercise(base,windowsEnv),{result:{status:0},called:1});
});
