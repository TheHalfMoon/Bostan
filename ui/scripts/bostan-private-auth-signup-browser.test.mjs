import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validatePrivateSignupBrowser,signupFirstUserWithBrowser} from './bostan-private-auth-signup-browser.mjs';

const valid={origin:'http://127.0.0.1:45555/',email:'bostan-qa-a-11111111-2222-3333-4444-555555555555@example.invalid',name:'Bostan QA a',password:'Test-only-0123456789abcdef0123456789abcdef0123!A2'};

test('private browser signup is strictly disposable, synthetic and loopback-only',()=>{
  assert.equal(validatePrivateSignupBrowser(valid).origin,'http://127.0.0.1:45555');
  for(const origin of ['https://127.0.0.1:45555/','http://localhost:45555/','http://127.0.0.1:80/','http://evil.test:45555/','http://127.0.0.1:45555/extra'])assert.throws(()=>validatePrivateSignupBrowser({...valid,origin}));
  for(const email of ['bostan-qa-a-11111111-2222-3333-4444-555555555555@gmail.com','real@example.com','bostan-qa-a-evil@example.invalid'])assert.throws(()=>validatePrivateSignupBrowser({...valid,email}));
  assert.throws(()=>validatePrivateSignupBrowser({...valid,name:'Real User'}));
  assert.throws(()=>validatePrivateSignupBrowser({...valid,password:'Paid-Account-Password'}));
});

test('private signup browser closes after error and refuses invalid fixture before launching',async()=>{
  let launched=0,closed=0;
  const launch=async()=>{launched++;return {newContext:async()=>{throw Error('synthetic browser error')},close:async()=>{closed++}}};
  await assert.rejects(signupFirstUserWithBrowser({...valid,origin:'https://example.com/'},{launch}),/localhost/);
  assert.equal(launched,0);
  await assert.rejects(signupFirstUserWithBrowser(valid,{launch}),/synthetic browser error/);
  assert.equal(launched,1);assert.equal(closed,1);
});
