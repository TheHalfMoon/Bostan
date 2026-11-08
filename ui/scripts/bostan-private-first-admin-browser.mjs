#!/usr/bin/env node
/** Private, opt-in first-admin claim through the ACTUAL compiled Bostan UI. */
import {chromium} from '@playwright/test';

export function validateFirstAdminBrowserTarget({origin,cookie,expectedUserId}){
  let u;
  try{u=new URL(origin)}catch{throw Error('Invalid private Bostan browser origin')}
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!/^\d{4,5}$/.test(u.port)||Number(u.port)<1024||Number(u.port)>65535||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('First-admin browser requires an explicit loopback HTTP origin');
  if(typeof expectedUserId!=='string'||!/^[A-Za-z0-9_-]{8,90}$/.test(expectedUserId))throw Error('First-admin browser requires a test user identity');
  if(typeof cookie!=='string'||!/^([a-zA-Z0-9_.-]+)=([^\s;\r\n]{16,8192})$/.test(cookie)||!cookie.slice(0,cookie.indexOf('=')).endsWith('session_token'))throw Error('First-admin browser requires one actual Better Auth session cookie');
  const equal=cookie.indexOf('=');
  return {origin:u.origin,name:cookie.slice(0,equal),value:cookie.slice(equal+1),expectedUserId};
}

export async function claimFirstAdminWithBrowser(input,{launch=chromium.launch.bind(chromium)}={}){
  const cfg=validateFirstAdminBrowserTarget(input);
  const browser=await launch({headless:true});
  try{
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addCookies([{name:cfg.name,value:cfg.value,url:cfg.origin,httpOnly:true,sameSite:'Lax'}]);
    const page=await context.newPage();
    let browserJsErrors=0;
    let externalBrowserRequests=0;
    page.on('pageerror',()=>{browserJsErrors++});
    await page.route('**/*',route=>{
      if(route.request().url().startsWith(cfg.origin+'/'))return route.continue();
      externalBrowserRequests++;
      return route.abort();
    });
    const opening=await page.goto(cfg.origin+'/',{waitUntil:'domcontentloaded',timeout:25000});
    if(!opening||opening.status()!==200)throw Error('First-admin browser could not load production Bostan');
    await page.getByRole('heading',{name:'Finish setting up Bostan'}).waitFor({timeout:22000});
    const button=page.getByRole('button',{name:'Claim this instance',exact:true});
    await button.waitFor({timeout:12000});
    const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===cfg.origin+'/api/bootstrap/claim',{timeout:20000});
    await button.click();
    const response=await responsePromise;
    if(response.status()!==200)throw Error('Real Bostan first-admin browser claim rejected with '+response.status());
    const claim=await response.json();
    if(claim?.claimed!==true||claim.userId!==cfg.expectedUserId)throw Error('First-admin claim API did not bind the authenticated browser identity');
    await button.waitFor({state:'hidden',timeout:20000});
    if(browserJsErrors||externalBrowserRequests)throw Error('First-admin browser emitted JavaScript error or external network request');
    return {claimedThroughActualChromiumUi:1,claimedUserIdMatchesSession:1,browserJsErrors:0,externalBrowserRequests:0};
  }finally{await browser.close()}
}
