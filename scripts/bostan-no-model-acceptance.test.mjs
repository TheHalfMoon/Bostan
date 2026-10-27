import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const script=fileURLToPath(new URL('./bostan-no-model-acceptance.mjs',import.meta.url));
const invoke=(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
test('default is a side-effect-free five-scenario source acceptance plan',()=>{
  const r=invoke();assert.equal(r.status,0,r.stderr);
  const data=JSON.parse(r.stdout);
  assert.equal(data.schema,'bostan.no-model-private-acceptance.v1');
  assert.equal(data.releaseQualified,false);
  assert.deepEqual(data.scenarios.map(s=>s.name),['persistence','onboarding','inactiveAgentDraft','coldRestore','taskInsightsPrivacy']);
  assert.ok(data.scenarios.every(s=>s.liveModels===false&&s.disposableDatabase===true));
  assert.ok(data.exclusions.includes('release approval'));
});
test('explicit --plan is equivalent and unsupported actions fail closed',()=>{
  assert.equal(invoke('--plan').status,0);
  for(const args of [['--publish'],['--run'],['--run','governedCase'],['--run','all','--deploy']]){
    const result=invoke(...args);assert.equal(result.status,2,`Unexpected acceptance: ${args.join(' ')}`);
  }
});
test('source restricts external model credentials and excludes all remote model toggles',()=>{
  const code=readFileSync(script,'utf8');
  for(const marker of ['OPENROUTER_API_KEY','ANTHROPIC_API_KEY','DATABASE_URL','BOSTAN_LIVE_LOCAL_GOVERNED_CASE_E2E','BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL','BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E','BOSTAN_FEEDBACK_EXPORT_ENABLED'])assert.ok(code.includes(marker),marker);
  assert.match(code,/delete env\[key\]/);
  assert.match(code,/BOSTAN_LIVE_LOCAL_QA_CONFIRM:'1'/);
  assert.match(code,/spawnSync\(process\.execPath/);
});
