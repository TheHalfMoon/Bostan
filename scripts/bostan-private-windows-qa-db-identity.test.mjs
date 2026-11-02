import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrivateWindowsHttpQaEnvironment as build} from './bostan-private-windows-qa-env.mjs';
const params = {
  home: 'D:\\Bostan-B201-temp\\bostan-private-auth-http-test',
  marker: 'D:\\Bostan-B201-temp\\bostan-private-auth-http-test\\BOSTAN_QA_OWNED',
  origin: 'http://127.0.0.1:43001', port: 43001,
  connectionString: 'postgres://synthetic:temporary@127.0.0.1:54329/paperclip',
  secret: 'synthetic-only-long-random-secret',
};
test('allow exact owned-test database URL shape',()=>{
  const env=build(params);
  assert.equal(env.DATABASE_URL,params.connectionString);
  assert.equal(env.HOST,'127.0.0.1');
});
test('refuse alternate localhost database names',()=>{
  for (const suffix of ['/production','/postgres','/paperclip/other','/']) {
    assert.throws(()=>build({...params,connectionString:`postgres://synthetic:temporary@127.0.0.1:54329${suffix}`}),/isolated loopback PostgreSQL URL/);
  }
});
test('refuse PostgreSQL connection options and fragments',()=>{
  for (const suffix of ['?options=-csearch_path%3Dpublic','#unsafe','?sslmode=disable']) {
    assert.throws(()=>build({...params,connectionString:params.connectionString+suffix}),/isolated loopback PostgreSQL URL/);
  }
});
test('refuse absent credentials',()=>{
  for (const connectionString of ['postgres://127.0.0.1:54329/paperclip','postgres://synthetic@127.0.0.1:54329/paperclip','postgres://:temporary@127.0.0.1:54329/paperclip']) {
    assert.throws(()=>build({...params,connectionString}),/isolated loopback PostgreSQL URL/);
  }
});
test('refuse noncanonical encoded database name',()=>{
  assert.throws(()=>build({...params,connectionString:'postgres://synthetic:temporary@127.0.0.1:54329/%70aperclip'}),/isolated loopback PostgreSQL URL/);
});
test('no operator environment forwarding',()=>{
  const env=build({...params,inherited:{GITHUB_TOKEN:'secret',DATABASE_URL:'postgres://foreign',OPENAI_API_KEY:'secret'}});
  assert.equal(env.GITHUB_TOKEN,undefined);
  assert.equal(env.OPENAI_API_KEY,undefined);
  assert.equal(env.DATABASE_URL,params.connectionString);
});
test('refuse normalized traversal and non-string database URL inputs',()=>{
  assert.throws(()=>build({...params,connectionString:'postgres://synthetic:temporary@127.0.0.1:54329/other/../paperclip'}),/isolated loopback PostgreSQL URL/);
  assert.throws(()=>build({...params,connectionString:new URL(params.connectionString)}),/Invalid private QA database URL/);
});
