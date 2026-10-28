#!/usr/bin/env node
/** Explicit native-Windows, disposable localhost Bostan authenticated server QA. */
import {randomBytes,randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {existsSync,lstatSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {createServer} from "node:net";
import {basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {checkBostanWindowsDisk} from "./bostan-private-windows-disk-admission.mjs";
import {buildPrivateWindowsHttpQaEnvironment} from "./bostan-private-windows-qa-env.mjs";
import {parsePrivateWindowsQaWave,matchingPrivateWindowsQaWave} from "./bostan-private-windows-qa-wave.mjs";

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
if(args.length!==1||args[0]!=="--run"){
  console.error("Usage: node --import tsx scripts/bostan-private-windows-live-http.mjs [--plan|--run]");
  process.exit(2);
}
if(process.platform!=="win32"||!parsePrivateWindowsQaWave(basename(resolve(root)),"qa")){
  console.error("Native Windows live HTTP QA requires an isolated Bostan B0xx QA checkout");
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
async function availablePort(){
  const server=createServer();
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
  const port=server.address().port;
  await new Promise(ok=>server.close(ok));
  return port;
}
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
let db=null,server=null;
let failed=false;
let serverOutput="";
let lastHealthStatus="no_response";
let serverStartedAt=0;
const home=mkdtempSync(join(temp,"bostan-private-auth-http-"));
writeFileSync(join(home,"BOSTAN_QA_OWNED"),"BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
let completedHttpChecks=false;
let serverClosed=true;
let dbCleaned=true;
let ownedHomeCleaned=false;
try{
  process.env.PAPERCLIP_TEST_POSTGRES_TEMPLATE="0";
  const {startEmbeddedPostgresTestDatabase}=await import("../packages/db/src/test-embedded-postgres.js");
  db=await startEmbeddedPostgresTestDatabase("bostan-private-auth-http-db-");
  console.log("BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED");
  const port=await availablePort();
  const origin="http://127.0.0.1:"+port;
  // The app child must never inherit unrelated operator tokens, DSNs or
  // writable profile paths. Only the system loader keys are copied.
  const env=buildPrivateWindowsHttpQaEnvironment({
    inherited:process.env,home,origin,connectionString:db.connectionString,
    port,marker:join(home,"BOSTAN_QA_OWNED"),
    secret:randomBytes(32).toString("hex"),
  });
  mkdirSync(env.APPDATA,{recursive:true,mode:0o700});
  mkdirSync(env.LOCALAPPDATA,{recursive:true,mode:0o700});
  server=spawn(process.execPath,["--import","tsx","--import",
    "../scripts/bostan-private-windows-import-profiler.mjs",
    "../scripts/bostan-private-windows-server-entry.mjs"],{
    cwd:join(root,"server"),env,windowsHide:true,stdio:["ignore","pipe","pipe"],
  });
  for(const stream of [server.stdout,server.stderr])stream?.on("data",part=>{
    serverOutput=(serverOutput+String(part)).slice(-65536);
  });
  serverClosed=false;
  let healthy=false;
  serverStartedAt=Date.now();
  for(let i=0;i<180;i++){
    if(server.exitCode!==null)break;
    try{
      const r=await fetch(origin+"/api/health",{signal:AbortSignal.timeout(1500)});
      lastHealthStatus="http_"+r.status;
      if(r.status===200){
        const j=await r.json();
        if(j&&typeof j==="object"){
          lastHealthStatus="health_"+(j.status==="ok"?"ok":"non_ok")+"_"+
            (j.deploymentMode==="authenticated"?"authenticated":"other_mode")+"_"+
            (j.bootstrapStatus==="bootstrap_pending"?"pending":"other_bootstrap");
        }
        if(j.status==="ok"&&j.deploymentMode==="authenticated"&&
           j.deploymentExposure==="private"&&j.bootstrapStatus==="bootstrap_pending"&&
           !Object.hasOwn(j,"cloud")){
          healthy=true;break;
        }
      }
    }catch{}
    await sleep(1000);
  }
  if(!healthy)throw Error("Real Bostan native Windows authenticated server did not reach expected private ready state");
  console.log("BOSTAN_WINDOWS_LIVE_HTTP_AUTH_HEALTH_PASS");
  const email="bostan-b086-"+randomUUID()+"@example.invalid";
  const password="Test-only-"+randomBytes(18).toString("hex")+"!A2";
  const response=await fetch(origin+"/api/auth/sign-up/email",{
    method:"POST",headers:{"content-type":"application/json","origin":origin},
    body:JSON.stringify({email,password,name:"Bostan synthetic QA first admin"}),
    signal:AbortSignal.timeout(15000),redirect:"error",
  });
  if(response.status!==200)throw Error("Native Windows real Better Auth signup status mismatch");
  const body=await response.json();
  if(typeof body?.user?.id!=="string"||!body.user.id)throw Error("Real session user id missing");
  const cookie=response.headers.getSetCookie?.().map(x=>x.split(";")[0]).find(x=>x.includes("session_token="));
  if(!cookie)throw Error("Real Bostan Better Auth session cookie absent");
  console.log("BOSTAN_WINDOWS_LIVE_AUTH_SIGNUP_PASS");
  const claim=await fetch(origin+"/api/bootstrap/claim",{
    method:"POST",headers:{"cookie":cookie,"origin":origin,"content-type":"application/json"},
    signal:AbortSignal.timeout(15000),redirect:"error",
  });
  if(claim.status!==200)throw Error("Native Windows first-admin claim HTTP mismatch");
  const status=await fetch(origin+"/api/health",{signal:AbortSignal.timeout(5000)});
  if(status.status!==200||(await status.json())?.bootstrapStatus!=="ready")
    throw Error("Real first-admin claim did not close bootstrap state");
  console.log("BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS");
  completedHttpChecks=true;
}catch(error){
  failed=true;
  const stages=[...serverOutput.matchAll(/BOSTAN_WIN_SERVER_STAGE=(static_import_start|static_import_complete|runtime_start|runtime_ready|runtime_failed)/g)];
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
  console.error("BOSTAN_WINDOWS_LIVE_SERVER_SECONDS="+Math.round((Date.now()-serverStartedAt)/1000));
  const pkg=serverOutput.match(/Cannot find package ['"](@bostan\/[a-z0-9_-]+)['"]/i);
  const diagnostic=pkg?"missing_bostan_package:"+pkg[1]:
    /ERR_MODULE_NOT_FOUND|Cannot find module/.test(serverOutput)?"missing_module":
    /ERR_PACKAGE_PATH_NOT_EXPORTED/.test(serverOutput)?"package_exports":
    /MODULE_NOT_FOUND/.test(serverOutput)?"module_resolution":
    /EADDRINUSE/.test(serverOutput)?"address_in_use":
    /SyntaxError/.test(serverOutput)?"syntax_error":
    /Error/.test(serverOutput)?"server_startup_error":"no_server_diagnostic";
  console.error("BOSTAN_WINDOWS_LIVE_SERVER_DIAGNOSTIC="+diagnostic);
  // Loader/migration errors can include operator file paths, environment
  // values or connection strings. Never echo a raw exception message.
  const errorKind=error instanceof Error &&
    ["Error","TypeError","SyntaxError","ReferenceError","RangeError"].includes(error.name)
      ?error.name:"other";
  console.error("BOSTAN_WINDOWS_LIVE_ERROR_TYPE="+errorKind);
}finally{
  if(server){
    // signalCode, not just exitCode, is set when Node terminates a process by
    // signal. Wait for a real exit before touching a database used by the child.
    const stopped=()=>server.exitCode!==null||server.signalCode!==null;
    if(!stopped()){
      server.kill("SIGTERM");
      await Promise.race([new Promise(ok=>server.once("close",ok)),sleep(10000)]);
      if(!stopped()){
        server.kill("SIGKILL");
        await Promise.race([new Promise(ok=>server.once("close",ok)),sleep(5000)]);
      }
    }
    serverClosed=stopped();
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
      try{await db.cleanup();dbCleaned=true;}
      catch{failed=true;console.error("Bostan QA PostgreSQL cleanup failed");}
    }else{
      failed=true;
      console.error("BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANUP_DEFERRED");
    }
  }
  const marker=join(home,"BOSTAN_QA_OWNED");
  if(serverClosed&&dbCleaned&&existsSync(marker)&&
     lstatSync(home).isDirectory()&&!lstatSync(home).isSymbolicLink()&&
     lstatSync(marker).isFile()&&!lstatSync(marker).isSymbolicLink()&&
     readFileSync(marker,"utf8")==="BOSTAN_PRIVATE_SYNTHETIC_ONLY"+String.fromCharCode(10)){
    try{rmSync(home,{recursive:true,force:true});ownedHomeCleaned=true;}
    catch{failed=true;console.error("Bostan QA owned fixture cleanup failed");}
  }
  const qualified=completedHttpChecks&&!failed&&serverClosed&&dbCleaned&&ownedHomeCleaned;
  if(qualified){
    console.log(JSON.stringify({...spec,run:true,livePostgres:true,
      realHttpStatus:200,realSession:true,firstAdmin:true,
      serverClosed:true,postgresCleaned:true,ownedFixtureCleaned:true,
      windowsAuthenticatedHttpQualified:true,
      noOrphanPostgresProcessVerified:false},null,2));
  }else{
    failed=true;
    console.log(JSON.stringify({...spec,run:true,
      windowsAuthenticatedHttpQualified:false,
      serverClosed,postgresCleaned:dbCleaned,
      ownedFixtureCleaned:ownedHomeCleaned,
      manualOwnedFixtureInspectionRequired:!ownedHomeCleaned},null,2));
  }
  console.log("BOSTAN_WINDOWS_LIVE_HTTP_TEST_TEARDOWN_COMPLETE");
}

// Embedded PostgreSQL registers an async exit hook; explicit nonzero exit is
// required so a failed live server can never be reported as a PASS by pnpm.
if(failed)process.exit(1);
