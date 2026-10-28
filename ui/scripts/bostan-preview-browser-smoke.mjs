#!/usr/bin/env node
// Local, unauthenticated frontend first-paint test. NOT a server, database,
// desktop, native-Rust or security end-to-end qualification.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const uiRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv.includes('--help')){
  console.log('Usage: pnpm --filter @bostan/ui exec node scripts/bostan-preview-browser-smoke.mjs');
  console.log('Requires prior @bostan/ui build and a locally installed Playwright Chromium browser.');
} else if(process.argv.length>2) {
  console.error('Unknown arguments: the only supported flag is --help.');process.exitCode=2;
} else {
  await main().catch(error=>{ console.error(`Bostan browser smoke FAILED: ${error.message}`);process.exitCode=1; });
}

async function availableLoopbackPort(){
  const srv=createServer();
  try{
    await new Promise((resolve,reject)=>{srv.once('error',reject);srv.listen(0,'127.0.0.1',resolve)});
    return srv.address().port;
  } finally {await new Promise(resolve=>srv.close(resolve));}
}

async function main(){
  assert.ok(existsSync(resolve(uiRoot,'dist/index.html')),'build the UI first: pnpm --filter @bostan/ui build');
  const port=await availableLoopbackPort();
  const origin=`http://127.0.0.1:${port}`;
  const viteJs=resolve(uiRoot,'node_modules/vite/bin/vite.js');
  assert.ok(existsSync(viteJs),'frozen UI workspace dependencies must already be installed');
  // Running the Vite CLI under Node gives us exactly one owned preview process to stop.
  const preview=spawn(process.execPath,[viteJs,'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
    cwd:uiRoot,stdio:['ignore','pipe','pipe'],env:process.env,
  });
  let serverLog='';
  for(const stream of [preview.stdout,preview.stderr]) stream.on('data',chunk=>{serverLog+=chunk.toString().slice(0,4096)});
  let browser;
  try {
    let ready=false;
    for(let attempt=0;attempt<80;attempt++){
      if(preview.exitCode!==null) throw Error(`local Vite preview exited: ${serverLog.slice(-1200)}`);
      try {const response=await fetch(origin,{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,`local preview failed to become ready: ${serverLog.slice(-1200)}`);
    browser=await chromium.launch({headless:true});
    // Service workers can bypass page-level interception. A fresh context
    // with service workers disabled and context-level routing makes the
    // offline assertion cover subresources as well as the navigation.
    const context=await browser.newContext({serviceWorkers:'block'});
    const page=await context.newPage();
    const pageErrors=[];let nonlocalRequests=0;
    page.on('pageerror',err=>pageErrors.push(err.message));
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin){nonlocalRequests++;return route.abort('blockedbyclient')}
      return route.continue();
    });
    const response=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(response?.status(),200,'Bostan static preview must serve HTTP 200');
    await page.waitForFunction(()=>/Bostan/i.test(document.body.innerText),null,{timeout:15000});
    const title=await page.title();const visible=await page.locator('body').innerText();
    assert.equal(title,'Bostan');
    assert.match(visible,/Bostan/i,'first paint must display Bostan identity');
    assert.doesNotMatch(visible,/Paperclip/i,'the current visible user-facing page must not show an inherited brand');
    assert.deepEqual(pageErrors,[],'no uncaught browser JavaScript exception is permitted');
    assert.equal(nonlocalRequests,0,'frontend first paint must not request external origins in offline preview');
    console.log(JSON.stringify({kind:'bostan.browser-first-paint.v1',releaseQualified:false,origin:'127.0.0.1',httpStatus:response.status(),title,visibleText:visible.slice(0,200),pageErrors:pageErrors.length,externalRequests:nonlocalRequests},null,2));
  } finally {
    if(browser) await browser.close();
    preview.kill('SIGTERM');
  }
}
