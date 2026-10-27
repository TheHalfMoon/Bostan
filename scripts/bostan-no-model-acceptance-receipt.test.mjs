import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyTranscript} from './bostan-no-model-acceptance-receipt.mjs';

const script=fileURLToPath(new URL('./bostan-no-model-acceptance-receipt.mjs',import.meta.url));
const stages=[
  ['persistence',[]],
  ['onboarding',['real-browser-new-company-onboarding']],
  ['inactiveAgentDraft',['real-browser-first-agent-inactive-draft','real-browser-adapter-selected-still-paused']],
  ['coldRestore',['real-postgres-cold-backup-verify-new-home-restore-restart']],
  ['taskInsightsPrivacy',['real-browser-private-task-insights','real-browser-html-no-referrer','real-browser-route-scoped-issue-bundle']],
];
const base=['private-health','company-create','clean-stop','restart','persistence'];
const transcript=()=>stages.flatMap(([name,expected],index)=>[
  `Bostan private no-model acceptance: ${name}`,
  `BOSTAN_LOCAL_PERSISTENCE_E2E_PASS ${JSON.stringify({qualified:true,platform:'darwin',...(index?{browserPageErrors:0,browserExternalRequestsBlocked:0}:{}),...(index===3?{coldRestoreEvidence:{verifiedFiles:3420,restoredIntoNewHome:true}}:{}),verified:[...base,...expected].join(',')})}`,
]).concat(['BOSTAN_NO_MODEL_ACCEPTANCE_PASS — native Rust remains OPEN']).join('\n')+'\n';

test('valid all-five transcript produces bounded non-release evidence',()=>{
  const result=verifyTranscript(transcript());
  assert.equal(result.allFivePassed,true);
  assert.equal(result.releaseQualified,false);
  assert.equal(result.realModelQualified,false);
  assert.equal(result.coldRestoreFiles,3420);
  assert.deepEqual(result.scenarios,stages.map(s=>s[0]));
});
test('rejects missing/duplicate/out-of-order scenario, missing final marker',()=>{
  const lines=transcript().trimEnd().split('\n');
  for(const t of [lines.slice(0,-1).join('\n'),lines.slice(0,-3).join('\n'),[lines[0],lines[1],lines[0],...lines.slice(2)].join('\n'),[...lines.slice(0,2),lines[3],lines[2],...lines.slice(4)].join('\n')]) {
    assert.throws(()=>verifyTranscript(t));
  }
});
test('rejects missing proof, browser errors, outbound requests, fraudulent restore',()=>{
  for(const bad of [
    transcript().replace('real-browser-first-agent-inactive-draft,',''),
    transcript().replace('"browserPageErrors":0','"browserPageErrors":1'),
    transcript().replace('"browserExternalRequestsBlocked":0','"browserExternalRequestsBlocked":1'),
    transcript().replace('"verifiedFiles":3420','"verifiedFiles":0'),
    transcript().replace('"restoredIntoNewHome":true','"restoredIntoNewHome":false'),
    transcript().replace('"qualified":true','"qualified":false'),
  ]) assert.throws(()=>verifyTranscript(bad));
});
test('rejects mixed platforms, malformed JSON, log too long and explicit failure',()=>{
  for(const bad of [
    transcript().replace('"platform":"darwin"','"platform":"linux"'),
    transcript().replace('BOSTAN_LOCAL_PERSISTENCE_E2E_PASS {','BOSTAN_LOCAL_PERSISTENCE_E2E_PASS bad{'),
    transcript().padEnd(524289,'x'),
    transcript()+'Acceptance scenario persistence failed or timed out: 1\n',
  ]) assert.throws(()=>verifyTranscript(bad));
});
test('CLI defaults to read-only help and fails closed on unsupported arguments',()=>{
  const help=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.equal(help.status,0);assert.match(help.stdout,/read-only/);
  assert.equal(spawnSync(process.execPath,[script,'--publish'],{encoding:'utf8'}).status,2);
});
test('CLI validates a temporary transcript without writing source or output files',()=>{
  const dir=mkdtempSync(join(tmpdir(),'bostan-five-receipt-'));
  try {
    const path=join(dir,'synthetic.log');writeFileSync(path,transcript());
    const execution=spawnSync(process.execPath,[script,'--check-log',path],{encoding:'utf8'});
    assert.equal(execution.status,0,execution.stderr);
    assert.equal(JSON.parse(execution.stdout).allFivePassed,true);
    writeFileSync(path,transcript().replace('"browserPageErrors":0','"browserPageErrors":1'));
    const failure=spawnSync(process.execPath,[script,'--check-log',path],{encoding:'utf8'});
    assert.equal(failure.status,1);
    assert.match(failure.stderr,/receipt validation failed/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
