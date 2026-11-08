#!/usr/bin/env node
/** Opt-in local Chromium check of a Bostan staged private server+UI. */
import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
export function validateLocalAddress(input){
  let u;
  try{u=new URL(input)}catch{throw Error('Expected a valid local HTTP URL')}
  if(u.protocol!=='http:' || u.hostname!=='127.0.0.1' || !/^\d{4,5}$/.test(u.port) || Number(u.port)<1024 || Number(u.port)>65535 || u.username || u.password || u.pathname!=='/' || u.search || u.hash)throw Error('Only http://127.0.0.1:<private-port>/ is allowed');
  return u.origin;
}
export async function verifyLocalBrowser(url,{launch=chromium.launch.bind(chromium)}={}){
  const origin=validateLocalAddress(url);
  const browser=await launch({headless:true});
  let jsErrors=0,externalRequests=0;
  try{
    const context=await browser.newContext({serviceWorkers:'block'});
    const page=await context.newPage();
    page.on('pageerror',()=>{jsErrors++});
    await page.route('**/*',route=>{
      const request=route.request().url();
      if(request.startsWith(origin+'/'))return route.continue();
      externalRequests++;
      return route.abort();
    });
    const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!response || response.status()!==200)throw Error('Private staged Bostan UI did not return 200');
    await page.waitForTimeout(1500);
    const title=await page.title();
    const body=(await page.locator('body').innerText()).trim();
    const scripts=await page.locator('script[type="module"][src^="/assets/"]').count();
    if(title!=='Bostan'||body.length<15||scripts<1||jsErrors!==0||externalRequests!==0)throw Error(`Staged Bostan browser first paint was not clean: title=${title},bodyChars=${body.length},scripts=${scripts},errors=${jsErrors},external=${externalRequests}`);
    return {schema:'bostan.staged-private-browser.v1',qualified:true,releaseQualified:false,platform:process.platform,title,bodyPresent:true,externalRequests:0,jsErrors:0,productionModulesPresent:true};
  }finally{await browser.close();}
}
if(direct){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log('Bostan staged private browser: --run --url http://127.0.0.1:<private-port>/ ; no external network, no inference or publishing');
  }else if(args.length===3&&args[0]==='--run'&&args[1]==='--url'){
    try{console.log(JSON.stringify(await verifyLocalBrowser(args[2]),null,2));console.log('BOSTAN_PORTABLE_STAGED_BROWSER_FIRST_PAINT_PASS');}
    catch(e){console.error('Bostan staged private browser failed:',e.message);process.exitCode=1}
  }else{console.error('Usage: --plan | --run --url http://127.0.0.1:<private-port>/');process.exitCode=2;}
}
