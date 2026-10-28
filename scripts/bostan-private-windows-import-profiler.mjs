#!/usr/bin/env node
/** Bostan B0-90: private-only native module hook profiling, no network or model. */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {registerHooks} from "node:module";
import {performance} from "node:perf_hooks";

const repoRoot=path.resolve(fileURLToPath(new URL("../",import.meta.url)));
export function safeModuleName(url,root=repoRoot){
  if(!url?.startsWith("file:"))return "virtual_or_builtin";
  let location;
  try{location=fileURLToPath(url);}catch{return "virtual_or_builtin";}
  const rel=path.relative(root,location);
  if(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel))return "external_file";
  const unix=rel.replaceAll(path.sep,"/");
  if(unix.includes("/node_modules/")||unix.startsWith("node_modules/"))return "third_party";
  if(!/^(server\/src|packages)\/[a-zA-Z0-9/_ .-]+\.(?:ts|tsx|js|mjs|cjs)$/.test(unix))
    return "other_repo_file";
  return unix.slice(0,170);
}
export function makeModuleProfiler({register,now=()=>performance.now(),
  emit=()=>{},root=repoRoot,every=64}){
  const counters={resolve:0,load:0,errors:0};
  const totals={resolveMs:0,loadMs:0};
  const top=[];
  let maximum=0;
  function record(kind,name,duration){
    const ms=Math.max(0,Math.round(duration*1000)/1000);
    counters[kind]++;
    totals[kind+"Ms"]+=ms;
    if(kind==="load"&&ms>0){
      top.push({module:safeModuleName(name,root),loadMs:ms});
      top.sort((a,b)=>b.loadMs-a.loadMs);
      if(top.length>8)top.length=8;
    }
    if(counters.load&&counters.load%every===0&&counters.load!==maximum){
      maximum=counters.load;
      emit(snapshot("periodic"));
    }
  }
  const snapshot=reason=>({
    schema:"bostan.private-module-load-profile.v1",
    reason,resolveCount:counters.resolve,loadCount:counters.load,
    errorCount:counters.errors,
    resolveMs:Math.round(totals.resolveMs),
    loadMs:Math.round(totals.loadMs),
    topLoads:top.slice(0,5),
    runtimeEvaluationTimed:false,
    moduleLoadOnly:true,
  });
  register({
    resolve(specifier,context,nextResolve){
      const start=now();
      try{
        const answer=nextResolve(specifier,context);
        record("resolve",answer?.url,now()-start);
        return answer;
      }catch(error){
        counters.errors++;
        record("resolve","",now()-start);
        throw error;
      }
    },
    load(url,context,nextLoad){
      const start=now();
      try{
        const answer=nextLoad(url,context);
        record("load",url,now()-start);
        return answer;
      }catch(error){
        counters.errors++;
        record("load",url,now()-start);
        throw error;
      }
    },
  });
  return {snapshot,emitFinal:()=>emit(snapshot("exit"))};
}
function allowed(){
  const marker=process.env.BOSTAN_PRIVATE_QA_MARKER;
  if(process.env.BOSTAN_PRIVATE_QA_ENTRY!=="B087_TEST_ONLY"||
     !marker||!path.isAbsolute(marker))return false;
  let stat;
  try{stat=fs.lstatSync(marker);}catch{return false;}
  if(!stat.isFile()||stat.isSymbolicLink()||path.basename(marker)!=="BOSTAN_QA_OWNED")
    return false;
  if(fs.readFileSync(marker,"utf8")!=="BOSTAN_PRIVATE_SYNTHETIC_ONLY\n")return false;
  if(process.env.PAPERCLIP_DEPLOYMENT_MODE!=="authenticated"||
     process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE!=="private")return false;
  let db;
  try{db=new URL(process.env.DATABASE_URL);}catch{return false;}
  return ["postgres:","postgresql:"].includes(db.protocol) &&
    db.hostname==="127.0.0.1"&&Number(db.port)>1023&&Number(db.port)<=65535;
}
if(allowed()){
  const emit=value=>process.stderr.write("BOSTAN_WIN_IMPORT_PROFILE="+JSON.stringify(value)+"\n");
  const profiler=makeModuleProfiler({register:registerHooks,emit});
  process.on("exit",()=>profiler.emitFinal());
}
