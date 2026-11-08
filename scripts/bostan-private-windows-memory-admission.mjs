#!/usr/bin/env node
/**
 * Bostan private native Windows QA memory admission. Read-only, fail closed.
 * This is an additional safety gate, not proof that a full app will fit in RAM.
 */
import {freemem,totalmem} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const GIB=1024**3;
export const MIN_TOTAL_MEMORY_BYTES=6*GIB;
export const MIN_FREE_MEMORY_BYTES=2*GIB;
const schema='bostan.private-windows-memory-admission.v1';
const base=Object.freeze({schema,minimumTotalGiB:6,minimumFreeGiB:2});
const validBytes=value=>Number.isSafeInteger(value)&&value>=0;

export function checkBostanWindowsMemory({
  platform=process.platform,readFree=freemem,readTotal=totalmem,
}={}){
  const refused=reason=>Object.freeze({...base,allowed:false,reason});
  if(platform!=='win32')return refused('not_windows');
  if(typeof readFree!=='function'||typeof readTotal!=='function')
    return refused('invalid_probe');
  try{
    const free=readFree(),total=readTotal();
    if(!validBytes(free)||!validBytes(total)||total===0||free>total)
      return refused('invalid_memory');
    const totalEnough=total>=MIN_TOTAL_MEMORY_BYTES;
    const freeEnough=free>=MIN_FREE_MEMORY_BYTES;
    return Object.freeze({...base,
      allowed:totalEnough&&freeEnough,
      reason:!totalEnough?'low_total_memory':!freeEnough?'low_free_memory':'pass',
      totalGiB:Math.floor(total/GIB*100)/100,
      freeGiB:Math.floor(free/GIB*100)/100,
    });
  }catch{return refused('memory_unavailable');}
}

export function assertBostanWindowsMemory(options){
  const result=checkBostanWindowsMemory(options);
  if(!result.allowed)throw Error('Private Windows Bostan QA memory admission refused: '+result.reason);
  return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length===0||args.length===1&&args[0]==='--plan'){
    console.log(JSON.stringify({...base,readOnly:true,checking:false,publishes:false}));
  }else if(args.length===1&&args[0]==='--check'){
    const result=checkBostanWindowsMemory();
    console.log(JSON.stringify(result));
    if(!result.allowed)process.exitCode=2;
  }else{
    console.error('Usage: --plan | --check (read-only, no cleanup)');
    process.exitCode=2;
  }
}
