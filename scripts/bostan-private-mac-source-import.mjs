#!/usr/bin/env node
/**
 * Bostan private macOS cold source-import qualification.
 * Read-only by default. --run only in a B0xx private QA checkout, with explicit
 * synthetic opt-in. No server start, database, provider keys or operator home.
 */
import {spawnSync} from "node:child_process";
import {existsSync,readFileSync,realpathSync,lstatSync,statfsSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {basename,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const spec={schema:"bostan.private-mac-source-import.v1",run:false,
  macSourceImportQualified:false,httpQualified:false,browserQualified:false,
  releaseQualified:false,syntheticOnly:true,publishes:false,paidModels:false};
const args=process.argv.slice(2);
if(!args.length||(args.length===1&&args[0]==="--plan")){
  console.log(JSON.stringify(spec));process.exit(0);
}
if(args.length!==1||args[0]!=="--run"){
  console.error("Usage: node scripts/bostan-private-mac-source-import.mjs [--plan|--run]");
  process.exit(2);
}
const nodeVersion=process.versions.node.split(".").map(Number);
const privateRoot=realpathSync(root);
let privateManifest=false;
try{
  const pkg=JSON.parse(readFileSync(join(root,"package.json"),"utf8"));
  privateManifest=pkg.name==="bostan"&&pkg.private===true;
}catch{}
const allowed=process.platform==="darwin"&&
  nodeVersion[0]>=24&&(nodeVersion[0]>24||nodeVersion[1]>=11)&&
  /^bostan-b0?[0-9]+$/i.test(basename(privateRoot))&&
  privateRoot.startsWith("/private/tmp/")&&
  privateManifest&&existsSync(join(root,".git"))&&
  process.env.BOSTAN_MAC_SOURCE_IMPORT_QA==="SYNTHETIC_ONLY";
if(!allowed){
  console.error("Bostan macOS source import QA refuses an unsafe or unowned fixture");
  process.exit(2);
}
for(const p of [
  "server/node_modules/tsx/package.json",
  "packages/shared/dist/index.js","packages/db/dist/index.js",
  "packages/plugins/sdk/dist/index.js",
  "packages/skills-catalog/dist/src/index.js",
]){
  const target=join(root,p);
  if(!existsSync(target)||lstatSync(target).isSymbolicLink()){
    console.error("Bostan macOS source import QA requires built local dependencies");
    process.exit(2);
  }
}
const disk=statfsSync(root,{bigint:true});
if(disk.bavail*disk.bsize<6n*1024n**3n){
  console.error("Bostan macOS source import QA disk headroom refused");
  process.exit(2);
}
const home=mkdtempSync("/private/tmp/bostan-mac-source-qa-");
writeFileSync(join(home,"BOSTAN_QA_OWNED"),"BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
const env={
  PATH:process.env.PATH||"/usr/bin:/bin",
  HOME:home,TMPDIR:home,PAPERCLIP_HOME:home,
  PAPERCLIP_CONFIG:join(home,"nonexistent-synthetic-config.json"),
  CI:"1",DO_NOT_TRACK:"1",NODE_ENV:"test",OTEL_SDK_DISABLED:"true",
  SERVE_UI:"false",HEARTBEAT_SCHEDULER_ENABLED:"false",
  BOSTAN_FEEDBACK_EXPORT_ENABLED:"0",PAPERCLIP_OPEN_ON_LISTEN:"false",
  BOSTAN_PRIVATE_QA_ENTRY:"B087_TEST_ONLY",BOSTAN_PRIVATE_QA_MARKER:join(home,"BOSTAN_QA_OWNED"),
  PAPERCLIP_DEPLOYMENT_MODE:"authenticated",PAPERCLIP_DEPLOYMENT_EXPOSURE:"private",
  DATABASE_URL:"postgresql://synthetic:synthetic@127.0.0.1:54321/never-connect",
};
try{
  const expression='process.argv[1]="bostan-import-only"; const t=performance.now(); await import("./src/index.ts"); console.log("BOSTAN_MAC_IMPORT_COMPLETE_MS="+Math.round(performance.now()-t)); process.exit(0)';
  const child=spawnSync(process.execPath,["--import","tsx","--import",
    "../scripts/bostan-private-windows-import-profiler.mjs",
    "--input-type=module","-e",expression],{
      cwd:join(root,"server"),env,encoding:"utf8",timeout:60000,
      maxBuffer:2*1024*1024,windowsHide:true,
    });
  const measurement=child.stdout?.match(/^BOSTAN_MAC_IMPORT_COMPLETE_MS=(\d+)\s*$/m);
  const lines=child.stderr?.split("\n").filter(x=>x.startsWith("BOSTAN_WIN_IMPORT_PROFILE="))??[];
  let profile=null;
  try{profile=JSON.parse(lines.at(-1)?.slice("BOSTAN_WIN_IMPORT_PROFILE=".length));}catch{}
  const ok=child.status===0&&!!measurement&&
    profile?.schema==="bostan.private-module-load-profile.v1"&&
    profile?.reason==="exit"&&profile.loadCount>0;
  const summary={...spec,run:true,macSourceImportQualified:ok,
    importMilliseconds:measurement?Number(measurement[1]):null,
    importedModules:profile?.loadCount??0,
    resolvedImports:profile?.resolveCount??0,
    loaderErrors:profile?.errorCount??0,
    moduleLoadMilliseconds:profile?.loadMs??0,
    runtimeEvaluationTimed:false,serverStarted:false,
    outcome:ok?"source_import_pass":child.error?.code==="ETIMEDOUT"?"timeout":"source_import_failed"};
  console.log(JSON.stringify(summary));
  if(!ok)process.exitCode=1;
}finally{
  rmSync(home,{recursive:true,force:true});
}
