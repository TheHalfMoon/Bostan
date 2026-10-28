#!/usr/bin/env node
/**
 * Strictly private Windows synthetic server entry stage probe.
 * Only the Bostan QA harness may enable this module; it must not start the
 * app against operator settings, user data, other hosts or managed Cloud.
 */
import {existsSync,readFileSync,lstatSync} from "node:fs";
import {basename,isAbsolute} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const marker=process.env.BOSTAN_PRIVATE_QA_MARKER;
let database=null;
try{database=new URL(process.env.DATABASE_URL);}catch{}
const allowed =
  process.platform==="win32" &&
  process.env.BOSTAN_PRIVATE_QA_ENTRY==="B087_TEST_ONLY" &&
  /^Bostan-B0[0-9]+-qa$/i.test(basename(root.replace(/[\\/]+$/,""))) &&
  typeof marker==="string" && isAbsolute(marker) &&
  existsSync(marker) && !lstatSync(marker).isSymbolicLink() &&
  basename(marker)==="BOSTAN_QA_OWNED" &&
  readFileSync(marker,"utf8")==="BOSTAN_PRIVATE_SYNTHETIC_ONLY"+String.fromCharCode(10) &&
  database && (database.protocol==="postgres:"||database.protocol==="postgresql:") &&
  database.hostname==="127.0.0.1" &&
  Number(database.port)>1023 && Number(database.port)<=65535 &&
  process.env.PAPERCLIP_DEPLOYMENT_MODE==="authenticated" &&
  process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE==="private" &&
  !Object.keys(process.env).some(k=>/^(PAPERCLIP_CLOUD_|BOSTAN_CLOUD_|PAPERCLIP_MANAGED_CONFIG$)/i.test(k));
if(!allowed){
  console.error("Bostan Windows server stage entry refuses a missing or unsafe synthetic test fixture");
  process.exit(2);
}
const stage=name=>process.stdout.write("BOSTAN_WIN_SERVER_STAGE="+name+"\n");
async function run(){
  stage("static_import_start");
  // file:// is required by Windows Node's ESM loader; importing D:\... fails.
  const module=await import(new URL("../server/src/index.ts",import.meta.url).href);
  stage("static_import_complete");
  if(typeof module.startServer!=="function")throw Error("Bostan server entry export missing");
  stage("runtime_start");
  await module.startServer();
  stage("runtime_ready");
}
run().catch(error=>{
  // Exception messages may contain customer URLs or credentials. Do not print.
  const kind=error instanceof Error &&
    ["Error","TypeError","SyntaxError","ReferenceError","RangeError"].includes(error.name)
    ?error.name:"other";
  stage("runtime_failed");
  process.stderr.write("BOSTAN_WIN_SERVER_ERROR_TYPE="+kind+"\n");
  process.exitCode=1;
});
