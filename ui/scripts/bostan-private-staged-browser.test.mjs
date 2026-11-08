import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateLocalAddress,verifyLocalBrowser} from './bostan-private-staged-browser.mjs';
const script=fileURLToPath(new URL('./bostan-private-staged-browser.mjs',import.meta.url));
const origin='http://127.0.0.1:3100';
function fakeBrowser({outbound=false,jsError=false,badTitle=false}={}) {
  let routeHandler,pageError,closed=false;
  const page={
    on:(name,cb)=>{if(name==='pageerror')pageError=cb},
    route:async(_,cb)=>{routeHandler=cb},
    goto:async()=>{
      if(outbound)await routeHandler({request:()=>({url:()=> 'https://external.example/track'}),abort:async()=>{},continue:async()=>{}});
      else await routeHandler({request:()=>({url:()=> origin+'/assets/index.js'}),abort:async()=>{},continue:async()=>{}});
      if(jsError)pageError(Error('synthetic browser error'));
      return {status:()=>200};
    },
    waitForTimeout:async()=>{},
    title:async()=>badTitle?'Wrong':'Bostan',
    locator:q=>q==='body'?{innerText:async()=> 'Bostan private local setup screen'}:{count:async()=>1},
  };
  const browser={newContext:async()=>({newPage:async()=>page}),close:async()=>{closed=true}};
  return {launch:async()=>browser,wasClosed:()=>closed};
}
test('strictly authorizes loopback HTTP at a private explicit port only',()=>{
  assert.equal(validateLocalAddress(origin+'/'),origin);
  for(const url of ['https://127.0.0.1:3100/','http://localhost:3100/','http://127.0.0.2:3100/','http://example.com:3100/','http://127.0.0.1:80/','http://127.0.0.1:3100/test','http://127.0.0.1:3100/?secret=1','http://user:pass@127.0.0.1:3100/','not-a-url']){
    assert.throws(()=>validateLocalAddress(url),undefined,url);
  }
});
test('valid browser proof requires Bostan UI, local module and zero errors',async()=>{
  const good=fakeBrowser();const result=await verifyLocalBrowser(origin+'/',{launch:good.launch});
  assert.equal(result.qualified,true);assert.equal(result.releaseQualified,false);
  assert.equal(result.title,'Bostan');assert.equal(result.externalRequests,0);assert.equal(result.jsErrors,0);
  assert.equal(good.wasClosed(),true);
  for(const x of [{outbound:true},{jsError:true},{badTitle:true}]){
    const bad=fakeBrowser(x);await assert.rejects(()=>verifyLocalBrowser(origin+'/',{launch:bad.launch}),/not clean/);
    assert.equal(bad.wasClosed(),true);
  }
});
test('CLI plan is safe and unsupported options cannot trigger Chromium or models',()=>{
  const help=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:5000});
  assert.equal(help.status,0);assert.match(help.stdout,/no external network/);
  for(const args of [['--publish'],['--run','--url'],['--run','--url','https://example.com']]){
    const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});
    assert.notEqual(result.status,0);
  }
});
