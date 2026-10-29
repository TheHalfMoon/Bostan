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

test('real Members browser wrapper blocks cross-origin subrequests/WebSockets context-wide and closes its owned browser',async()=>{
  const {withPrivateMemberBrowser}=await import('./bostan-private-members-browser.mjs');
  let closed=0,blockedHttp=0,blockedWebSockets=0,continued=0;
  const callbacks={};
  const page={
    on(event,handler){callbacks['page:'+event]=handler},
    async goto(){
      const httpRoute=(url)=>({
        request:()=>({url:()=>url}),
        async continue(){continued++},
        async abort(reason){assert.equal(reason,'blockedbyclient');blockedHttp++},
      });
      await callbacks.http(httpRoute('http://127.0.0.1:44551/api/auth/get-session'));
      await callbacks.http(httpRoute('https://untrusted.invalid/private-qa-request'));
      await callbacks.websocket({
        url:()=> 'wss://untrusted.invalid/private-qa-websocket',
        async close(options){assert.equal(options.code,1008);blockedWebSockets++},
      });
      return {status:()=>200};
    },
    getByRole(type){
      assert.equal(type,'heading');
      return {async waitFor(){}};
    },
  };
  const context={
    on(event,handler){callbacks[event]=handler},
    async route(pattern,handler){assert.equal(pattern,'**/*');callbacks.http=handler},
    async routeWebSocket(pattern,handler){assert.equal(pattern,'**/*');callbacks.websocket=handler},
    async addCookies(cookies){assert.equal(cookies.length,1)},
    async addInitScript(){},
    async newPage(){callbacks.page(page);return page},
  };
  const launch=async()=>{
    return {async newContext(options){assert.equal(options.serviceWorkers,'block');return context},
      async close(){closed++}};
  };
  let callbackReached=false;
  await assert.rejects(withPrivateMemberBrowser(good,async({createInvite})=>{
    callbackReached=true;
    await createInvite();
  },{launch}),/Bostan Members Chromium blocked external HTTP request/);
  assert.equal(callbackReached,true);
  assert.equal(continued,1);
  assert.equal(blockedHttp,1);
  assert.equal(blockedWebSockets,1);
  assert.equal(closed,1,'Only the exact owned browser is closed');
});
