import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrivateWindowsHttpQaEnvironment as build} from './bostan-private-windows-qa-env.mjs';

const params = {
  inherited:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},
  home:'D:\\Bostan-B206-temp\\bostan-private-auth-http-abc123',
  marker:'D:\\Bostan-B206-temp\\bostan-private-auth-http-abc123\\BOSTAN_QA_OWNED',
  origin:'http://127.0.0.1:43001',port:43001,
  connectionString:'postgres://synthetic:temporary@127.0.0.1:54329/paperclip',
  secret:'synthetic-only-long-random-secret',
};
const refuse = update => assert.throws(()=>build({...params,...update}),
  /private QA fixture|Windows QA system root|Missing isolated private QA fixture/);

test('canonical owned-home marker and pinned child environment pass',()=>{
  const env=build(params);
  assert.equal(env.BOSTAN_PRIVATE_QA_MARKER,params.marker);
  assert.equal(env.PAPERCLIP_HOME,params.home);
  assert.equal(env.APPDATA,params.home+'\\AppData\\Roaming');
});
test('foreign marker outside owned HOME is refused',()=>refuse({marker:'D:\\Bostan-B206-temp\\foreign\\BOSTAN_QA_OWNED'}));
test('copyable marker filename at another child path is refused',()=>refuse({marker:params.home+'\\nested\\BOSTAN_QA_OWNED'}));
test('HOME without the generated QA scratch leaf is refused',()=>refuse({home:'D:\\Users\\Operator',marker:'D:\\Users\\Operator\\BOSTAN_QA_OWNED'}));
test('HOME with parent traversal is refused',()=>refuse({home:'D:\\Bostan-B206-temp\\..\\bostan-private-auth-http-abc123',marker:'D:\\Bostan-B206-temp\\..\\bostan-private-auth-http-abc123\\BOSTAN_QA_OWNED'}));
test('UNC, device namespace, and drive-relative HOME are refused',()=>{
  for(const home of ['\\\\host\\share\\bostan-private-auth-http-a','\\\\?\\D:\\bostan-private-auth-http-a','D:bostan-private-auth-http-a'])
    refuse({home,marker:home+'\\BOSTAN_QA_OWNED'});
});
test('alternate data streams, control chars, and trailing dots are refused',()=>{
  for(const home of ['D:\\temp\\bostan-private-auth-http-a:stream','D:\\temp\\bostan-private-auth-http-a.','D:\\temp\\bostan-private-auth-http-a\n'])
    refuse({home,marker:home+'\\BOSTAN_QA_OWNED'});
});
test('weak or control-bearing Better Auth secret is refused',()=>{
  for(const secret of ['x','a'.repeat(23),'a'.repeat(24)+'\n']) refuse({secret});
});
test('mismatched SystemRoot and WINDIR are refused before child spawn',()=>refuse({inherited:{SystemRoot:'C:\\Windows',WINDIR:'D:\\Windows'}}));
test('WINDIR-only OS root is refused to match earlier executable admission',()=>refuse({inherited:{WINDIR:'C:\\Windows'}}));
test('canonical Windows directory casing is accepted case-insensitively',()=>{
  const env=build({...params,inherited:{SystemRoot:'C:\\WINDOWS',WINDIR:'c:\\windows'}});
  assert.equal(env.SystemRoot,'C:\\WINDOWS');
  assert.equal(env.ComSpec,'C:\\WINDOWS\\System32\\cmd.exe');
});
