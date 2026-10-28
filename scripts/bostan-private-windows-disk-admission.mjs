#!/usr/bin/env node
/**
 * Bostan private Windows QA resource admission. No files are created/removed.
 * Fail closed if Windows system, checkout, or temporary drives have too little
 * headroom for the heavy PostgreSQL/TypeScript/localhost acceptance run.
 */
import {statfsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const GIB=1024n**3n;
export const MIN_SYSTEM_BYTES=2n*GIB;
export const MIN_WORKSPACE_BYTES=6n*GIB;
export const MIN_TEMP_BYTES=6n*GIB;
function driveRoot(value){
  if(typeof value!=="string")return null;
  const root=path.win32.parse(value).root;
  return /^[a-z]:\\$/i.test(root)?root:null;
}
function availableBytes(statfs,volume){
  const s=statfs(volume,{bigint:true});
  if(typeof s.bavail!=="bigint"||typeof s.bsize!=="bigint"||
     s.bavail<0n||s.bsize<=0n)throw Error("Unreliable Windows volume space");
  return s.bavail*s.bsize;
}
export function checkBostanWindowsDisk({
  platform=process.platform,workspace,
  systemDrive=process.env.SystemDrive,
  tempDir=process.env.TEMP,
  statfs=statfsSync,
}={}){
  if(platform!=="win32")return {schema:"bostan.private-windows-disk-admission.v1",
    allowed:false,reason:"not_windows",checks:[]};
  const system=driveRoot(systemDrive+"\\");
  const work=driveRoot(workspace);
  const temp=driveRoot(tempDir);
  if(!system||!work||!temp)return {schema:"bostan.private-windows-disk-admission.v1",
    allowed:false,reason:"invalid_volume",checks:[]};
  const volumes=new Map();
  for(const [label,volume,required] of [
    ["system",system,MIN_SYSTEM_BYTES],
    ["workspace",work,MIN_WORKSPACE_BYTES],
    ["temp",temp,MIN_TEMP_BYTES],
  ]){
    const key=volume.toUpperCase();
    if(!volumes.has(key))volumes.set(key,{labels:[],volume,minimumBytes:0n});
    const item=volumes.get(key);
    item.labels.push(label);
    if(required>item.minimumBytes)item.minimumBytes=required;
  }
  try{
    const checks=[...volumes.values()].map(item=>{
      const free=availableBytes(statfs,item.volume);
      return {purpose:item.labels.join("+"),
        freeGiB:Number(free*100n/GIB)/100,
        requiredGiB:Number(item.minimumBytes/GIB),
        sufficient:free>=item.minimumBytes};
    });
    return {schema:"bostan.private-windows-disk-admission.v1",
      allowed:checks.every(c=>c.sufficient),reason:checks.every(c=>c.sufficient)?"pass":"low_disk",
      checks};
  }catch{
    // Do not print platform paths/errors: volume inspections can carry user data.
    return {schema:"bostan.private-windows-disk-admission.v1",
      allowed:false,reason:"space_unavailable",checks:[]};
  }
}
export function assertBostanWindowsDisk(options){
  const result=checkBostanWindowsDisk(options);
  if(!result.allowed)throw Error("Private Windows Bostan QA disk admission refused: "+result.reason);
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length===0||args.length===1&&args[0]==="--plan"){
    console.log(JSON.stringify({schema:"bostan.private-windows-disk-admission.v1",
      readOnly:true,minimumSystemGiB:2,minimumWorkspaceGiB:6,minimumTempGiB:6,
      checking:false,publishes:false}));
  }else if(args.length===1&&args[0]==="--check"){
    const root=fileURLToPath(new URL("../",import.meta.url));
    const result=checkBostanWindowsDisk({workspace:root});
    console.log(JSON.stringify(result));
    if(!result.allowed)process.exitCode=2;
  }else{
    console.error("Usage: --plan | --check (read-only, no cleanup)");
    process.exitCode=2;
  }
}
