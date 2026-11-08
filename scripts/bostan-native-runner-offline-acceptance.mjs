#!/usr/bin/env node
/** Real native Bostan runnerd + fake-harness contract qualification, fully local. */
import { spawn, spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = join(root, 'packages/paperclip-runner/protocol/fixtures/local-runner/scripts');
const blocked = ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY','OPENROUTER_API_KEY','XAI_API_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','DATABASE_URL','OTEL_EXPORTER_OTLP_ENDPOINT','SENTRY_DSN'];
const identity = {runId:'run_bostan_private_native_smoke',sessionId:'session_bostan_private_native_smoke',runnerId:'runner_bostan_native_smoke'};
export function verifyMetadata(metadata) {
  if (metadata?.schema !== 'paperclip-runner/runnerd-build-metadata/v1' || metadata.binaryContractVersion !== 2 || metadata.prp?.name !== 'paperclip.runner' || metadata.prp?.minimumVersion !== 1 || metadata.prp?.maximumVersion !== 2) throw new Error('Native runner metadata protocol/contract mismatch');
  for (const mode of ['dial_ws_loopback','dial_wss','listen_ws']) if (!metadata.prpTransportModes?.includes(mode)) throw new Error(`Native runner transport capability missing: ${mode}`);
  return true;
}
export function verifyRunTranscript(raw, expectation, expectedIdentity = identity) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 1024*1024) throw new Error('Native stream is absent or exceeds 1 MiB');
  let terminal = null; let sourceSeq = 0; let events = 0; const receipts = new Set();
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    let data;
    try { data = JSON.parse(line); } catch { throw new Error('Non-JSONL native runner output'); }
    if (data?.schema !== 'paperclip.runner.stream.v1') throw new Error('Unexpected native runner envelope schema');
    const message = data.message;
    if (message?.kind === 'command_receipt') {
      if (terminal || message.status !== 'accepted' || !Number.isInteger(message.controllerSeq) || message.controllerSeq < 1 || message.controllerSeq > 3 || message.commandId !== `bostan_native_command_${message.controllerSeq}` || receipts.has(message.controllerSeq)) throw new Error('Native command receipt was rejected, duplicated or mismatched');
      receipts.add(message.controllerSeq);
      continue;
    }
    if (message?.kind === 'diagnostic') {
      if (message.level === 'error') throw new Error('Native runner emitted an error diagnostic');
      continue;
    }
    const event = message?.event;
    if (message?.kind !== 'event' || event?.schema !== 'paperclip.prp.event.v1') throw new Error('Unexpected native runner output schema');
    if (event.runId !== expectedIdentity.runId || event.normalizedSessionId !== expectedIdentity.sessionId || event.sourceInstanceId !== expectedIdentity.runnerId) throw new Error('Native runner identity changed');
    if (!Number.isInteger(event.sourceSeq) || event.sourceSeq !== ++sourceSeq) throw new Error('Native runner source sequence gap/duplicate');
    ++events;
    if (event.eventType === 'run.terminal') {
      if (terminal) throw new Error('Duplicate native terminal event');
      terminal = event.payload;
    } else if (terminal) throw new Error('Post-terminal source events detected');
  }
  if (!terminal || events < 4 || receipts.size !== 3) throw new Error('No complete native runner exchange with three accepted commands');
  if (terminal.schema !== 'paperclip.prp.terminal.v1' || terminal.reconciliation?.authority !== 'runner' || terminal.reconciliation?.proposalValid !== true) throw new Error('Unverified runner terminal authority');
  if (expectation === 'succeeded') {
    if (terminal.runTerminalState !== 'succeeded' || terminal.turnTerminalState !== 'completed' || terminal.reportedWorkDisposition !== 'done' || terminal.reconciliation?.processExit?.exitCode !== 0 || terminal.reconciliation?.processExit?.success !== true) throw new Error('Native happy-path terminal is not authoritative success');
  } else if (expectation === 'failed') {
    if (terminal.runTerminalState !== 'failed' || terminal.turnTerminalState !== 'failed' || terminal.reconciliation?.processExit?.exitCode !== 7 || terminal.reconciliation?.processExit?.success !== false) throw new Error('Native failed harness was misclassified as success');
  } else throw new Error('Unsupported native scenario');
  return {sourceEvents:events,terminalState:terminal.runTerminalState,processExitCode:terminal.reconciliation.processExit.exitCode};
}
function nativeBinaryPath(candidate) {
  if (!candidate || !isAbsolute(candidate)) throw new Error('Native runner executable must be an absolute local path');
  const path = realpathSync(candidate);
  const stat = lstatSync(path);
  if (!stat.isFile() || (stat.mode & 0o111) === 0) throw new Error('Native runner executable must be a regular executable file');
  return path;
}
function scrubbedEnv(home) {
  const env = {...process.env, HOME:home, DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true'};
  for (const key of blocked) delete env[key];
  return env;
}
function commands() {
  const time='2026-10-27T12:00:00.000Z';
  return [['run.prepare',{workspace:'fixture'}],['session.open',{reuse:'new_per_run'}],['turn.start',{text:'Inspect Bostan native offline fixture'}]]
    .map(([type,payload],index)=>JSON.stringify({schema:'paperclip.prp.command.v1',commandId:`bostan_native_command_${index+1}`,controllerSeq:index+1,type,issuedAt:time,payload})+'\n').join('');
}
async function runCase({runnerd,harness,fixture,name,expected}) {
  const home=mkdtempSync(join(tmpdir(),'bostan-native-disposable-'));
  try {
    const args=['--run-id',identity.runId,'--session-id',identity.sessionId,'--runner-id',identity.runnerId,'--fake-harness',harness,'--script',join(fixtureRoot,fixture)];
    const child=spawn(runnerd,args,{cwd:home,env:scrubbedEnv(home),stdio:['pipe','pipe','pipe'],windowsHide:true});
    let output='',errors='',timedOut=false;
    const kill=()=>{timedOut=true;child.kill('SIGKILL');};
    const timer=setTimeout(kill,12000);
    child.stdout.on('data',part=>{output+=part;if(Buffer.byteLength(output)>1024*1024)kill();});
    child.stderr.on('data',part=>{errors+=part;if(Buffer.byteLength(errors)>32768)kill();});
    child.stdin.write(commands()); // Keep input open until the runner emits its terminal.
    const result=await new Promise((resolvePromise,reject)=>{child.once('error',reject);child.once('close',code=>resolvePromise(code));});
    clearTimeout(timer);
    if (timedOut || result!==0 || errors) throw new Error(`Native ${name} process failed, timed out, or produced stderr`);
    return {scenario:name,...verifyRunTranscript(output,expected)};
  } finally {rmSync(home,{recursive:true,force:true});}
}
function plan() {return {schema:'bostan.native-runner-offline-acceptance.v1',releaseQualified:false,requires:'native runnerd and fake-harness locally compiled from this source revision',scenarios:['happy-path','error'],noModels:true,noRemoteServices:true,installedWindowsQualified:false,linuxQualified:false};}
const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
const argv=process.argv.slice(2);
if (argv.length===0 || (argv.length===1&&argv[0]==='--plan')) {
  console.log(JSON.stringify(plan(),null,2));
} else if (argv.length===5 && argv[0]==='--run' && argv[1]==='--runnerd' && argv[3]==='--fake-harness') {
  if (!['darwin','linux'].includes(process.platform)) {console.error('Native runner source QA supports only macOS/Linux');process.exitCode=2;}
  else {
    try {
      const runnerd=nativeBinaryPath(argv[2]),harness=nativeBinaryPath(argv[4]);
      const home=mkdtempSync(join(tmpdir(),'bostan-native-metadata-'));
      let metadata;
      try {
        const res=spawnSync(runnerd,['--build-metadata'],{cwd:home,env:scrubbedEnv(home),encoding:'utf8',timeout:5000,maxBuffer:65536});
        if (res.status!==0 || res.stderr) throw new Error('Native binary metadata probe failed');
        metadata=JSON.parse(res.stdout);verifyMetadata(metadata);
      } finally {rmSync(home,{recursive:true,force:true});}
      const success=await runCase({runnerd,harness,name:'happy-path',fixture:'happy-path.json',expected:'succeeded'});
      const failure=await runCase({runnerd,harness,name:'error',fixture:'error.json',expected:'failed'});
      console.log(JSON.stringify({...plan(),platform:process.platform,nativeRunnerdVerified:true,binaryContractVersion:metadata.binaryContractVersion,scenarios:[success,failure]},null,2));
      console.log('BOSTAN_NATIVE_RUNNER_OFFLINE_ACCEPTANCE_PASS');
    } catch(e) {console.error('Bostan native offline acceptance failed:',e.message);process.exitCode=1;}
  }
} else {console.error('Usage: node scripts/bostan-native-runner-offline-acceptance.mjs [--plan | --run --runnerd <absolute-native-path> --fake-harness <absolute-native-path>]');process.exitCode=2;}
}
