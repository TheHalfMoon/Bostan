#!/usr/bin/env node
/**
 * Bostan B1-46: real native Windows PostgreSQL lifecycle, no app server.
 * Explicit opt-in, zero cloud, matching owned QA TEMP, fail closed.
 * Only the existing embedded PG fixture is started; only its own cleanup
 * is permitted. Never kill other processes or remove ambiguous directories.
 */
import {spawnSync} from "node:child_process";
import {existsSync,lstatSync,readFileSync} from "node:fs";
import {basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {checkBostanWindowsDisk} from "./bostan-private-windows-disk-admission.mjs";
import {checkBostanWindowsMemory} from "./bostan-private-windows-memory-admission.mjs";
import {matchingPrivateWindowsQaWave} from "./bostan-private-windows-qa-wave.mjs";
import {resolvePrivateWindowsPowerShellBinary} from "./bostan-private-windows-powershell-binary.mjs";
import {evaluateWindowsPgOrphanCheck} from "./bostan-private-windows-pg-orphan-proof.mjs";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const spec={schema:"bostan.private-windows-real-postgres-teardown.v1",
  realPostgres:true,realBostanHttp:false,private:true,publishing:false,
  modelCalls:false,releaseQualified:false};
if(process.argv.length===2||(process.argv.length===3&&process.argv[2]==="--plan")){
  console.log(JSON.stringify({...spec,run:false}));}
else if(process.argv.length===3&&process.argv[2]==="--run"){
  try{await run();}catch{
    console.error("BOSTAN_WIN_OWNED_PG_TEARDOWN_FAIL_CLOSED");process.exitCode=1;
  }
}else{console.error("Usage: [--plan|--run]");process.exitCode=2;}

function readOnlyPgProof(temp){
  const powerShell=resolvePrivateWindowsPowerShellBinary({systemRoot:process.env.SystemRoot});
  const checked=spawnSync(powerShell,[
    "-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
    "-File",join(root,"scripts","bostan-native-windows-postgres-no-orphans.ps1"),"-Run",
  ],{cwd:root,env:{SystemRoot:process.env.SystemRoot,
      TEMP:temp,TMP:temp,USERPROFILE:temp,HOME:temp},
    windowsHide:true,encoding:"utf8",timeout:20000,maxBuffer:8192});
  return evaluateWindowsPgOrphanCheck({status:checked.status,signal:checked.signal,
    errorCode:checked.error?.code,stdout:checked.stdout,stderr:checked.stderr});
}

async function run(){
  const temp=process.env.TEMP||"";
  if(process.platform!=="win32"||
    !matchingPrivateWindowsQaWave(basename(root),basename(temp)) ||
    !existsSync(temp) || lstatSync(temp).isSymbolicLink() ||
    !lstatSync(temp).isDirectory()) throw Error("Unsafe QA workspace/TEMP");
  const outerMarker=join(temp,"BOSTAN_QA_OWNED");
  if(!existsSync(outerMarker)||lstatSync(outerMarker).isSymbolicLink()||
    !lstatSync(outerMarker).isFile()||
    readFileSync(outerMarker,"utf8").trim()!=="BOSTAN_TEST_ONLY")
    throw Error("Missing exact QA-owned outer marker");
  const identity=JSON.parse(readFileSync(join(root,"package.json"),"utf8"));
  if(identity.name!=="bostan"||identity.private!==true)throw Error("Unexpected repository");
  if(Object.keys(process.env).some(key=>
    /^(?:PAPERCLIP_CLOUD_|BOSTAN_CLOUD_|PAPERCLIP_MANAGED_CONFIG$|PAPERCLIP_PRIMARY_HOST$)/i.test(key)))
    throw Error("Cloud setting not permitted");
  if(!checkBostanWindowsDisk({workspace:root,tempDir:temp}).allowed ||
     !checkBostanWindowsMemory().allowed)throw Error("Insufficient resources");
  // Required before starting any owned PostgreSQL. Do not stop foreign PG.
  const before=readOnlyPgProof(temp);
  if(!before.noOrphanPostgresProcessVerified)
    throw Error("Cannot prove zero pre-existing PostgreSQL processes");
  console.log("BOSTAN_WIN_PG_PREEXISTING_ZERO_VERIFIED");
  process.env.PAPERCLIP_TEST_POSTGRES_TEMPLATE="0";
  let db=null,cleanupPassed=false,after=null,realDB=false;
  try{
    const {startEmbeddedPostgresTestDatabase}=await import("../packages/db/src/test-embedded-postgres.js");
    db=await startEmbeddedPostgresTestDatabase("bostan-b146-owned-postgres-");
    realDB=true;
    // The helper has performed real PostgreSQL initdb, an authenticated
    // database connection, creation and migrations, before it resolves.
    console.log("BOSTAN_WIN_PG_REAL_MIGRATION_PASS");
  }finally{
    if(db) {
      try { await db.cleanup();cleanupPassed=true; }
      catch {console.error("BOSTAN_WIN_PG_CLEANUP_UNCERTAIN");}
    }
    // This scanner is read-only and cannot terminate or reclaim any process.
    after=readOnlyPgProof(temp);
    console.log("BOSTAN_WIN_PG_CLEANUP_METHOD_PASS="+cleanupPassed);
    console.log("BOSTAN_WIN_PG_NO_ORPHANS="+after.noOrphanPostgresProcessVerified);
  }
  if(!realDB || !cleanupPassed || !after.noOrphanPostgresProcessVerified)
    throw Error("Real PostgreSQL teardown not proven");
  console.log("BOSTAN_WINDOWS_REAL_POSTGRES_SINGLE_SUITE_TEARDOWN_QUALIFIED");
  console.log(JSON.stringify({...spec,run:true,postgresMigrationsPassed:true,
    ownedCleanup:true,noOrphanPostgresProcessVerified:true,
    fullWindowsHttpQualified:false}));
}
