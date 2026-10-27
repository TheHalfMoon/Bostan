import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMemberBrowserTarget} from './bostan-private-members-browser.mjs';
const good={origin:'http://127.0.0.1:44551/',cookie:'better-auth.session_token=abc123xyz%2Ffoo%3Dbar.and-signed-verification',companyId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyPrefix:'BOS'};
test('private signed browser fixture accepts actual Better Auth cookie serialization',()=>{
  const result=validateMemberBrowserTarget(good);
  assert.equal(result.origin,'http://127.0.0.1:44551');
  assert.equal(result.name,'better-auth.session_token');
  assert.equal(result.companyPrefix,'BOS');
  assert.equal(result.value,'abc123xyz%2Ffoo%3Dbar.and-signed-verification');
});
test('private browser refuses external hosts, mutation outside company, and header injection',()=>{
  for(const origin of ['https://127.0.0.1:44551/','http://localhost:44551/','http://example.com:44551/','http://127.0.0.1:44551/admin','http://127.0.0.1:80/'])assert.throws(()=>validateMemberBrowserTarget({...good,origin}));
  for(const cookie of ['foo=bar','better-auth.session_token=short','better-auth.session_token=abc123def456ghi789; Path=/','better-auth.session_token=abc123def456ghi789\r\nInjected: yes'])assert.throws(()=>validateMemberBrowserTarget({...good,cookie}));
  assert.throws(()=>validateMemberBrowserTarget({...good,companyId:'../../../etc'}));
  for(const companyPrefix of ['', '../evil','bos', 'BOS/other'])assert.throws(()=>validateMemberBrowserTarget({...good,companyPrefix}));
});
