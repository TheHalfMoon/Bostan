import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMemberBrowserTarget,classifyPrivateMembersPageError,summarizePrivateMembersPageError} from './bostan-private-members-browser.mjs';
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


test('Members page error classifier exposes only fixed non-sensitive classes',()=>{
  for(const [sample,expected] of [
    [{message:"Cannot read properties of undefined (reading 'foo')"},'undefined_property'],
    [{message:"Cannot read properties of null (reading 'foo')"},'null_property'],
    [{message:'x is not a function'},'not_function'],
    [{message:'Unrecognized extension value in extension set'},'editor_extension'],
    [{message:'Failed to fetch dynamically imported module: https://hidden.invalid/private?q=token'},'module_load'],
    [{message:'Minified React error #418'},'react_runtime'],
    [{message:'Failed to fetch'},'network_error'],
    [{name:'SyntaxError',message:'random attacker secret in script'},'syntax_error'],
    [{message:'sensitive-token-DO-NOT-PRINT'},'unclassified'],
  ])assert.equal(classifyPrivateMembersPageError(sample),expected);
});


test('Members JavaScript exception summary never emits unknown or sensitive content',()=>{
  const summary=summarizePrivateMembersPageError({
    name:'TypeError',
    message:'Failed to render React component, secret.user@internal.invalid '+
      'postgres://user:PRIVATE_PASSWORD@127.0.0.1:5432/x',
  });
  assert.deepEqual(Object.keys(summary).sort(),
    ['category','kind','lengthBand','lexicon'].sort());
  assert.equal(summary.kind,'TypeError');
  assert.match(summary.lexicon,/react/);
  assert.ok(!JSON.stringify(summary).includes('PRIVATE_PASSWORD'));
  assert.ok(!JSON.stringify(summary).includes('internal.invalid'));
  assert.deepEqual(summarizePrivateMembersPageError({
    name:'OtherSecretName',message:'credential=SUPER_PRIVATE',
  }),{kind:'other',category:'unclassified',lexicon:'',lengthBand:'short'});
});
