#!/usr/bin/env node
/** Private synthetic first-user sign-up through the compiled Bostan Auth page. */
import {chromium} from '@playwright/test';

export function validatePrivateSignupBrowser({origin,email,name,password}){
  let u;
  try{u=new URL(origin)}catch{throw Error('Invalid private signup origin')}
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!/^\d{4,5}$/.test(u.port)||Number(u.port)<1024||Number(u.port)>65535||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('Private Bostan sign-up requires literal localhost');
  if(typeof email!=='string'||!/^bostan-qa-a-[a-f0-9-]{36}@example\.invalid$/.test(email))throw Error('Only synthetic Bostan QA signup identities are allowed');
  if(typeof name!=='string'||name!=='Bostan QA a')throw Error('Private signup requires the fixed synthetic name');
  if(typeof password!=='string'||!/^Test-only-[a-f0-9]{36}!A2$/.test(password))throw Error('Private signup requires a fresh synthetic password');
  return {origin:u.origin,email,name,password};
}

export async function signupFirstUserWithBrowser(input,{launch=chromium.launch.bind(chromium)}={}){
  const cfg=validatePrivateSignupBrowser(input);
  const browser=await launch({headless:true});
  try{
    const context=await browser.newContext({serviceWorkers:'block'});
    const page=await context.newPage();
    let jsErrors=0,externalRequests=0;
    page.on('pageerror',()=>{jsErrors++});
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(cfg.origin+'/'))return route.continue();
      externalRequests++;return route.abort();
    });
    const response=await page.goto(cfg.origin+'/auth',{waitUntil:'domcontentloaded',timeout:25000});
    if(!response||response.status()!==200)throw Error('Actual Bostan sign-up page could not load');
    await page.getByRole('heading',{name:'Sign in to Bostan'}).waitFor({timeout:22000});
    await page.getByRole('button',{name:'Create one'}).click();
    await page.getByRole('heading',{name:'Create your Bostan account'}).waitFor({timeout:12000});
    await page.getByLabel('Name',{exact:true}).fill(cfg.name);
    await page.getByLabel('Email',{exact:true}).fill(cfg.email);
    await page.getByLabel('Password',{exact:true}).fill(cfg.password);
    const signupResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===cfg.origin+'/api/auth/sign-up/email',{timeout:20000});
    await page.getByRole('button',{name:'Create Account',exact:true}).click();
    const signup=await signupResponse;
    if(signup.status()!==200)throw Error('Real Bostan browser sign-up returned HTTP '+signup.status());
    const payload=await signup.json();
    const id=payload?.user?.id;
    if(typeof id!=='string'||!/^[A-Za-z0-9_-]{8,90}$/.test(id))throw Error('Real browser signup did not create a valid identity');
    const cookies=await context.cookies(cfg.origin);
    const sessions=cookies.filter(c=>c.name.endsWith('session_token')&&c.domain==='127.0.0.1');
    if(sessions.length!==1||!/^[^\s;\r\n]{16,8192}$/.test(sessions[0].value))throw Error('Browser sign-up did not persist exactly one authenticated session');
    if(jsErrors||externalRequests)throw Error('First signup browser emitted JavaScript errors or external requests');
    // Never print the real test cookie or password; the caller must use only
    // this disposable credential and exclude it from receipts/logs.
    return {id,cookie:sessions[0].name+'='+sessions[0].value,createdFromRealUi:true};
  }finally{await browser.close()}
}
