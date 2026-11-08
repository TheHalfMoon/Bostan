import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateFirstAdminBrowserTarget,claimFirstAdminWithBrowser} from './bostan-private-first-admin-browser.mjs';

const safe={origin:'http://127.0.0.1:44551/',cookie:'better-auth.session_token=abc123xyz%2Ffoo%3Dbar.and-signed-verification',expectedUserId:'synthetic-user-12345'};

test('private first-admin browser requires exact loopback, user and real signed session cookie',()=>{
  const valid=validateFirstAdminBrowserTarget(safe);
  assert.equal(valid.origin,'http://127.0.0.1:44551');
  assert.equal(valid.name,'better-auth.session_token');
  assert.equal(valid.expectedUserId,'synthetic-user-12345');
  for(const origin of ['https://127.0.0.1:44551/','http://localhost:44551/','http://127.0.0.1:80/','http://127.0.0.1:44551/evil','http://example.com:44551/','http://127.0.0.1:44551/?a=1','http://bob@127.0.0.1:44551/']){
    assert.throws(()=>validateFirstAdminBrowserTarget({...safe,origin}));
  }
  for(const cookie of ['foo=abc123def456ghi789','better-auth.session_token=short','better-auth.session_token=abc123def456ghi789; path=/','better-auth.session_token=abc123def456ghi789\r\nMalicious: header','better-auth.session_token='])assert.throws(()=>validateFirstAdminBrowserTarget({...safe,cookie}));
  for(const expectedUserId of ['', 'x', '../../../etc', 'user id\nheader'])assert.throws(()=>validateFirstAdminBrowserTarget({...safe,expectedUserId}));
});

test('first-admin browser closes Chromium on early failure and never launches on invalid input',async()=>{
  let launched=0,closed=0;
  const launch=async()=>{
    launched++;
    return {newContext:async()=>{throw Error('synthetic browser failure')},close:async()=>{closed++}};
  };
  await assert.rejects(claimFirstAdminWithBrowser({...safe,origin:'https://evil.test/'},{launch}),/loopback/);
  assert.equal(launched,0);
  await assert.rejects(claimFirstAdminWithBrowser(safe,{launch}),/synthetic browser failure/);
  assert.equal(launched,1);
  assert.equal(closed,1);
});
