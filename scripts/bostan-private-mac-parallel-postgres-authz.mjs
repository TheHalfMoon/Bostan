#!/usr/bin/env node
/**
 * Mac-only, test-only native two-instance PostgreSQL + packed Better Auth QA.
 * No publication, no use of customer data, and no paid model calls.
 * Spawned suites each own and cleanup their own real PG + server.
 */
import {spawn,spawnSync} from 'node:child_process';
import {createOwnedNativeQaProcessGroup,terminateOwnedNativeQaProcessGroup} from './bostan-disposable-native-process-group.mjs';
import {readFileSync, existsSync, statfsSync, lstatSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSafeRuntimeOutdir} from '../server/scripts/bundle-runtime-output-admission.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const suite='scripts/bostan-local-http-postgres-smoke.sh';
const LABELS=['a','b'];
const commonMarkers=[
  'BOSTAN_PACKED_SHA256_RUNTIME_OWNERSHIP_VERIFIED',
  'MIGRATED',
  'BOSTAN_BOOT_BANNER_QUALIFIED',
  'BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS',
  'CLEANUP_COMPLETED exit=0',
];
const modeMarkers={
  api:'BOSTAN_PACKED_SERVER_AUTHENTICATED_TWO_SESSION_QUALIFIED',
  browser:'BOSTAN_PACKED_SERVER_AUTHENTICATED_CHROMIUM_JOURNEY_QUALIFIED',
};
const MAX_OUTPUT=512*1024;
const MAX_MS=120_000;
export function parseMacMemoryPressureFreePercentage(value){
  if(typeof value!=='string'||value.length>4096)return null;
  const matches=[...value.matchAll(/System-wide memory free percentage: (\d{1,3})%/g)];
  if(matches.length!==1)return null;
  const n=Number(matches[0][1]);
  return Number.isInteger(n)&&n>=0&&n<=100?n:null;
}
export function scrubPrivateParallelEnv(inherited={}){
  const result={CI:'1',DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
    BOSTAN_FEEDBACK_EXPORT_ENABLED:'0',NO_COLOR:'1'};
  for(const key of ['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL']){
    if(typeof inherited[key]==='string'&&inherited[key].length<4096)
      result[key]=inherited[key];
  }
  return result;
}
export function summarizeParallelAuthzExit({exit,signal,output,timedOut=false,overflow=false,mode='api'}){
  if(!Object.hasOwn(modeMarkers,mode))
    throw Error('Unknown private parallel authz worker mode');
  const lines=typeof output==='string'?output.split(/\r?\n/):[];
  const markerCounts=[...commonMarkers,modeMarkers[mode]]
    .map(marker=>lines.filter(line=>line===marker).length);
  const failures=['PG_STOP_FAILED','HEALTH_FAILED','BOSTAN_HTTP_UNEXPECTED_TEMP_NOT_DELETED'];
  const clean=exit===0&&!signal&&!timedOut&&!overflow&&
    markerCounts.every(n=>n===1)&&
    failures.every(marker=>!lines.some(line=>line.startsWith(marker)));
  return {qualified:clean,exit:typeof exit==='number'?exit:null,
    timedOut:Boolean(timedOut),overflow:Boolean(overflow),
    markers:markerCounts.map(n=>n===1)};
}
export function assessParallelOverlap(runs){
  if(!Array.isArray(runs)||runs.length!==2)return false;
  return runs.every(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&
    r.end>=r.start)&&Math.max(...runs.map(r=>r.start))<
    Math.min(...runs.map(r=>r.end));
}
export async function runWorker(label,env,mode='api',{
  spawnWorker=spawn,timeoutMs=MAX_MS,
}={}){
  if(process.platform!=='darwin'||!Number.isInteger(timeoutMs)||
     timeoutMs<1||timeoutMs>MAX_MS)
    throw Error('Private owned Mac PostgreSQL worker admission refused');
  const start=Date.now();
  const child=spawnWorker('bash',[suite,
    mode==='browser'?'--run-packed-authz-ui':'--run-packed-authz'],{
    cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true,detached:true});
  // A new session is created for this spawned QA bash. Its descendants inherit
  // the group; on timeout/overflow we signal only that exact owned group.
  const owner=Number.isSafeInteger(child.pid)&&child.pid>=2?
    createOwnedNativeQaProcessGroup(child,true,'darwin'):null;
  const stopOwned=()=>{
    if(owner)terminateOwnedNativeQaProcessGroup(owner,'SIGTERM');
    else child.kill('SIGTERM'); // spawn failure without an owned group
  };
  let output='',overflow=false,timedOut=false,closed=false,spawnFailed=false;
  const append=chunk=>{
    if(overflow)return;
    const piece=chunk.toString('utf8');
    if(Buffer.byteLength(output,'utf8')+Buffer.byteLength(piece,'utf8')>MAX_OUTPUT){
      overflow=true;
      stopOwned();
      return;
    }
    output+=piece;
  };
  child.stdout.on('data',append);
  child.stderr.on('data',append);
  const complete=new Promise(resolve=>{
    child.once('error',()=>{spawnFailed=true});
    child.once('close',(exit,signal)=>{closed=true;resolve({exit,signal})});
  });
  const timer=setTimeout(()=>{timedOut=true;stopOwned()},timeoutMs);
  const {exit,signal}=await complete;
  clearTimeout(timer);
  const end=Date.now();
  return {label,start,end,closed,spawnFailed,...summarizeParallelAuthzExit({
    exit,signal,output,timedOut,overflow,mode,
  })};
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log('BOSTAN_MAC_PARALLEL_PG_AUTHZ_PLAN_ONLY — requires --run and pinned owned real packed runtime. No side effects.');
    return;
  }
  if(args.length!==1||!['--run','--run-with-browser'].includes(args[0]))
    throw Error('Bostan Mac parallel PG test refuses unknown mode');
  const withBrowser=args[0]==='--run-with-browser';
  if(process.platform!=='darwin')throw Error('Native Mac only; no emulated/native Windows mutation');
  const required=[
    join(root,suite),
    join(root,'server','dist','index.js'),
    join(root,'server','dist-runtime','index.mjs'),
  ];
  for(const file of required){
    if(!existsSync(file)||!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())
      throw Error('Missing or linked owned QA prerequisite');
  }
  const pressure=spawnSync('/usr/bin/memory_pressure',['-Q'],{
    encoding:'utf8',timeout:5000,maxBuffer:8192});
  const freePercent=pressure.status===0?
    parseMacMemoryPressureFreePercentage(pressure.stdout):null;
  if(freePercent===null||freePercent<(withBrowser?50:40))
    throw Error('Mac usable memory below private concurrency threshold');
  const fs=statfsSync(root);
  if(Number(fs.bavail)*Number(fs.bsize)<2*1024**3)
    throw Error('Mac free disk below private concurrency threshold');
  await assertSafeRuntimeOutdir(join(root,'server','dist','index.js'),
    join(root,'server','dist-runtime'));
  if(withBrowser){
    const browserDir=join(root,'.qa-playwright-browsers');
    const uiDist=join(root,'ui','dist','index.html');
    if(!existsSync(browserDir)||!lstatSync(browserDir).isDirectory()||
       lstatSync(browserDir).isSymbolicLink()||
       !existsSync(uiDist)||!lstatSync(uiDist).isFile()||
       lstatSync(uiDist).isSymbolicLink())
      throw Error('Missing owned browser or UI production assets');
  }
  // No inherited provider secrets, cloud URLs, database URLs or Node flags.
  const env=scrubPrivateParallelEnv(process.env);
  if(withBrowser)
    env.PLAYWRIGHT_BROWSERS_PATH=join(root,'.qa-playwright-browsers');
  console.log('BOSTAN_MAC_PARALLEL_REAL_POSTGRES_START');
  console.log('BOSTAN_MAC_PARALLEL_BROWSER_MODE='+withBrowser);
  const runs=await Promise.all(LABELS.map((label,i)=>
    runWorker(label,env,withBrowser&&i===0?'browser':'api')));
  const overlap=assessParallelOverlap(runs);
  for(const r of runs){
    console.log('BOSTAN_MAC_PARALLEL_WORKER_'+r.label.toUpperCase()+'_'+
      (r.qualified?'PASS':'FAIL'));
  }
  console.log('BOSTAN_MAC_PARALLEL_ACTUAL_OVERLAP='+overlap);
  console.log('BOSTAN_MAC_PARALLEL_BOTH_CLEAN='+runs.every(r=>r.qualified));
  if(!overlap||!runs.every(r=>r.qualified))
    throw Error('Real parallel PostgreSQL and Better Auth QA not qualified; inspect exact owned fixtures');
  console.log('BOSTAN_MAC_PARALLEL_REAL_PG_AUTHZ_QUALIFIED');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(()=>{
    // Avoid printing raw child logs, credentials, URLs, postgres or user secrets.
    console.error('BOSTAN_MAC_PARALLEL_QA_REFUSED_OR_FAILED');
    process.exitCode=1;
  });
}
