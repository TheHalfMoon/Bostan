import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {scrubPrivateParallelEnv,summarizeParallelAuthzExit,
  assessParallelOverlap,parseMacMemoryPressureFreePercentage} from './bostan-private-mac-parallel-postgres-authz.mjs';
const entry=fileURLToPath(new URL('./bostan-private-mac-parallel-postgres-authz.mjs',import.meta.url));
const common=[
 'BOSTAN_PACKED_SHA256_RUNTIME_OWNERSHIP_VERIFIED','MIGRATED',
 'BOSTAN_BOOT_BANNER_QUALIFIED',
 'BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS','CLEANUP_COMPLETED exit=0',
];
const markers=[...common,'BOSTAN_PACKED_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED'];
test('no network or mutable side effects in no-arg plan',()=>{
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:4000,
    env:{...process.env,DATABASE_URL:'postgres://secret.fake.invalid/customer',
      OPENAI_API_KEY:'sensitive'}});
  assert.equal(result.status,0);
  assert.match(result.stdout,/PLAN_ONLY/);
  assert.doesNotMatch(result.stdout,/secret|customer|sensitive/);
  assert.equal(spawnSync(process.execPath,[entry,'--publish'],
    {encoding:'utf8',timeout:4000}).status,1);
});
test('environment contains only fixed system loader keys, never inherited paid or DB credentials',()=>{
  const v=scrubPrivateParallelEnv({PATH:'/usr/bin',HOME:'/tmp/bostan',
    OPENAI_API_KEY:'secret',DATABASE_URL:'postgres://private',
    NODE_OPTIONS:'--import /private',SENTRY_DSN:'https://bad',
    PAPERCLIP_DEPLOYMENT_MODE:'cloud',BOSTAN_TEST_ONLY_SENTINEL:'/other'});
  assert.deepEqual(Object.keys(v).sort(),[
    'CI','DO_NOT_TRACK','OTEL_SDK_DISABLED','BOSTAN_FEEDBACK_EXPORT_ENABLED',
    'NO_COLOR','PATH','HOME'].sort());
  assert.equal(v.PATH,'/usr/bin');
});
test('parallel workers require exactly-once full runtime, DB, auth and teardown receipts',()=>{
  const output=markers.join('\n')+'\n';
  assert.equal(summarizeParallelAuthzExit({exit:0,signal:null,output}).qualified,true);
  for(const missing of markers){
    assert.equal(summarizeParallelAuthzExit({exit:0,signal:null,
      output:markers.filter(v=>v!==missing).join('\n')}).qualified,false);
    assert.equal(summarizeParallelAuthzExit({exit:0,signal:null,
      output:output+missing+'\n'}).qualified,false);
  }
  assert.equal(summarizeParallelAuthzExit({exit:0,output:output+'PG_STOP_FAILED\n'}).qualified,false);
  assert.equal(summarizeParallelAuthzExit({exit:1,output}).qualified,false);
  assert.equal(summarizeParallelAuthzExit({exit:0,output,timedOut:true}).qualified,false);
  assert.equal(summarizeParallelAuthzExit({exit:0,output,overflow:true}).qualified,false);
});
test('parallel overlap cannot be inferred merely from two sequential passes',()=>{
  assert.equal(assessParallelOverlap([{start:1,end:10},{start:3,end:15}]),true);
  assert.equal(assessParallelOverlap([{start:1,end:3},{start:3,end:15}]),false);
  assert.equal(assessParallelOverlap([{start:1,end:3},{start:5,end:15}]),false);
  assert.equal(assessParallelOverlap([{start:1,end:3}]),false);
});

test('macOS memory pressure admission requires one bounded authoritative percentage',()=>{
  assert.equal(parseMacMemoryPressureFreePercentage(
    'System-wide memory free percentage: 55%\n'),55);
  for(const invalid of ['', 'random 55%',
    'System-wide memory free percentage: 1000%',
    'System-wide memory free percentage: 101%',
    'System-wide memory free percentage: 55%\nSystem-wide memory free percentage: 44%'])
    assert.equal(parseMacMemoryPressureFreePercentage(invalid),null);
});


test('Mac mixed Chromium/API concurrent mode requires its own exact browser proof',()=>{
  const ui='BOSTAN_PACKED_SERVER_AUTHENTICATED_CHROMIUM_JOURNEY_QUALIFIED';
  const browserOutput=[...common,ui].join('\n')+'\n';
  const apiOutput=markers.join('\n')+'\n';
  assert.equal(summarizeParallelAuthzExit({
    exit:0,signal:null,output:browserOutput,mode:'browser'}).qualified,true);
  assert.equal(summarizeParallelAuthzExit({
    exit:0,signal:null,output:apiOutput,mode:'browser'}).qualified,false);
  assert.equal(summarizeParallelAuthzExit({
    exit:0,signal:null,output:browserOutput,mode:'api'}).qualified,false);
  assert.throws(()=>summarizeParallelAuthzExit({
    exit:0,signal:null,output:apiOutput,mode:'unknown'}));
});
