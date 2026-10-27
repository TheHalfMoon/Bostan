#!/usr/bin/env node
/**
 * Opt-in, synthetic-only parallel first-admin claim against the actual
 * compiled Bostan HTTP server and an owned disposable PostgreSQL database.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAuthzFixture } from './bostan-private-staged-authz-e2e.mjs';

export function validatePrivateAdminRace(url, env = process.env) {
  const origin = validateAuthzFixture(url, env);
  if (env.BOSTAN_AUTHZ_RACE_HTTP !== '1') {
    throw Error('Private Bostan parallel admin HTTP QA must be explicitly enabled');
  }
  return origin;
}

async function boundedFetch(url, init = {}, request = fetch) {
  return await request(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
}

export async function runPrivateAdminRace(url, { env = process.env, request = fetch, count = 8 } = {}) {
  const origin = validatePrivateAdminRace(url, env);
  if (count !== 8) throw Error('Bostan parallel first-admin QA requires eight independent synthetic sessions');
  const response = await boundedFetch(origin+'/api/health',{},request);
  if (response.status !== 200 || (await response.json())?.bootstrapStatus !== 'bootstrap_pending') {
    throw Error('Bostan race QA requires an unclaimed, disposable private instance');
  }
  const unauthenticated = await boundedFetch(origin+'/api/bootstrap/claim',{method:'POST'},request);
  if (unauthenticated.status!==401)throw Error('Anonymous parallel admin claim was not refused');
  const trace=randomUUID();
  const actors=[];
  for(let i=0;i<count;i++){
    const email=`bostan-qa-race-${i}-${trace}@example.invalid`;
    const password=`Test-only-${randomBytes(18).toString('hex')}!A2`;
    const signup=await boundedFetch(origin+'/api/auth/sign-up/email',{
      method:'POST',headers:{'content-type':'application/json',origin},
      body:JSON.stringify({email,password,name:`Bostan Race QA ${i}`}),
    },request);
    if(signup.status!==200)throw Error('Private synthetic actor sign-up did not succeed');
    const body=await signup.json();
    const id=body?.user?.id;
    if(typeof id!=='string'||!/^[A-Za-z0-9_-]{8,90}$/.test(id)||actors.some(x=>x.id===id))throw Error('Private race actor identity invalid or duplicated');
    const raw=signup.headers.getSetCookie?.()??[];
    const cookie=raw.map(x=>x.split(';',1)[0]).find(x=>/^[-\w.]*session_token=[^\s;]{16,8192}$/.test(x));
    if(!cookie)throw Error('Synthetic Better Auth session cookie absent');
    actors.push({id,cookie});
  }
  // No serial ordering: eight independent authenticated callers contest the
  // same actual first-admin transaction and database table lock.
  const attempts=await Promise.all(actors.map(actor=>boundedFetch(origin+'/api/bootstrap/claim',{
    method:'POST',headers:{origin,cookie:actor.cookie,'content-type':'application/json'},
  },request)));
  const claims=await Promise.all(attempts.map(async(res)=>({status:res.status,body:await res.json()})));
  const winningIndices=claims.flatMap((c,i)=>c.status===200?[i]:[]);
  if(winningIndices.length!==1)throw Error('Bostan first-admin race produced multiple or zero HTTP winners');
  const winner=winningIndices[0];
  if(claims[winner]?.body?.claimed!==true||claims[winner]?.body?.userId!==actors[winner]?.id)throw Error('First-admin winner did not match authenticated session');
  if(claims.some((c,i)=>i!==winner&&(c.status!==409||typeof c.body?.error!=='string')))throw Error('First-admin race loser did not receive safe HTTP conflict');
  const health=await boundedFetch(origin+'/api/health',{},request);
  if(health.status!==200||(await health.json())?.bootstrapStatus!=='ready')throw Error('Bostan private bootstrap state did not transition exactly once');
  // Confirm actual *committed* role, not only HTTP response payloads.
  const sql=spawnSync('psql',[
    '--no-psqlrc','--set','ON_ERROR_STOP=1','--quiet','--tuples-only','--no-align',
    '--dbname',env.DATABASE_URL,
    '-c',"SELECT user_id FROM instance_user_roles WHERE role='instance_admin' ORDER BY user_id",
  ],{encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe']});
  if(sql.status!==0)throw Error('Could not independently inspect disposable private PostgreSQL admin role');
  const persisted=sql.stdout.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(persisted.length!==1||persisted[0]!==actors[winner]?.id)throw Error('Committed PostgreSQL first-admin winner mismatch or duplicate');
  const repeat=await Promise.all(actors.map(actor=>boundedFetch(origin+'/api/bootstrap/claim',{
    method:'POST',headers:{origin,cookie:actor.cookie},
  },request)));
  if(repeat.some(res=>res.status!==409))throw Error('A previously committed first-admin claim was replayable');
  return {schema:'bostan.private-first-admin-http-race.v1',passed:true,releaseQualified:false,
    syntheticOnly:true,independentSessions:count,concurrentClaims:count,
    successfulClaims:1,rejectedConcurrentClaims:count-1,committedAdminRoles:1,
    repeatedClaimsRejected:count,anonymousClaimRejected:1,providerCalls:0};
}

const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log(JSON.stringify({schema:'bostan.private-first-admin-http-race.v1',
      releaseQualified:false,run:false,loopbackOnly:true,syntheticOnly:true,claimants:8},null,2));
  }else if(args.length===3&&args[0]==='--run'&&args[1]==='--url'){
    try{console.log(JSON.stringify(await runPrivateAdminRace(args[2]),null,2))}
    catch(error){console.error('Bostan private admin race failed:',error.message);process.exitCode=1}
  }else{
    console.error('Usage: node scripts/bostan-private-staged-admin-race-e2e.mjs [--plan|--run --url http://127.0.0.1:<port>/]');
    process.exitCode=2;
  }
}
