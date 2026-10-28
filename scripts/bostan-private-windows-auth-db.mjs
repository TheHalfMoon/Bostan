#!/usr/bin/env node
/** Windows-only, explicit private Bostan auth + real DB smoke. No release. */
import {readFileSync, existsSync, lstatSync, realpathSync, statfsSync} from "node:fs";
import {basename, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {checkBostanWindowsDisk} from "./bostan-private-windows-disk-admission.mjs";
import {parsePrivateWindowsQaWave,matchingPrivateWindowsQaWave} from "./bostan-private-windows-qa-wave.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const plan={
  schema:"bostan.private-windows-auth-db.v1",
  releaseQualified:false,explicitOptIn:true,privateOnly:true,
  backendProductionServerQualified:false,authBrowserQualified:false,
  checks:["plugin-sdk build","authenticated HTTP route tests","native PostgreSQL migration tests","no orphan PostgreSQL processes"],
  paidProvidersUsed:false,publishes:false,
};
const args=process.argv.slice(2);
if(args.length===0||(args.length===1&&args[0]==="--plan")){
  console.log(JSON.stringify({...plan,run:false},null,2));
  process.exit(0);
}
if(args.length!==1||args[0]!=="--run"){
  console.error("Usage: node scripts/bostan-private-windows-auth-db.mjs [--plan|--run]");
  process.exit(2);
}
if(process.platform!=="win32"){
  console.error("Native Windows auth/DB qualification refuses non-Windows hosts");
  process.exit(2);
}
const version=process.versions.node.split(".").map(Number);
if(version[0]<24||(version[0]===24&&version[1]<11)){
  console.error("Bostan Windows auth/DB QA requires Node >=24.11.0");
  process.exit(2);
}
const pkg=JSON.parse(readFileSync(join(root,"package.json"),"utf8"));
if(pkg.name!=="bostan"||pkg.private!==true){
  console.error("Bostan Windows auth/DB QA refuses foreign manifests");
  process.exit(2);
}
const qa=realpathSync(root);
if(!parsePrivateWindowsQaWave(basename(qa),"qa")||!existsSync(join(root,".git"))){
  console.error("Bostan Windows auth/DB QA requires an isolated owned three-digit Bostan QA checkout");
  process.exit(2);
}
const tmp=process.env.TEMP||"";
if(!matchingPrivateWindowsQaWave(basename(qa),basename(tmp))||!existsSync(tmp)||
   lstatSync(tmp).isSymbolicLink()||realpathSync(tmp)===qa){
  console.error("Bostan Windows auth/DB QA requires isolated owned temporary directory");
  process.exit(2);
}
const forbidden=Object.keys(process.env).filter(k=>k.toUpperCase()==="PAPERCLIP_MANAGED_CONFIG"||
  k.toUpperCase()==="PAPERCLIP_PRIMARY_HOST"||
  /^PAPERCLIP_CLOUD_|^BOSTAN_CLOUD_/i.test(k));
if(forbidden.length){
  console.error("Bostan Windows auth/DB QA refuses managed Cloud keys: "+forbidden.sort().join(","));
  process.exit(2);
}
const admission=checkBostanWindowsDisk({workspace:root,tempDir:tmp});
if(!admission.allowed){
  console.error("BOSTAN_WINDOWS_AUTH_DB_STORAGE_REFUSED="+admission.reason);
  console.error(JSON.stringify(admission));
  process.exit(2);
}
const stat=statfsSync(root,{bigint:true});
if(stat.bavail*stat.bsize<1024n*1024n*1024n){
  console.error("Bostan Windows auth/DB QA requires >=1 GiB free on checkout volume");
  process.exit(2);
}
for(const p of ["server/node_modules/vitest/package.json",
               "packages/db/node_modules/embedded-postgres/package.json",
               "packages/plugins/sdk/node_modules/typescript/package.json"]){
  if(!existsSync(join(root,p))){
    console.error("Bostan Windows auth/DB QA is missing a frozen installed dependency");
    process.exit(2);
  }
}
const env={...process.env,CI:"1",DO_NOT_TRACK:"1",OTEL_SDK_DISABLED:"true",
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:"1",npm_config_offline:"true",TMP:tmp,TEMP:tmp};
for(const k of Object.keys(env)){
  if(/^(OPENAI|ANTHROPIC|OPENROUTER|GEMINI|GOOGLE|XAI|SENTRY|OTEL_EXPORTER|AWS_|AZURE_|NODE_OPTIONS)/i.test(k))delete env[k];
}
function run(file,args,name,timeout=240000){
  console.log("BOSTAN_WIN_AUTH_DB_STEP="+name);
  const result=spawnSync(file,args,{cwd:root,env,stdio:"inherit",windowsHide:true,timeout});
  if(result.error||result.status!==0){
    console.error("Bostan Windows auth/DB step failed: "+name);
    process.exit(1);
  }
}
const cmd=process.env.ComSpec||"cmd.exe";
const ps="powershell.exe";
const orphan=join(root,"scripts","bostan-native-windows-postgres-no-orphans.ps1");
const noOrphan=()=>run(ps,["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",orphan,"-Run"],"read-only orphan gate",20000);
noOrphan();
run(cmd,["/d","/c","pnpm.cmd","--filter","@bostan/plugin-sdk","build"],"pinned plugin SDK and legal assets");
console.log("BOSTAN_WIN_AUTH_DB_PLUGIN_SDK_PASS");
run(cmd,["/d","/c","pnpm.cmd","--filter","@bostan/server","exec","vitest","run",
  "src/__tests__/auth-routes.test.ts","src/__tests__/bootstrap-claim-routes.test.ts","--reporter=dot"],
  "HTTP authentication and first-admin route tests",240000);
console.log("BOSTAN_WIN_AUTH_DB_HTTP_TESTS_PASS");
run(cmd,["/d","/c","pnpm.cmd","--filter","@bostan/db","exec","vitest","run",
  "src/client.test.ts","-t","names its backends|recreates an existing database|migrates fresh through the normal loader","--reporter=dot"],
  "real embedded PostgreSQL migration/reset",240000);
console.log("BOSTAN_WIN_AUTH_DB_REAL_POSTGRES_PASS");
noOrphan();
console.log("BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS");
console.log(JSON.stringify({...plan,run:true,nativeWindows:true,externalProviderCalls:0},null,2));
