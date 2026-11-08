import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyMetadata,verifyRunTranscript} from './bostan-native-runner-offline-acceptance.mjs';
const script=fileURLToPath(new URL('./bostan-native-runner-offline-acceptance.mjs',import.meta.url));
const identity={runId:'run_bostan_private_native_smoke',sessionId:'session_bostan_private_native_smoke',runnerId:'runner_bostan_native_smoke'};
const metadata={schema:'paperclip-runner/runnerd-build-metadata/v1',binaryContractVersion:2,prp:{name:'paperclip.runner',minimumVersion:1,maximumVersion:2},prpTransportModes:['dial_ws_loopback','dial_wss','listen_ws']};
const encode=message=>JSON.stringify({schema:'paperclip.runner.stream.v1',message});
function fixture(state='succeeded') {
  const failed=state==='failed';
  const lines=[1,2,3].map(i=>encode({kind:'command_receipt',commandId:`bostan_native_command_${i}`,controllerSeq:i,status:'accepted',detail:'command applied'}));
  const events=['runtime.phase.changed','workspace.ready','harness.starting','harness.exited','run.terminal'];
  lines.push(...events.map((eventType,i)=>encode({kind:'event',event:{schema:'paperclip.prp.event.v1',sourceSeq:i+1,sourceInstanceId:identity.runnerId,runId:identity.runId,normalizedSessionId:identity.sessionId,eventType,payload:eventType==='run.terminal'?{schema:'paperclip.prp.terminal.v1',runTerminalState:state,turnTerminalState:failed?'failed':'completed',reportedWorkDisposition:failed?'yielded':'done',reconciliation:{authority:'runner',proposalValid:true,processExit:{exitCode:failed?7:0,success:!failed}}}:{}}})));
  return lines.join('\n')+'\n';
}
test('metadata verifies versioned native transport contract, not marketing identity',()=>{
  assert.equal(verifyMetadata(metadata),true);
  for(const changed of [{...metadata,binaryContractVersion:3},{...metadata,prp:{...metadata.prp,name:'not-prp'}},{...metadata,prpTransportModes:['dial_ws_loopback']}]) assert.throws(()=>verifyMetadata(changed));
});
test('realistic successful and failed native transcripts preserve terminal authority',()=>{
  assert.deepEqual(verifyRunTranscript(fixture('succeeded'),'succeeded'),{sourceEvents:5,terminalState:'succeeded',processExitCode:0});
  assert.deepEqual(verifyRunTranscript(fixture('failed'),'failed'),{sourceEvents:5,terminalState:'failed',processExitCode:7});
  assert.throws(()=>verifyRunTranscript(fixture('failed'),'succeeded'));
  assert.throws(()=>verifyRunTranscript(fixture('succeeded'),'failed'));
});
test('rejects JSON corruption, missing receipt or terminal, forged identity and sequence gaps',()=>{
  const source=fixture();
  for(const bad of [source+'not-json\n',source.split('\n').slice(1).join('\n'),source.replace(/.*run\.terminal.*\n/,'').trim(),source.replace('"sourceSeq":3','"sourceSeq":7'),source.replace('"runId":"run_bostan_private_native_smoke"','"runId":"fake_other_run"'),source.padEnd(1024*1024+1,'X')]) assert.throws(()=>verifyRunTranscript(bad,'succeeded'));
});
test('rejects rejected/duplicate command receipts and terminal-level false success',()=>{
  const source=fixture();const lines=source.trimEnd().split('\n');
  assert.throws(()=>verifyRunTranscript(source.replace('"status":"accepted"','"status":"rejected"'),'succeeded'));
  assert.throws(()=>verifyRunTranscript([lines[0],lines[0],...lines.slice(1)].join('\n'),'succeeded'));
  assert.throws(()=>verifyRunTranscript(source.replace('"proposalValid":true','"proposalValid":false'),'succeeded'));
  assert.throws(()=>verifyRunTranscript(source.replace('"authority":"runner"','"authority":"harness"'),'succeeded'));
  assert.throws(()=>verifyRunTranscript(source.replace('"exitCode":0','"exitCode":7'),'succeeded'));
  assert.throws(()=>verifyRunTranscript(source.replace('"kind":"event"','"kind":"untrusted"'),'succeeded'));
});
test('CLI is side-effect-free without --run, rejects missing or nonabsolute executables',()=>{
  const loaded=spawnSync(process.execPath,['--input-type=module','-e',`import(${JSON.stringify(new URL('./bostan-native-runner-offline-acceptance.mjs',import.meta.url).href)})`],{encoding:'utf8'});
  assert.equal(loaded.status,0);assert.equal(loaded.stdout,'');
  const plan=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.equal(plan.status,0);assert.equal(JSON.parse(plan.stdout).releaseQualified,false);
  assert.equal(spawnSync(process.execPath,[script,'--publish'],{encoding:'utf8'}).status,2);
  const probe=spawnSync(process.execPath,[script,'--run','--runnerd','./fake','--fake-harness','./fake'],{encoding:'utf8'});
  assert.equal(probe.status,1);
  assert.match(probe.stderr,/absolute local path/);
});
