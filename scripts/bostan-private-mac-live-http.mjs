#!/usr/bin/env node
/**
 * Bostan B0-93 private macOS native PostgreSQL + authenticated localhost HTTP.
 * An opt-in qualification test, not an application launcher or release action.
 */
import {spawnSync} from "node:child_process";
import {randomBytes, randomUUID} from "node:crypto";
import {existsSync, readFileSync, lstatSync, realpathSync, statfsSync, mkdtempSync, writeFileSync, rmSync, openSync, closeSync, statSync} from "node:fs";
import {createServer} from "node:net";
import {basename, join} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const ownedText="BOSTAN_PRIVATE_SYNTHETIC_ONLY\n";
const spec={schema:"bostan.private-mac-real-http.v1",run:false,
  macAuthenticatedHttpQualified:false,releaseQualified:false,
  windowsQualified:false,browserQualified:false,agentQualified:false,
  localhostOnly:true,syntheticOnly:true,publishes:false,paidModels:false};

function isPrivateQARepo(){
  if(process.platform!=="darwin")return false;
  const [major,minor]=process.versions.node.split(".").map(Number);
  if(major<24||(major===24&&minor<11))return false;
  try{
    const real=realpathSync(root);
    const pkg=JSON.parse(readFileSync(join(real,"package.json"),"utf8"));
    return real.startsWith("/private/tmp/") &&
      /^bostan-b0[0-9]+$/i.test(basename(real)) &&
      pkg.name==="bostan" && pkg.private===true &&
      existsSync(join(real,".git"));
  }catch{return false;}
}
function diskSafe(){
  try{const s=statfsSync(root,{bigint:true});
    return s.bavail*s.bsize>=10n*1024n**3n;
  }catch{return false;}
}
function childMarkerValid(){
  const marker=process.env.BOSTAN_MAC_HTTP_QA_MARKER||"";
  try{
    return marker.startsWith("/private/tmp/bostan-b093-mac-http-") &&
      basename(marker)==="BOSTAN_QA_OWNED" && existsSync(marker) &&
      lstatSync(marker).isFile() && !lstatSync(marker).isSymbolicLink() &&
      readFileSync(marker,"utf8")===ownedText;
  }catch{return false;}
}

const args=process.argv.slice(2);
if(args.length===0||(args.length===1&&args[0]==="--plan")){
  console.log(JSON.stringify(spec));
}else if(args.length===1&&args[0]==="--run"){
  if(!isPrivateQARepo()||!diskSafe()||
     process.env.BOSTAN_MAC_HTTP_QA!=="SYNTHETIC_ONLY"){
    console.error("Bostan private macOS HTTP QA refuses unsafe or unowned fixture");
    process.exitCode=2;
  }else if(!existsSync(join(root,"server/node_modules/tsx/package.json"))||
           !existsSync(join(root,"packages/db/dist/index.js"))||
           !existsSync(join(root,"packages/shared/dist/index.js"))){
    console.error("Bostan macOS HTTP QA requires built local dependencies");
    process.exitCode=2;
  }else{
    const home=mkdtempSync("/private/tmp/bostan-b093-mac-http-");
    const marker=join(home,"BOSTAN_QA_OWNED");
    writeFileSync(marker,ownedText,{mode:0o600});
    // Explicit allowlist: no inherited operator tokens, provider keys or DSNs.
    const env={
      PATH:process.env.PATH||"/usr/bin:/bin",
      HOME:home,TMPDIR:home,XDG_CONFIG_HOME:home,PAPERCLIP_HOME:home,
      PAPERCLIP_CONFIG:join(home,"never-created-config.json"),
      PAPERCLIP_TEST_POSTGRES_TEMPLATE:"0",
      PAPERCLIP_MIGRATION_PROMPT:"never",PAPERCLIP_MIGRATION_AUTO_APPLY:"true",
      PAPERCLIP_DEPLOYMENT_MODE:"authenticated",
      PAPERCLIP_DEPLOYMENT_EXPOSURE:"private",
      PAPERCLIP_AUTH_BASE_URL_MODE:"explicit",
      PAPERCLIP_AUTH_DISABLE_SIGN_UP:"false",
      PAPERCLIP_AUTH_RATE_LIMIT_ENABLED:"false",
      SERVE_UI:"false",HEARTBEAT_SCHEDULER_ENABLED:"false",
      PAPERCLIP_OPEN_ON_LISTEN:"false",BOSTAN_FEEDBACK_EXPORT_ENABLED:"0",
      OTEL_SDK_DISABLED:"true",DO_NOT_TRACK:"1",CI:"1",
      BETTER_AUTH_SECRET:randomBytes(32).toString("hex"),
      BOSTAN_MAC_HTTP_QA_MARKER:marker,
      BOSTAN_MAC_HTTP_QA_CHILD:"SYNTHETIC_ONLY",
    };
    // File-backed stdio prevents loader subprocesses retaining the stdout pipe.
    const logPath=join(home,"BOSTAN_QA_CHILD_LOG");
    const fd=openSync(logPath,"w",0o600);
    const t=Date.now();
    let result;
    try{
      result=spawnSync(process.execPath,[
        "--import","tsx",fileURLToPath(import.meta.url),"--child"],{
        cwd:join(root,"server"),env,timeout:110000,
        stdio:["ignore",fd,fd],
      });
    }finally{closeSync(fd);}
    const withinBudget=statSync(logPath).size<=2*1024*1024;
    const output=withinBudget?readFileSync(logPath,"utf8"):"";
    const check=[
      "BOSTAN_MAC_HTTP_POSTGRES_MIGRATED",
      "BOSTAN_MAC_HTTP_PRIVATE_HEALTH_PASS",
      "BOSTAN_MAC_HTTP_SYNTHETIC_SIGNUP_PASS",
      "BOSTAN_MAC_HTTP_FIRST_ADMIN_CLAIM_PASS",
      "BOSTAN_MAC_HTTP_POST_CLAIM_HEALTH_PASS",
      "BOSTAN_MAC_HTTP_SERVER_SHUTDOWN_PASS",
      "BOSTAN_MAC_HTTP_POSTGRES_CLEANUP_PASS",
    ];
    const flags=check.map(x=>output.includes(x+"\n"));
    const qualified=result.status===0&&!result.error&&!result.signal&&
      withinBudget&&flags.every(Boolean);
    // Do not delete a data directory unless the test database was confirmed
    // stopped. An uncertain fixture must be inspected, not silently removed.
    if(flags[6])rmSync(home,{recursive:true,force:true});
    console.log(JSON.stringify({...spec,run:true,
      macAuthenticatedHttpQualified:qualified,
      postgresMigrated:flags[0],privateHealth:flags[1],
      syntheticSignup:flags[2],firstAdminClaim:flags[3],
      postClaimHealthy:flags[4],serverShutdown:flags[5],
      postgresCleanup:flags[6],elapsedSeconds:Math.round((Date.now()-t)/1000),
      timeout:result.error?.code==="ETIMEDOUT",
      outcome:qualified?"pass":"failed_or_incomplete"}));
    if(!qualified)process.exitCode=1;
  }
}else if(args.length===1&&args[0]==="--child"){
  if(!isPrivateQARepo()||!childMarkerValid()||
     process.env.BOSTAN_MAC_HTTP_QA_CHILD!=="SYNTHETIC_ONLY"||
     process.env.PAPERCLIP_DEPLOYMENT_MODE!=="authenticated"||
     process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE!=="private"){
    console.error("Bostan macOS HTTP child refuses unsafe synthetic invocation");
    process.exitCode=2;
  }else{
    let db=null,server=null;
    try{
      const {startEmbeddedPostgresTestDatabase}=
        await import("../packages/db/src/test-embedded-postgres.ts");
      db=await startEmbeddedPostgresTestDatabase("bostan-b093-mac-http-db-");
      const url=new URL(db.connectionString);
      if(!["127.0.0.1","localhost"].includes(url.hostname))
        throw Error("Non-loopback synthetic DB");
      console.log("BOSTAN_MAC_HTTP_POSTGRES_MIGRATED");
      const port=await new Promise((ok,fail)=>{
        const socket=createServer();
        socket.once("error",fail);
        socket.listen(0,"127.0.0.1",()=>{
          const p=socket.address().port;
          socket.close(error=>error?fail(error):ok(p));
        });
      });
      const origin="http://127.0.0.1:"+port;
      Object.assign(process.env,{
        DATABASE_URL:db.connectionString,HOST:"127.0.0.1",PORT:String(port),
        PAPERCLIP_AUTH_PUBLIC_BASE_URL:origin,
      });
      const {startServer}=await import("../server/src/index.ts");
      server=await startServer();
      const response=await fetch(origin+"/api/health",{
        signal:AbortSignal.timeout(12000)});
      const health=await response.json();
      if(response.status!==200||health?.status!=="ok"||
         health?.deploymentMode!=="authenticated"||
         health?.deploymentExposure!=="private"||
         health?.bootstrapStatus!=="bootstrap_pending"||
         Object.hasOwn(health,"cloud"))
        throw Error("Unexpected private health");
      console.log("BOSTAN_MAC_HTTP_PRIVATE_HEALTH_PASS");
      const email="bostan-b093-"+randomUUID()+"@example.invalid";
      const password="Qa-Only-"+randomBytes(18).toString("hex")+"A!2";
      const signup=await fetch(origin+"/api/auth/sign-up/email",{
        method:"POST",
        headers:{"content-type":"application/json",origin},
        body:JSON.stringify({email,password,name:"Synthetic Bostan QA"}),
        signal:AbortSignal.timeout(14000),redirect:"error",
      });
      const payload=await signup.json().catch(()=>null);
      if(signup.status!==200||typeof payload?.user?.id!=="string")
        throw Error("Synthetic sign-up failed");
      const cookie=signup.headers.getSetCookie?.().map(v=>v.split(";")[0])
        .find(v=>v.includes("session_token="));
      if(!cookie)throw Error("Synthetic session missing");
      console.log("BOSTAN_MAC_HTTP_SYNTHETIC_SIGNUP_PASS");
      const claim=await fetch(origin+"/api/bootstrap/claim",{
        method:"POST",
        headers:{cookie,origin,"content-type":"application/json"},
        signal:AbortSignal.timeout(12000),redirect:"error",
      });
      if(claim.status!==200)throw Error("First-admin claim failed");
      console.log("BOSTAN_MAC_HTTP_FIRST_ADMIN_CLAIM_PASS");
      const ready=await fetch(origin+"/api/health",{
        signal:AbortSignal.timeout(12000)});
      const readyBody=await ready.json();
      if(ready.status!==200||readyBody?.bootstrapStatus!=="ready")
        throw Error("Bootstrap state not ready after claim");
      console.log("BOSTAN_MAC_HTTP_POST_CLAIM_HEALTH_PASS");
    }catch(error){
      // Error messages and stacks may contain a connection string: never print.
      console.log("BOSTAN_MAC_HTTP_FAILED_TYPE="+(
        error instanceof Error&&/^[A-Za-z]+Error$/.test(error.name)
        ?error.name:"other"));
      process.exitCode=1;
    }finally{
      if(server)try{
        await server.shutdown("SIGTERM");
        console.log("BOSTAN_MAC_HTTP_SERVER_SHUTDOWN_PASS");
      }catch{process.exitCode=1;}
      if(db)try{
        await db.cleanup();
        console.log("BOSTAN_MAC_HTTP_POSTGRES_CLEANUP_PASS");
      }catch{process.exitCode=1;}
    }
    // Some optional libraries keep unrelated timer handles alive. The owned
    // app and database have already been shut down, so child exit is explicit.
    process.exit(process.exitCode||0);
  }
}else{
  console.error("Usage: node scripts/bostan-private-mac-live-http.mjs [--plan|--run]");
  process.exitCode=2;
}
