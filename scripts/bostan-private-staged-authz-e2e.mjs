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
    if(!/^\/api\/(auth\/(sign-up|sign-in)\/email|bootstrap\/claim|companies(?:\/[a-f0-9-]+(?:\/(?:issues|invites|members(?:\/[a-f0-9-]+)?))?)?|issues\/[a-f0-9-]+|invites\/pcp_invite_[a-zA-Z0-9_-]+\/accept)$/.test(path))throw Error('Unexpected authenticated Bostan QA route');
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
  // The browser acceptance path also validates an actual first-user signup.
  // Its private cookie stays in-memory and never enters receipts or logs.
  let firstSignupBrowser=null;
  let a;
  if(env.BOSTAN_AUTHZ_BROWSER_UI==='1'){
    const {signupFirstUserWithBrowser}=await import('../ui/scripts/bostan-private-auth-signup-browser.mjs');
    a=await signupFirstUserWithBrowser({
      origin:origin+'/',
      email:`bostan-qa-a-${trace}@example.invalid`,
      name:'Bostan QA a',
      password:`Test-only-${token()}!A2`,
    });
    quoteId(a.id);
    firstSignupBrowser={signedUpThroughActualChromiumUi:1,realSessionCookieReturned:1,externalBrowserRequests:0};
  }else{
    a=await signUp('a');
  }
  const b=await signUp('b');
  // On the full Chromium UI path, qualify the actual first-admin claim
  // rather than injecting the administrator role via SQL. Non-UI historical
  // authz mode keeps its disposable fixture unchanged.
  let firstAdminBrowser=null;
  if(env.BOSTAN_AUTHZ_BROWSER_UI==='1'){
    await call('/api/bootstrap/claim',{method:'POST',expected:[401]});
    const {claimFirstAdminWithBrowser}=await import('../ui/scripts/bostan-private-first-admin-browser.mjs');
    firstAdminBrowser=await claimFirstAdminWithBrowser({origin:origin+'/',cookie:a.cookie,expectedUserId:a.id});
    await call('/api/bootstrap/claim',{method:'POST',cookie:b.cookie,expected:[409]});
    const check=await request(origin+'/api/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(check.status!==200||(await check.json())?.bootstrapStatus!=='ready')throw Error('First-admin browser claim did not close bootstrap state');
  }else if(env.BOSTAN_AUTHZ_API_FIRST_ADMIN==='1'){
    // Exact built-server QA: exercise the production first-admin claim endpoint
    // with two real Better Auth session cookies, rather than seeding the role.
    await call('/api/bootstrap/claim',{method:'POST',expected:[401]});
    const {result:claimed}=await call('/api/bootstrap/claim',{
      method:'POST',cookie:a.cookie,expected:[200],
    });
    if(claimed?.claimed!==true||claimed.userId!==a.id)
      throw Error('First administrator claim did not assign the signed-in user');
    await call('/api/bootstrap/claim',{method:'POST',cookie:b.cookie,expected:[409]});
    const ready=await request(origin+'/api/health',{
      redirect:'error',signal:AbortSignal.timeout(15000),
    });
    if(ready.status!==200||(await ready.json())?.bootstrapStatus!=='ready')
      throw Error('Real first-admin claim did not complete bootstrap');
  }else{
    // Backward-compatible staged API-only fixture: role is seeded in the
    // isolated database (never claim this legacy path verified the HTTP claim).
    executeSql(`insert into instance_user_roles(user_id,role) values(${quoteId(a.id)},'instance_admin') on conflict (user_id,role) do nothing`);
  }
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

  // Distinct from the prior SQL-seeded viewer scenario: exercise Bostan's own
  // real invitation and membership administration APIs, without writing any
  // further human membership rows through SQL. An invite token is ephemeral
  // and must never be printed or persisted in the receipt.
  await call(`/api/companies/${companyA.id}/invites`,{method:'POST',cookie:b.cookie,body:{allowedJoinTypes:'human',humanRole:'viewer'},expected:[403]});
  const {result:invitation}=await call(`/api/companies/${companyA.id}/invites`,{method:'POST',cookie:a.cookie,body:{allowedJoinTypes:'human',humanRole:'viewer'},expected:[201]});
  if(typeof invitation?.token!=='string'||!/^pcp_invite_[a-zA-Z0-9_-]{16,}$/.test(invitation.token)||invitation.companyId!==companyA.id)throw Error('Bostan human invitation token is absent or improperly scoped');
  const {result:joined}=await call(`/api/invites/${invitation.token}/accept`,{method:'POST',cookie:b.cookie,body:{requestType:'human'},expected:[202]});
  if(joined?.status!=='approved'||joined?.companyId!==companyA.id||joined.requestingUserId!==b.id)throw Error('Bostan human invite was not approved into the expected company');
  const {result:invitedView}=await call(`/api/companies/${companyA.id}`,{cookie:b.cookie});
  if(invitedView.id!==companyA.id)throw Error('Accepted Bostan viewer invite did not grant read access');
  await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:b.cookie,body:{title:'Invited viewer must not create task'},expected:[403]});
  const {result:directory}=await call(`/api/companies/${companyA.id}/members`,{cookie:a.cookie});
  const inviteeMember=directory?.members?.find(member=>member.principalType==='user'&&member.principalId===b.id);
  if(!inviteeMember||inviteeMember.companyId!==companyA.id||inviteeMember.membershipRole!=='viewer'||inviteeMember.status!=='active')throw Error('Bostan member directory did not reflect invited viewer');
  quoteUuid(inviteeMember.id);
  await call(`/api/companies/${companyA.id}/members/${inviteeMember.id}`,{method:'PATCH',cookie:b.cookie,body:{membershipRole:'operator'},expected:[403]});
  const {result:promoted}=await call(`/api/companies/${companyA.id}/members/${inviteeMember.id}`,{method:'PATCH',cookie:a.cookie,body:{membershipRole:'operator'},expected:[200]});
  if(promoted?.membershipRole!=='operator'||promoted.principalId!==b.id)throw Error('Bostan member promotion did not persist through API');
  const {result:operatorTask}=await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:b.cookie,body:{title:`Bostan invited operator task ${trace}`,status:'todo'},expected:[201]});
  if(operatorTask?.companyId!==companyA.id)throw Error('Invited operator could not write in newly authorized company');
  const {result:suspended}=await call(`/api/companies/${companyA.id}/members/${inviteeMember.id}`,{method:'PATCH',cookie:a.cookie,body:{status:'suspended'},expected:[200]});
  if(suspended?.status!=='suspended')throw Error('Bostan membership suspension did not persist');
  await call(`/api/companies/${companyA.id}`,{cookie:b.cookie,expected:[403]});
  await call(`/api/companies/${companyA.id}/issues`,{cookie:b.cookie,expected:[403]});
  await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:b.cookie,body:{title:'Suspended member cannot write'},expected:[403]});
  let sharedPostgresConcurrency=null;
  if(env.BOSTAN_AUTHZ_SHARED_DB_CONCURRENT==='1'){
    // All 12 writes intentionally target the *same* real PostgreSQL cluster
    // from two distinct already-authenticated companies and users. Use no
    // direct SQL modifications, mock responders, or imported fixture tokens.
    const prepared=Array.from({length:12},(_,i)=>({
      actor:i%2===0?a:b,company:i%2===0?companyA:companyB,
      title:'Bostan simultaneous synthetic write '+String(i)+' '+trace,
    }));
    const committed=await Promise.all(prepared.map(async item=>{
      const began=performance.now();
      const {result}=await call(`/api/companies/${item.company.id}/issues`,{
        method:'POST',cookie:item.actor.cookie,
        body:{title:item.title,status:'todo'},expected:[201],
      });
      const ended=performance.now();
      quoteUuid(result?.id);
      if(result.companyId!==item.company.id||ended<began)
        throw Error('Shared PostgreSQL concurrent write scope mismatch');
      return {id:result.id,companyId:result.companyId,began,ended};
    }));
    const overlap=Math.max(...committed.map(x=>x.began))<
      Math.min(...committed.map(x=>x.ended));
    if(!overlap||new Set(committed.map(x=>x.id)).size!==committed.length)
      throw Error('Real shared PostgreSQL writes did not overlap or have distinct IDs');
    const [aRows,bRows]=await Promise.all([
      call(`/api/companies/${companyA.id}/issues`,{cookie:a.cookie}),
      call(`/api/companies/${companyB.id}/issues`,{cookie:b.cookie}),
    ]);
    const list=value=>Array.isArray(value)?value:value?.issues;
    const aList=list(aRows.result),bList=list(bRows.result);
    if(!Array.isArray(aList)||!Array.isArray(bList))
      throw Error('Real shared PostgreSQL issue list malformed');
    const ownA=new Set(committed.filter(x=>x.companyId===companyA.id).map(x=>x.id));
    const ownB=new Set(committed.filter(x=>x.companyId===companyB.id).map(x=>x.id));
    if(ownA.size!==6||ownB.size!==6||
       ![...ownA].every(id=>aList.some(x=>x.id===id&&x.companyId===companyA.id))||
       ![...ownB].every(id=>bList.some(x=>x.id===id&&x.companyId===companyB.id))||
       aList.some(x=>ownB.has(x.id))||bList.some(x=>ownA.has(x.id)))
      throw Error('Concurrent shared PostgreSQL readback leaked or lost a company issue');
    await Promise.all([
      call(`/api/companies/${companyB.id}/issues`,{
        method:'POST',cookie:a.cookie,body:{title:'Cross-tenant write refused A'},
        expected:[403]}),
      call(`/api/companies/${companyA.id}/issues`,{
        method:'POST',cookie:b.cookie,body:{title:'Suspended write refused B'},
        expected:[403]}),
    ]);
    sharedPostgresConcurrency={
      sameRealDatabase:true,concurrentWrites:12,
      distinctIssueIds:12,actualHttpOverlap:true,
      twoCompanyReadbacksPassed:true,concurrentForbiddenWritesDenied:2,
    };
    console.log('BOSTAN_SHARED_REAL_POSTGRES_CONCURRENT_WRITES_PASS');
  }
  let browserUi=null;
  if(env.BOSTAN_AUTHZ_BROWSER_UI==='1'){
    // Run ONLY as a continuation of the already verified disposable fixture,
    // with real Better Auth user cookies and production Chromium interactions.
    const {withPrivateMemberBrowser}=await import('../ui/scripts/bostan-private-members-browser.mjs');
    const c=await signUp('c');
    const invitedEmail=`bostan-qa-c-${trace}@example.invalid`;
    browserUi=await withPrivateMemberBrowser({origin:origin+'/',cookie:a.cookie,companyId:companyA.id,companyPrefix:companyA.issuePrefix},async(browser)=>{
      const invite=await browser.createInvite();
      const {result:joinedC}=await call(`/api/invites/${invite.token}/accept`,{method:'POST',cookie:c.cookie,body:{requestType:'human'},expected:[202]});
      if(joinedC.status!=='approved'||joinedC.companyId!==companyA.id||joinedC.requestingUserId!==c.id)throw Error('Real Chromium generated invite was not accepted by third session');
      await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:c.cookie,body:{title:'Invited viewer forbidden'},expected:[403]});
      const promotion=await browser.updateMember(invitedEmail,{role:'operator'});
      const {result:task}=await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:c.cookie,body:{title:`UI-promoted operator task ${trace}`,status:'todo'},expected:[201]});
      if(task.companyId!==companyA.id)throw Error('UI-promoted operator cannot write to company');
      const suspension=await browser.updateMember(invitedEmail,{status:'suspended'});
      if(suspension.memberId!==promotion.memberId)throw Error('Member UI changed target identity across updates');
      await call(`/api/companies/${companyA.id}`,{cookie:c.cookie,expected:[403]});
      await call(`/api/companies/${companyA.id}/issues`,{method:'POST',cookie:c.cookie,body:{title:'Suspended UI member forbidden'},expected:[403]});
      return {realChromiumInviteCreated:1,inviteAcceptedByThirdSession:1,viewerTaskWriteDenied:1,uiPromotionEnablesWrite:1,uiSuspensionDenials:2,memberUiUpdates:2};
    });
  }
  return {schema:browserUi?'bostan.three-session-chromium-signup-first-admin.v3':'bostan.two-authenticated-sessions.v2',passed:true,releaseQualified:false,authMode:'authenticated',sessionUsers:browserUi?3:2,independentMemberships:2,crossCompanyDetailDenials:2,crossCompanyListDenials:2,crossCompanyWriteDenials:2,foreignTask404MatchesNonexistence:2,viewerReadAllowed:1,viewerWriteDenied:1,revokedMembershipAccessDenied:2,inviteCreated:1,inviteAcceptedViaApi:1,inviteeViewerRead:1,inviteeViewerWriteDenied:1,unauthorizedInviteDenied:1,unauthorizedPromotionDenied:1,promotionEnablesOperatorWrite:1,suspensionDenialsSameSession:3,syntheticOnly:true,requests:count,providerCalls:0,...(env.BOSTAN_AUTHZ_API_FIRST_ADMIN==='1'?{realApiFirstAdminClaim:1,anonymousAdminClaimDenied:1,secondAdminClaimDenied:1}:{}),...(firstSignupBrowser?{firstSignupBrowser}:{}),...(firstAdminBrowser?{firstAdminBrowser,secondAdminClaimRejected:1,anonymousAdminClaimRejected:1}:{}),...(browserUi?{browserUi}:{} ),
    ...(sharedPostgresConcurrency?{sharedPostgresConcurrency}:{} )};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const args=process.argv.slice(2);if(args.length===0||(args.length===1&&args[0]==='--plan'))console.log('Bostan private authenticated multi-session test: --run --url http://127.0.0.1:<port>/; requires disposable PostgreSQL sentinel. No real accounts or model calls.');else if(args.length===3&&args[0]==='--run'&&args[1]==='--url'){try{console.log(JSON.stringify(await runAuthenticatedIsolation(args[2]),null,2));console.log('BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS')}catch(e){console.error('Bostan real authenticated QA failed:',e.message);process.exitCode=1}}else{console.error('Usage: --plan | --run --url http://127.0.0.1:<port>/');process.exitCode=2;}}
