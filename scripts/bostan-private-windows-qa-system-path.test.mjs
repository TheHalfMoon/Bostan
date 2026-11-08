import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrivateWindowsHttpQaEnvironment as build} from './bostan-private-windows-qa-env.mjs';

const fixture = {
  home:'D:\\Bostan-B204-temp\\bostan-private-auth-http-test',
  marker:'D:\\Bostan-B204-temp\\bostan-private-auth-http-test\\BOSTAN_QA_OWNED',
  origin:'http://127.0.0.1:43001',port:43001,
  connectionString:'postgres://synthetic:temporary@127.0.0.1:54329/paperclip',
  secret:'synthetic-only-long-random-secret',
};

test('operator PATH and shell cannot enter the isolated server child',()=>{
  const env=build({...fixture,inherited:{
    SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',
    PATH:'C:\\Users\\Operator\\bin;C:\\Windows\\System32',
    ComSpec:'C:\\Users\\Operator\\cmd.exe',PATHEXT:'.JS;.EXE',
    SystemDrive:'Z:',PROCESSOR_ARCHITECTURE:'AMD64',
  }});
  assert.equal(env.PATH,'C:\\Windows\\System32');
  assert.equal(env.ComSpec,'C:\\Windows\\System32\\cmd.exe');
  assert.equal(env.PATHEXT,'.COM;.EXE;.BAT;.CMD');
  assert.equal(env.SystemDrive,'C:');
  assert.equal(env.SystemRoot,'C:\\Windows');
  assert.equal(env.WINDIR,'C:\\Windows');
});

test('refuse malformed system root instead of inheriting executable search paths',()=>{
  for (const root of ['C:\\Users\\Operator\\Windows','C:\\Windows\\..\\Users\\Operator','\\\\server\\share\\Windows','C:/Windows','C:\\Windows;C:\\Users\\Operator','C:\\Windows\\System32']) {
    assert.throws(()=>build({...fixture,inherited:{SystemRoot:root,PATH:'C:\\Users\\Operator\\bin'}}),/Windows QA system root/);
  }
});

test('operator PATH alone without OS root is refused',()=>{
  assert.throws(()=>build({...fixture,inherited:{Path:'D:\\Operator\\bin',ComSpec:'D:\\Operator\\shell.exe'}}),/Windows QA system root/);
});
