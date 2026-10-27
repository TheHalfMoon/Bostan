#!/usr/bin/env node
/** Synthetic-only actual Better Auth session boundary QA. Opt-in and ephemeral. */
import {randomUUID, randomBytes} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function validateAuthzFixture(address,env=process.env){
  let u;
  try{u=new URL(address)}catch{throw Error('Invalid private Bostan authz target')}
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!/^\d{4,5}$/.test(u.port)||Number(u.port)<1024||Number(u.port)>65535||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('Bostan authenticated QA requires an explicit loopback HTTP origin');
  if(env.PAPERCLIP_DEPLOYMENT_MODE!=='authenticated'||env.PAPERCLIP_DEPLOYMENT_EXPOSURE!=='private')throw Error('Authenticated private deployment is mandatory');
  if(env.PAPERCLIP_AUTH_PUBLIC_BASE_URL!==u.origin)throw Error('Actual auth public origin must be identical to QA localhost');
  if(!env.BOSTAN_TEST_ONLY_SENTINEL||!existsSync(env.BOSTAN_TEST_ONLY_SENTINEL)||readFileSync(env.BOSTAN_TEST_ONLY_SENTINEL,'utf8')!=='BOSTAN_TEST_ONLY\n')throw Error('Disposable Bostan PostgreSQL ownership marker is missing');
  let database;
  try{database=new URL(env.DATABASE_URL)}catch{throw Error('Disposable PostgreSQL connection required')}
  if(!['postgres:','postgresql:'].includes(database.protocol)||database.hostname!=='127.0.0.1'||database.pathname!=='/bostan_qualification'||!/^\d{4,5}$/.test(database.port)||database.search||database.hash)throw Error('Refusing to mutate any database other than disposable localhost Bostan qualification');
  return u.origin;
}

function quoteId(value){
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,90}$/.test(value))throw Error('Bad synthetic Better Auth user identity');
  return `'${value}'`;
}
function quoteUuid(value){
  if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw Error('Invalid Bostan synthetic company/task UUID');
  return `'${value}'`;
}
export async function runAuthenticatedIsolation(address,{request=fetch,env=process.env,uuid=randomUUID,token=()=>randomBytes(18).toString('hex'),sqlExecutor}={}){
  const origin=validateAuthzFixture(address,env);
  const trace=uuid();quoteUuid(trace);
  const executeSql=sqlExecutor??((query)=>{
    const p=spawnSync('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--dbname',env.DATABASE_URL,'-c',query],{encoding:'utf8',timeout:12000,stdio:['ignore','pipe','pipe']});
    if(p.status!==0)throw Error(`Synthetic membership SQL failed (exit ${p.status})`);
  });
  let count=0;
  async function call(path,{method='GET',body,cookie,expected=[200]}={}){
    if(!/^\/api\/(auth\/(sign-up|sign-in)\/email|companies(?:\/[a-f0-9-]+(?:\/issues)?)?|issues\/[a-f0-9-]+)$/.test(path))throw Error('Unexpected authenticated Bostan QA route');
    const headers={'content-type':'application/json','origin':origin,'cache-control':'no-store'};
    if(cookie)headers.cookie=cookie;
    const res=await request(origin+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
    count++;
    if(!expected.includes(res.status))throw Error(`Actual authenticated Bostan HTTP ${res.status} on ${method} ${path}; expected ${expected.join('/')}`);
    const result=await res.json();
    return {result,res};
  }
  async function signUp(label){
    const email=`bostan-qa-${label}-${trace}@example.invalid`;
    const password=`Test-only-${token()}!A2`;
    const {result,res}=await call('/api/auth/sign-up/email',{method:'POST',body:{email,password,name:`Bostan QA ${label}`},expected:[200]});
    const id=result?.user?.id;quoteId(id);
    const raw=res.headers.getSetCookie?.()??[];
    const sessionCookie=raw.map(s=>s.split(';',1)[0]).find(s=>/session_token=/.test(s));
    if(!sessionCookie)throw Error('Actual Better Auth session cookie was not issued');
    return {id,cookie:sessionCookie};
  }
  const a=await signUp('a');
  const b=await signUp('b');
  // This authorization bootstrap is limited to an already proven, disposable
  // database; authenticated users must otherwise not get instance admin rights.
  executeSql(`insert into instance_user_roles(user_id,role) values(${quoteId(a.id)},'instance_admin') on conflict (user_id,role) do nothing`);
  const companyA=(await call('/api/companies',{method:'POST',cookie:a.cookie,body:{name:`Bostan authz A ${trace}`},expected:[201]})).result;
  const companyB=(await call('/api/companies',{method:'POST',cookie:a.cookie,body:{name:`Bostan authz B ${trace}`},expected:[201]})).result;
  quoteUuid(companyA.id);quoteUuid(companyB.id);
  if(companyA.id===companyB.id)throw Error('Expected two distinct Bostan authz companies');
  executeSql(`insert into company_memberships(company_id,principal_type,principal_id,status,membership_role) values(${quoteUuid(companyB.id)},'user',${quoteId(b.id)},'active','owner') on conflict(company_id,principal_type,principal_id) do update set status='active',membership_role='owner'`);
  executeSql(`delete from company_memberships where company_id=${quoteUuid(companyB.id)} and principal_type='user' and principal_id=${quoteId(a.id)}`);
  for(const [actor,own,foreign] of [[a,companyA,companyB],[b,companyB,companyA]]){
    const {result:mine}=await call(`/api/companies/${own.id}`,{cookie:actor.cookie});
    if(mine.id!==own.id)throw Error('Authenticated member cannot read own company');
    await call(`/api/companies/${foreign.id}`,{cookie:actor.cookie,expected:[403]});
    await call(`/api/companies/${foreign.id}/issues`,{cookie:actor.cookie,expected:[403]});
    await call(`/api/companies/${foreign.id}/issues`,{method:'POST',cookie:actor.cookie,body:{title:'Forbidden cross-company write'},expected:[403]});
  }
  const taskA=(await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:a.cookie,body:{title:`A authorized ${trace}`,status:'todo'},expected:[201]})).result;
  const taskB=(await call(`/api/companies/${companyB.id}/issues`,{method:'POST',cookie:b.cookie,body:{title:`B authorized ${trace}`,status:'todo'},expected:[201]})).result;
  quoteUuid(taskA.id);quoteUuid(taskB.id);
  for(const [actor,own,foreign,task,otherTask] of [[a,companyA,companyB,taskA,taskB],[b,companyB,companyA,taskB,taskA]]){
    const {result:mine}=await call(`/api/companies/${own.id}/issues`,{cookie:actor.cookie});
    const rows=Array.isArray(mine)?mine:mine?.issues;
    if(!Array.isArray(rows)||!rows.some(row=>row.id===task.id&&row.companyId===own.id)||rows.some(row=>row.id===otherTask.id||row.companyId!==own.id))throw Error('Authenticated company task list revealed foreign company data');
    const {result:detail}=await call(`/api/issues/${task.id}`,{cookie:actor.cookie});
    if(detail.id!==task.id||detail.companyId!==own.id)throw Error('Authenticated task detail mismatch');
    const missing=`${trace}`;
    const absent=await call(`/api/issues/${missing}`,{cookie:actor.cookie,expected:[404]});
    const foreignTask=await call(`/api/issues/${otherTask.id}`,{cookie:actor.cookie,expected:[404]});
    if(JSON.stringify(absent.result)!==JSON.stringify(foreignTask.result))throw Error('Cross-tenant issue existence oracle leaked resource identity');
  }
  // Test a real viewer access transition, not only a nonmember denial.
  // The membership is seeded inside the same verified throwaway database.
  executeSql(`insert into company_memberships(company_id,principal_type,principal_id,status,membership_role) values(${quoteUuid(companyA.id)},'user',${quoteId(b.id)},'active','viewer') on conflict(company_id,principal_type,principal_id) do update set status='active',membership_role='viewer'`);
  const viewerDetail=await call(`/api/companies/${companyA.id}`,{cookie:b.cookie});
  if(viewerDetail.result?.id!==companyA.id)throw Error('Viewer could not read shared company');
  await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:b.cookie,body:{title:'Viewer must not create a task'},expected:[403]});
  // The session token stays identical; membership is loaded on each request.
  executeSql(`update company_memberships set status='revoked' where company_id=${quoteUuid(companyA.id)} and principal_type='user' and principal_id=${quoteId(b.id)}`);
  await call(`/api/companies/${companyA.id}`,{cookie:b.cookie,expected:[403]});
  await call(`/api/companies/${companyA.id}/issues`,{cookie:b.cookie,expected:[403]});
  await call(`/api/companies/${companyA.id}`,{expected:[401,403]});
  return {schema:'bostan.two-authenticated-sessions.v1',passed:true,releaseQualified:false,authMode:'authenticated',sessionUsers:2,independentMemberships:2,crossCompanyDetailDenials:2,crossCompanyListDenials:2,crossCompanyWriteDenials:2,foreignTask404MatchesNonexistence:2,viewerReadAllowed:1,viewerWriteDenied:1,revokedMembershipAccessDenied:2,syntheticOnly:true,requests:count,providerCalls:0};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const args=process.argv.slice(2);if(args.length===0||(args.length===1&&args[0]==='--plan'))console.log('Bostan private authenticated multi-session test: --run --url http://127.0.0.1:<port>/; requires disposable PostgreSQL sentinel. No real accounts or model calls.');else if(args.length===3&&args[0]==='--run'&&args[1]==='--url'){try{console.log(JSON.stringify(await runAuthenticatedIsolation(args[2]),null,2));console.log('BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS')}catch(e){console.error('Bostan real authenticated QA failed:',e.message);process.exitCode=1}}else{console.error('Usage: --plan | --run --url http://127.0.0.1:<port>/');process.exitCode=2;}}
