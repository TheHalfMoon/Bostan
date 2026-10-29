import assert from "node:assert/strict";
import {test} from "node:test";
import {summarizePrivateWindowsCpuProfile as summarize} from "./bostan-private-windows-cpu-profile-summary.mjs";

test("categorizes actual V8 leaf samples without returning private paths or function names",()=>{
  const profile={nodes:[
    {id:1,callFrame:{functionName:"(idle)",url:""}},
    {id:2,callFrame:{functionName:"(program)",url:""}},
    {id:3,callFrame:{functionName:"(garbage collector)",url:""}},
    {id:4,callFrame:{functionName:"privateToken_123",url:"file:///C:/Users/secret-user/bostan/server/dist-runtime/server.mjs"}},
    {id:5,callFrame:{functionName:"not_a_safe_log",url:"file:///D:/Bostan/server/node_modules/.pnpm/foo@1.2/node_modules/foo/dist/index.js?password=VERY_PRIVATE"}},
    {id:6,callFrame:{functionName:"other-secret",url:"node:internal/modules/esm/loader"}},
    {id:7,callFrame:{functionName:"x",url:"file:///D:/Bostan/packages/shared/src/foo.ts"}},
    {id:8,callFrame:{functionName:"x",url:"file:///D:/Bostan-private/other.js"}},
    {id:9,callFrame:{functionName:"x",url:""}},
  ],samples:[1,2,3,4,5,5,6,7,8,9,777]};
  const result=summarize(profile);
  assert.equal(result.totalSamples,11);
  assert.deepEqual(result.counts,{idle:1,program:1,garbageCollector:1,packedRuntime:1,thirdParty:2,nodeInternal:1,workspace:1,otherScript:1,unattributed:2});
  assert.deepEqual(result.topPackages,[{name:"foo",samples:2}]);
  assert.equal(result.startupQualified,false);
  assert.equal(result.realPostgresUsed,false);
  const serialized=JSON.stringify(result);
  for(const secret of ["secret-user","password","VERY_PRIVATE","privateToken","not_a_safe_log","C:","D:","/dist/"])assert.ok(!serialized.includes(secret),secret);
});
test("limits arbitrary package labels and profile size before formatting",()=>{
  const profile={nodes:[{id:2,callFrame:{functionName:"x",url:"file:///C:/temp/node_modules/password=secret/index.js"}}],samples:[2]};
  const result=summarize(profile);
  assert.deepEqual(result.topPackages,[]);
  assert.equal(result.counts.thirdParty,1);
  assert.throws(()=>summarize({nodes:[],samples:{}}),/Malformed/);
  assert.throws(()=>summarize({nodes:[],samples:Array(2_000_001).fill(1)}),/oversized/);
});
