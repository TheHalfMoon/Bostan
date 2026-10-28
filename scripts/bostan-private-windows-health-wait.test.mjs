import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {waitForWindowsPrivateHealth as probe, WINDOWS_PRIVATE_HTTP_STARTUP_MS} from './bostan-private-windows-health-wait.mjs';
const endpoint='http://127.0.0.1:49123/api/health';
const privateHealth={status:'ok',deploymentMode:'authenticated',deploymentExposure:'private',bootstrapStatus:'bootstrap_pending'};
async function withServer(handler, fn) {
  const server=createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {return await fn('http://127.0.0.1:'+server.address().port+'/api/health');}
  finally {await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

test('actual localhost HTTP200 authenticated/private pending is accepted',async()=>{
  await withServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(privateHealth));},async url=>{
    const result=await probe({endpoint:url,childExited:()=>false,timeoutMs:3000});
    assert.equal(result.healthy,true);
    assert.equal(result.outcome,'healthy');
    assert.equal(result.probes,1);
  });
});
test('public and ready health never qualify over actual HTTP',async()=>{
  for(const health of [{...privateHealth,deploymentExposure:'public'}, {...privateHealth,bootstrapStatus:'ready'}, {...privateHealth,cloud:{}}]){
    await withServer((_req,res)=>res.end(JSON.stringify(health)),async url=>{
      const result=await probe({endpoint:url,childExited:()=>false,timeoutMs:100,pollDelayMs:5,maxProbes:4});
      assert.equal(result.healthy,false);
      assert.ok(['probe_limit','deadline_exceeded'].includes(result.outcome));
    });
  }
});
test('monotonic deadline includes both fetch and polling delay, not 180 x 2.5 seconds',async()=>{
  let ms=0;
  const result=await probe({endpoint,childExited:()=>false,now:()=>ms,
    fetchResponse:async()=>{ms+=1500;throw Error('synthetic inaccessible');},
    sleep:async delay=>{ms+=delay;}});
  assert.equal(result.healthy,false);
  assert.equal(result.outcome,'deadline_exceeded');
  assert.ok(ms>=WINDOWS_PRIVATE_HTTP_STARTUP_MS);
  assert.ok(ms<=WINDOWS_PRIVATE_HTTP_STARTUP_MS+1500);
  assert.ok(result.probes<180);
});
test('child exit cuts off health probes without waiting for deadline',async()=>{
  let calls=0,ms=0;
  const result=await probe({endpoint,childExited:()=>calls>=2,now:()=>ms,
    fetchResponse:async()=>{calls++;ms+=10;return {status:503};},sleep:async delay=>{ms+=delay;}});
  assert.equal(result.outcome,'child_exited');
  assert.equal(result.probes,2);
});
test('a small explicit probe cap fails without extending deadline',async()=>{
  let ms=0;
  const result=await probe({endpoint,childExited:()=>false,now:()=>ms,maxProbes:3,
    fetchResponse:async()=>{ms+=10;return {status:503};},sleep:async delay=>{ms+=delay;}});
  assert.equal(result.outcome,'probe_limit');
  assert.equal(result.probes,3);
});
test('URL allowlist rejects foreign hosts, credentials and non-health routes before fetching',async()=>{
  let calls=0;
  for(const bad of ['https://127.0.0.1:49123/api/health','http://localhost:49123/api/health','http://127.0.0.1:49123/private','http://user@127.0.0.1:49123/api/health','http://127.0.0.1:49123/api/health?foo=1','http://127.0.0.1:49123/api/health#x','http://10.0.0.1:49123/api/health']){
    await assert.rejects(probe({endpoint:bad,childExited:()=>false,fetchResponse:()=>{calls++;throw Error('should not call');}}),/Invalid private localhost/);
  }
  assert.equal(calls,0);
});
test('malformed options and missing owned child lifecycle refuse',async()=>{
  for(const config of [{},{endpoint,childExited:()=>false,timeoutMs:0},{endpoint,childExited:()=>false,requestTimeoutMs:5000},{endpoint,childExited:()=>false,maxProbes:0}])
    await assert.rejects(probe(config),/Invalid private localhost/);
});
test('non-JSON 200 response is not a successful health check',async()=>{
  await withServer((_req,res)=>{res.writeHead(200);res.end('not json');},async url=>{
    const result=await probe({endpoint:url,childExited:()=>false,timeoutMs:100,pollDelayMs:5,maxProbes:2});
    assert.equal(result.healthy,false);
    assert.equal(result.observation,'health_invalid_json');
  });
});
