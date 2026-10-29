#!/usr/bin/env node
/** Explicit native-Windows, disposable localhost Bostan authenticated server QA. */
import {randomBytes,randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {existsSync,lstatSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {createServer} from "node:net";
import {basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {checkBostanWindowsDisk} from "./bostan-private-windows-disk-admission.mjs";
import {checkBostanWindowsMemory} from "./bostan-private-windows-memory-admission.mjs";
import {buildPrivateWindowsHttpQaEnvironment} from "./bostan-private-windows-qa-env.mjs";
import {parsePrivateWindowsQaWave,matchingPrivateWindowsQaWave} from "./bostan-private-windows-qa-wave.mjs";
import {observeOwnedQaChild} from "./bostan-private-windows-child-lifecycle.mjs";
import {evaluateWindowsPrivateHttpEvidence} from "./bostan-private-windows-http-evidence.mjs";
import {waitForWindowsPrivateHealth} from "./bostan-private-windows-health-wait.mjs";
import {evaluateWindowsPgOrphanCheck} from "./bostan-private-windows-pg-orphan-proof.mjs";
import {resolvePrivateWindowsPowerShellBinary} from "./bostan-private-windows-powershell-binary.mjs";
import {resolvePrivateWindowsQaServerCommand} from "./bostan-private-windows-server-command.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const spec={schema:"bostan.private-windows-auth-server.v1",run:false,
  releaseQualified:false,localhostOnly:true,usesRealDatabase:true,
  usesRealHttpServer:true,authenticatedBrowserQualified:false,
  noPaidCredentials:true,publishes:false};
const args=process.argv.slice(2);
if(!args.length||args.length===1&&args[0]==="--plan"){
  console.log(JSON.stringify(spec,null,2));
  process.exit(0);
}
if(args.length!==1||!["--run","--run-compiled","--run-compiled-browser"].includes(args[0])){
  console.error("Usage: node --import ./server/node_modules/tsx/dist/loader.mjs scripts/bostan-private-windows-live-http.mjs [--plan|--run|--run-compiled|--run-compiled-browser]");
  process.exit(2);
}
const browserMode=args[0]==="--run-compiled-browser";
const serverMode=args[0]==="--run"?"source":"compiled";
if(process.platform!=="win32"||!parsePrivateWindowsQaWave(basename(resolve(root)),"qa")){
  console.error("Native Windows live HTTP QA requires an isolated Bostan three-digit QA checkout");
  process.exit(2);
}
for(const key of Object.keys(process.env)){
  if(/^(?:PAPERCLIP_CLOUD_|BOSTAN_CLOUD_|PAPERCLIP_MANAGED_CONFIG$|PAPERCLIP_PRIMARY_HOST$)/i.test(key)){
    console.error("Bostan private QA refuses inherited managed Cloud configuration");
    process.exit(2);
  }
}
const temp=process.env.TEMP||"";
if(!existsSync(temp)||lstatSync(temp).isSymbolicLink()||
   !matchingPrivateWindowsQaWave(basename(resolve(root)),basename(temp))){
  console.error("Bostan native QA requires an owned test-only TEMP directory");
  process.exit(2);
}
const admission=checkBostanWindowsDisk({workspace:root,tempDir:temp});
if(!admission.allowed){
  console.error("BOSTAN_WINDOWS_LIVE_STORAGE_REFUSED="+admission.reason);
  console.error(JSON.stringify(admission));
  process.exit(2);
}
const memoryAdmission=checkBostanWindowsMemory();
if(!memoryAdmission.allowed){
  console.error("BOSTAN_WINDOWS_LIVE_MEMORY_REFUSED="+memoryAdmission.reason);
  process.exit(2);
}
// A native Chromium + real PostgreSQL + packed Node server launch is
// significantly heavier than the backend-only gate. Refuse low-memory
// attempts before creating any owned database or long-running process.
// This is resource protection, not a claim that 4 GiB ensures success.
if(browserMode&&memoryAdmission.freeGiB<4){
  console.error("BOSTAN_WINDOWS_LIVE_CHROMIUM_MEMORY_REFUSED");
  process.exit(2);
}
// Fail closed before creating scratch state or starting PostgreSQL. A compiled
// QA run must have a complete, SHA-256-owned, non-linked Bostan runtime.
let serverCommand;
try {
  serverCommand=await resolvePrivateWindowsQaServerCommand({root:resolve(root),mode:serverMode});
} catch {
  console.error("BOSTAN_WINDOWS_LIVE_COMPILED_RUNTIME_REFUSED");
  process.exit(2);
}
if(browserMode){
  // Fail closed BEFORE creating a PostgreSQL fixture or any application data.
  const browserRoot=join(root,".qa-playwright-browsers");
  const requested=process.env.PLAYWRIGHT_BROWSERS_PATH;
  const dist=join(root,"ui","dist","index.html");
  try {
    if(typeof requested!=="string"||resolve(requested)!==browserRoot||
       !lstatSync(browserRoot).isDirectory()||lstatSync(browserRoot).isSymbolicLink()||
       !lstatSync(dist).isFile()||lstatSync(dist).isSymbolicLink())
      throw Error("Unsafe browser assets");
    const {createRequire}=await import("node:module");
    const require=createRequire(join(root,"ui","package.json"));
    const {chromium}=require("@playwright/test");
    const browser=await chromium.launch({headless:true,timeout:15000});
    await browser.close();
  }catch{
    console.error("BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_REFUSED");
    process.exit(2);
  }
  console.log("BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_PASS");
}
async function availablePort(){
  const server=createServer();
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
  const port=server.address().port;
  await new Promise(ok=>server.close(ok));
  return port;
}
let db=null,server=null,serverObserver=null;
let failed=false;
let serverOutput="";
let lastHealthStatus="no_response";
let lastHealthOutcome="not_started";
let lastHealthProbes=0;
let serverStartedAt=0;
const home=mkdtempSync(join(temp,"bostan-private-auth-http-"));
writeFileSync(join(home,"BOSTAN_QA_OWNED"),"BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
const httpEvents=[];
function markHttpStage(name){
  httpEvents.push(name);
  console.log(name);
}
let completedHttpChecks=false;
let serverClosed=true;
let dbCleaned=true;
let ownedHomeCleaned=false;
let childStateForceUsed=false;
let postgresProcessTreeVerified=false;
let browserSignupPassed=false,browserAdminPassed=false;
try{
  process.env.PAPERCLIP_TEST_POSTGRES_TEMPLATE="0";
  const {startEmbeddedPostgresTestDatabase}=await import("../packages/db/src/test-embedded-postgres.js");
  db=await startEmbeddedPostgresTestDatabase("bostan-private-auth-http-db-");
  markHttpStage("BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED");
  // Recheck after the real migration, before starting the memory-heavy
  // TypeScript server. A failure enters owned PostgreSQL teardown below.
  const afterDbMemory=checkBostanWindowsMemory();
  if(!afterDbMemory.allowed||(browserMode&&afterDbMemory.freeGiB<3)){
    console.error("BOSTAN_WINDOWS_LIVE_MEMORY_POSTGRES_REFUSED="+
      (browserMode&&afterDbMemory.freeGiB<3?"chromium_low_free_memory":afterDbMemory.reason));
    throw Error("Native Windows memory admission failed after PostgreSQL migration");
  }
  const port=await availablePort();
  const origin="http://127.0.0.1:"+port;
  // The app child must never inherit unrelated operator tokens, DSNs or
  // writable profile paths. Only the system loader keys are copied.
  const env=buildPrivateWindowsHttpQaEnvironment({
    inherited:process.env,home,origin,connectionString:db.connectionString,
    port,marker:join(home,"BOSTAN_QA_OWNED"),
    secret:randomBytes(32).toString("hex"),serveUi:browserMode,
  });
  mkdirSync(env.APPDATA,{recursive:true,mode:0o700});
  mkdirSync(env.LOCALAPPDATA,{recursive:true,mode:0o700});
  console.log("BOSTAN_WINDOWS_LIVE_SERVER_MODE="+serverCommand.mode);
  server=spawn(process.execPath,serverCommand.nodeArgs,{
    cwd:join(root,"server"),env,windowsHide:true,stdio:["ignore","pipe","pipe"],
  });
  // Observe immediately: a failed spawn emits async error and close events.
  // The monitor owns this specific ChildProcess handle; no global PID search.
  serverObserver=observeOwnedQaChild(server);
  for(const stream of [server.stdout,server.stderr])stream?.on("data",part=>{
    serverOutput=(serverOutput+String(part)).slice(-65536);
  });
  serverClosed=false;
  serverStartedAt=Date.now();
  // This is a TRUE 180-second monotonic elapsed-time deadline, not 180
  // attempts of up to 1.5s fetch + 1s delay (up to ~450 seconds).
  // Only this owned child is observed; the endpoint must be loopback HTTP.
  const healthProbe=await waitForWindowsPrivateHealth({
    endpoint:origin+"/api/health",
    childExited:()=>serverObserver.exitedOrFailed,
  });
  lastHealthStatus=healthProbe.observation;
  lastHealthOutcome=healthProbe.outcome;
  lastHealthProbes=healthProbe.probes;
  if(!healthProbe.healthy)
    throw Error("Real Bostan native Windows authenticated server did not reach expected private ready state");
  markHttpStage("BOSTAN_WINDOWS_LIVE_HTTP_AUTH_HEALTH_PASS");
  // Same-origin without a browser session must not claim first admin.
  const anonymousClaim=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{origin,"content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(anonymousClaim.status!==401)
    throw Error("Anonymous first-admin claim was not denied");
  markHttpStage("BOSTAN_WINDOWS_LIVE_ANONYMOUS_CLAIM_DENIED");
  const email=(browserMode?"bostan-qa-a-":"bostan-b086-")+randomUUID()+"@example.invalid";
  const password="Test-only-"+randomBytes(18).toString("hex")+"!A2";
  let body,cookie;
  if(browserMode){
    const {signupFirstUserWithBrowser}=await import("../ui/scripts/bostan-private-auth-signup-browser.mjs");
    const signed=await signupFirstUserWithBrowser({
      origin,email,password,name:"Bostan QA a",
    });
    body={user:{id:signed.id}};
    cookie=signed.cookie;
    browserSignupPassed=signed.createdFromRealUi===true;
    if(!browserSignupPassed)throw Error("Real Windows browser signup was not proven");
    console.log("BOSTAN_WINDOWS_CHROMIUM_SIGNUP_PASS");
  }else{
    const response=await fetch(origin+"/api/auth/sign-up/email",{
      method:"POST",headers:{"content-type":"application/json","origin":origin},
      body:JSON.stringify({email,password,name:"Bostan synthetic QA first admin"}),
      signal:AbortSignal.timeout(15000),redirect:"error",
    });
    if(response.status!==200)throw Error("Native Windows real Better Auth signup status mismatch");
    body=await response.json();
    if(typeof body?.user?.id!=="string"||!body.user.id)throw Error("Real session user id missing");
    cookie=response.headers.getSetCookie?.().map(x=>x.split(";")[0]).find(x=>x.includes("session_token="));
    if(!cookie)throw Error("Real Bostan Better Auth session cookie absent");
  }
  markHttpStage("BOSTAN_WINDOWS_LIVE_AUTH_SIGNUP_PASS");
  // Session cookie presence is insufficient: bind it to this synthetic user.
  const session=await fetch(origin+"/api/auth/get-session",{
    headers:{cookie},redirect:"error",signal:AbortSignal.timeout(12000),
  });
  const sessionBody=await session.json().catch(()=>null);
  if(session.status!==200||sessionBody?.user?.id!==body.user.id||
     sessionBody?.user?.email!==email||
     sessionBody?.session?.userId!==body.user.id)
    throw Error("Signed-in session does not match synthetic user");
  markHttpStage("BOSTAN_WINDOWS_LIVE_SIGNED_IN_SESSION_PASS");

  const hostileOrigin=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{cookie,origin:"https://attacker.example.invalid",
      "content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(hostileOrigin.status!==403)throw Error("Cross-origin claim not forbidden");
  markHttpStage("BOSTAN_WINDOWS_LIVE_CROSS_ORIGIN_CLAIM_DENIED");

  const forgedReferer=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{cookie,origin:"https://attacker.example.invalid",
      referer:origin+"/dashboard","content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(forgedReferer.status!==403)
    throw Error("Hostile Origin with trusted Referer was not forbidden");
  markHttpStage("BOSTAN_WINDOWS_LIVE_SPOOFED_REFERER_CLAIM_DENIED");

  // Real browser Origins include the scheme. Matching host and port do not
  // make an HTTPS Origin trusted for this HTTP-only loopback test server.
  const crossScheme=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{cookie,origin:origin.replace(/^http:/,"https:"),
      "content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(crossScheme.status!==403)
    throw Error("Cross-scheme session claim was not forbidden");
  markHttpStage("BOSTAN_WINDOWS_LIVE_CROSS_SCHEME_CLAIM_DENIED");

  // A serialized browser Origin is only scheme + authority. A path is
  // noncanonical even when it names the trusted host and Referer looks valid.
  const noncanonicalOrigin=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{cookie,origin:origin+"/private/path",
      referer:origin+"/dashboard","content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(noncanonicalOrigin.status!==403)
    throw Error("Noncanonical Origin was accepted for session claim");
  markHttpStage("BOSTAN_WINDOWS_LIVE_NONCANONICAL_ORIGIN_DENIED");

  const noOrigin=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{cookie,"content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(noOrigin.status!==403)throw Error("Originless session claim not forbidden");
  markHttpStage("BOSTAN_WINDOWS_LIVE_MISSING_ORIGIN_CLAIM_DENIED");

  const pending=await fetch(origin+"/api/health",{
    signal:AbortSignal.timeout(12000),redirect:"error",
  });
  const pendingBody=await pending.json().catch(()=>null);
  if(pending.status!==200||pendingBody?.bootstrapStatus!=="bootstrap_pending")
    throw Error("Rejected claims changed first-admin bootstrap state");
  markHttpStage("BOSTAN_WINDOWS_LIVE_DENIALS_PRESERVE_PENDING");
  if(browserMode){
    const {claimFirstAdminWithBrowser}=await import("../ui/scripts/bostan-private-first-admin-browser.mjs");
    const browserClaim=await claimFirstAdminWithBrowser({
      origin,cookie,expectedUserId:body.user.id,
    });
    browserAdminPassed=browserClaim.claimedThroughActualChromiumUi===1 &&
      browserClaim.claimedUserIdMatchesSession===1 &&
      browserClaim.browserJsErrors===0 && browserClaim.externalBrowserRequests===0;
    if(!browserAdminPassed)throw Error("Real Windows browser admin claim not proven");
    console.log("BOSTAN_WINDOWS_CHROMIUM_FIRST_ADMIN_PASS");
  }else{
    const claim=await fetch(origin+"/api/bootstrap/claim",{
      method:"POST",headers:{"cookie":cookie,"origin":origin,"content-type":"application/json"},
      signal:AbortSignal.timeout(15000),redirect:"error",
    });
    const claimedBody=await claim.json().catch(()=>null);
    if(claim.status!==200||claimedBody?.claimed!==true||
       claimedBody?.userId!==body.user.id)
      throw Error("First-admin claim did not bind signed-in synthetic user");
  }
  markHttpStage("BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS");
  const repeat=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{cookie,origin,"content-type":"application/json"},
    body:"{}",redirect:"error",signal:AbortSignal.timeout(12000),
  });
  if(repeat.status!==409)throw Error("Repeat first-admin claim was not refused");
  markHttpStage("BOSTAN_WINDOWS_LIVE_REPEAT_CLAIM_DENIED");
  const status=await fetch(origin+"/api/health",{
    signal:AbortSignal.timeout(12000),redirect:"error",
  });
  if(status.status!==200||(await status.json())?.bootstrapStatus!=="ready")
    throw Error("Real first-admin claim did not close bootstrap state");
  markHttpStage("BOSTAN_WINDOWS_LIVE_POST_CLAIM_HEALTH_PASS");
  if(browserMode&&(!browserSignupPassed||!browserAdminPassed))
    throw Error("Windows real browser and admin qualification incomplete");
  completedHttpChecks=true;
}catch(error){
  failed=true;
  const stages=[...serverOutput.matchAll(/BOSTAN_WIN_SERVER_STAGE=(static_import_start|static_import_pending|static_import_complete|runtime_start|runtime_ready|runtime_failed)/g)];
  const stage=stages.at(-1)?.[1]||"not_observed";
  console.error("BOSTAN_WINDOWS_LIVE_IMPORT_STAGE="+stage);
  const profiles=serverOutput.split(String.fromCharCode(10)).filter(line=>line.startsWith("BOSTAN_WIN_IMPORT_PROFILE="));
  const latestProfile=profiles.at(-1)?.slice("BOSTAN_WIN_IMPORT_PROFILE=".length);
  if(latestProfile){
    try{
      const value=JSON.parse(latestProfile);
      if(value.schema==="bostan.private-module-load-profile.v1"){
        console.error("BOSTAN_WINDOWS_LIVE_MODULE_LOAD_COUNT="+Number(value.loadCount||0));
        console.error("BOSTAN_WINDOWS_LIVE_MODULE_LOAD_MS="+Number(value.loadMs||0));
        console.error("BOSTAN_WINDOWS_LIVE_MODULE_ERRORS="+Number(value.errorCount||0));
        const safe=(value.topLoads||[]).filter(item=>
          typeof item.module==="string" &&
          (item.module.startsWith("server/src/") || item.module.startsWith("packages/") ||
           ["third_party","external_file","virtual_or_builtin","other_repo_file"].includes(item.module)))
          .slice(0,5).map(item=>({module:item.module,loadMs:Number(item.loadMs||0)}));
        console.error("BOSTAN_WINDOWS_LIVE_SLOW_MODULES="+JSON.stringify(safe));
      }
    }catch{console.error("BOSTAN_WINDOWS_LIVE_MODULE_PROFILE=unparseable");}
  }
  console.error("BOSTAN_WINDOWS_LIVE_HTTP_OBSERVATION="+lastHealthStatus);
  console.error("BOSTAN_WINDOWS_LIVE_STARTUP_OUTCOME="+lastHealthOutcome);
  console.error("BOSTAN_WINDOWS_LIVE_STARTUP_PROBES="+lastHealthProbes);
  console.error("BOSTAN_WINDOWS_LIVE_SERVER_SECONDS="+
    (serverStartedAt>0?Math.round((Date.now()-serverStartedAt)/1000):"not_started"));
  const pkg=serverOutput.match(/Cannot find package ['"](@bostan\/[a-z0-9_-]+)['"]/i);
  const diagnostic=pkg?"missing_bostan_package:"+pkg[1]:
    /ERR_MODULE_NOT_FOUND|Cannot find module/.test(serverOutput)?"missing_module":
    /ERR_PACKAGE_PATH_NOT_EXPORTED/.test(serverOutput)?"package_exports":
    /MODULE_NOT_FOUND/.test(serverOutput)?"module_resolution":
    /EADDRINUSE/.test(serverOutput)?"address_in_use":
    /SyntaxError/.test(serverOutput)?"syntax_error":
    /Error/.test(serverOutput)?"server_startup_error":"no_server_diagnostic";
  console.error("BOSTAN_WINDOWS_LIVE_SERVER_DIAGNOSTIC="+diagnostic);
  // The child emits only a whitelisted repository-relative TypeScript frame.
  // Reject any unrecognized value instead of printing raw backend stderr.
  const sites=[...serverOutput.matchAll(/(?:^|\n)BOSTAN_WIN_SERVER_ERROR_SITE=(unknown|(?:server\/src|packages)\/[a-zA-Z0-9_/-]+\.(?:ts|tsx|js|mjs):[1-9][0-9]{0,5})(?:\r?\n|$)/g)];
  console.error("BOSTAN_WINDOWS_LIVE_SERVER_SOURCE_SITE="+(sites.at(-1)?.[1]||"unknown"));
  const codes=[...serverOutput.matchAll(/(?:^|\n)BOSTAN_WIN_SERVER_ERROR_CODE=(ENOENT|EACCES|EPERM|EADDRINUSE|ECONNREFUSED|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|42P01|42703|28P01|23505|unknown)(?:\r?\n|$)/g)];
  console.error("BOSTAN_WINDOWS_LIVE_SERVER_ERROR_CODE="+(codes.at(-1)?.[1]||"unknown"));
  const misses=[...serverOutput.matchAll(/(?:^|\n)BOSTAN_WIN_SERVER_MISSING_PACKAGE=(unknown|package:(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)(?:\r?\n|$)/gi)];
  console.error("BOSTAN_WINDOWS_LIVE_MISSING_PACKAGE="+(misses.at(-1)?.[1]||"unknown"));
  const locals=[...serverOutput.matchAll(/(?:^|\n)BOSTAN_WIN_SERVER_MISSING_LOCAL=(unknown|repo:(?:packages|server)\/[a-zA-Z0-9_./-]+\.(?:ts|tsx|js|mjs|json))(?:\r?\n|$)/g)];
  console.error("BOSTAN_WINDOWS_LIVE_MISSING_LOCAL="+(locals.at(-1)?.[1]||"unknown"));
  // Loader/migration errors can include operator file paths, environment
  // values or connection strings. Never echo a raw exception message.
  const errorKind=error instanceof Error &&
    ["Error","TypeError","SyntaxError","ReferenceError","RangeError"].includes(error.name)
      ?error.name:"other";
  console.error("BOSTAN_WINDOWS_LIVE_ERROR_TYPE="+errorKind);
}finally{
  if(server){
    // Node sets signalCode/exitCode before the 'close' event guarantees all
    // child stdio streams are closed. Never stop PG or reclaim owned fixture
    // until that event has been observed for THIS child.
    const childState=await serverObserver.stop();
    serverClosed=childState.closed&&!childState.spawnError;
    if(serverClosed)markHttpStage("BOSTAN_WINDOWS_LIVE_SERVER_CLOSED");
    if(childState.spawnError){
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_SERVER_SPAWN_FAILED");
    }
    childStateForceUsed=childState.forceUsed;
    if(childState.forceUsed){
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_SERVER_FORCE_TERMINATION");
    }
    if(!serverClosed){
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_SERVER_TEARDOWN_UNCERTAIN");
    }
  }
  // Never delete a fixture or claim cleanup if a live child might still be
  // using its PostgreSQL database or the DB stop itself has failed.
  if(db){
    dbCleaned=false;
    if(serverClosed){
      try{
        await db.cleanup();
        dbCleaned=true;
        markHttpStage("BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANED");
      }
      catch{failed=true;console.error("Bostan QA PostgreSQL cleanup failed");}
    }else{
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANUP_DEFERRED");
    }
  }
  // An embedded DB cleanup promise is not a process-tree proof on Windows:
  // the native postgres.exe io_worker children may outlive their parent.
  // Run only the existing read-only, repository-owned process scanner AFTER
  // database cleanup. Never terminate/inspect other processes ourselves.
  if(db&&serverClosed&&dbCleaned){
    const pgEnv={
      SystemRoot:process.env.SystemRoot||process.env.WINDIR||"",
      TEMP:home,TMP:home,USERPROFILE:home,HOME:home,
    };
    let result=null;
    try{
      // Never resolve powershell.exe through the operator-controlled PATH.
      // A missing or unexpected OS binary must fail closed without skipping
      // the final teardown receipt or deleting the owned fixture.
      const powershellBinary=resolvePrivateWindowsPowerShellBinary({systemRoot:pgEnv.SystemRoot});
      result=spawnSync(powershellBinary,[
      "-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
      "-File",join(root,"scripts","bostan-native-windows-postgres-no-orphans.ps1"),
      "-Run",
    ],{
      cwd:root,env:pgEnv,windowsHide:true,encoding:"utf8",
      timeout:20000,maxBuffer:8192,
      });
    }catch{
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_POWERSHELL_UNAVAILABLE");
    }
    const pgProof=evaluateWindowsPgOrphanCheck({
      status:result?.status,signal:result?.signal,errorCode:result?.error?.code,
      stdout:result?.stdout,stderr:result?.stderr,
    });
    postgresProcessTreeVerified=pgProof.noOrphanPostgresProcessVerified;
    if(postgresProcessTreeVerified){
      markHttpStage("BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS");
    }else{
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_POSTGRES_PROCESS_PROOF="+pgProof.outcome);
    }
  }
  const marker=join(home,"BOSTAN_QA_OWNED");
  if(serverClosed&&dbCleaned&&postgresProcessTreeVerified&&existsSync(marker)&&
     lstatSync(home).isDirectory()&&!lstatSync(home).isSymbolicLink()&&
     lstatSync(marker).isFile()&&!lstatSync(marker).isSymbolicLink()&&
     readFileSync(marker,"utf8")==="BOSTAN_PRIVATE_SYNTHETIC_ONLY"+String.fromCharCode(10)){
    try{
      rmSync(home,{recursive:true,force:true});
      ownedHomeCleaned=true;
      markHttpStage("BOSTAN_WINDOWS_LIVE_OWNED_FIXTURE_CLEANED");
    }
    catch{failed=true;console.error("Bostan QA owned fixture cleanup failed");}
  }
  const proof=evaluateWindowsPrivateHttpEvidence({
    events:httpEvents,httpComplete:completedHttpChecks,childClosed:serverClosed,
    spawnError:serverObserver?.spawnError??false,
    forceUsed:typeof childStateForceUsed==="boolean"?childStateForceUsed:false,
    postgresCleaned:dbCleaned,postgresProcessTreeVerified,
    ownedFixtureCleaned:ownedHomeCleaned,
    priorFailure:failed,
  });
  const browserQualified=browserMode&&browserSignupPassed&&browserAdminPassed&&
    proof.windowsAuthenticatedHttpQualified;
  const qualified=proof.windowsAuthenticatedHttpQualified&&(!browserMode||browserQualified);
  if(qualified){
    console.log(JSON.stringify({...spec,...proof,run:true,livePostgres:true,
      realHttpStatus:200,realSession:true,firstAdmin:true,
      authenticatedBrowserQualified:browserQualified},null,2));
  }else{
    failed=true;
    console.log(JSON.stringify({...spec,...proof,run:true,
      manualOwnedFixtureInspectionRequired:!ownedHomeCleaned},null,2));
  }
  console.log("BOSTAN_WINDOWS_LIVE_HTTP_TEST_TEARDOWN_COMPLETE");
}

// Embedded PostgreSQL registers an async exit hook; explicit nonzero exit is
// required so a failed live server can never be reported as a PASS by pnpm.
if(failed)process.exit(1);
