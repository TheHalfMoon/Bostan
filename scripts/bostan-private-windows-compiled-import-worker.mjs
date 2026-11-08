/**
 * Fixed-token native Windows synthetic-QA module import heartbeat.
 * A dedicated Worker thread writes directly to process fd 2: unlike a Worker
 * console.log()/process.stderr message, fs.writeSync doesn't need the blocked
 * parent's event loop to forward the Worker stdio stream.
 *
 * This file has no external imports, network, task/DB access or credentials.
 */
import {writeSync} from 'node:fs';
import {isMainThread,workerData} from 'node:worker_threads';

export const IMPORT_WORKER_ALIVE='BOSTAN_WIN_SERVER_STAGE=static_import_worker_alive';
export const IMPORT_WORKER_PENDING='BOSTAN_WIN_SERVER_STAGE=static_import_worker_pending';
export const IMPORT_WORKER_TOKEN='BOSTAN_PRIVATE_IMPORT_THREAD_V1';
const CATEGORY_PREFIX='BOSTAN_WIN_IMPORT_CPU_ACTIVITY=';
export function classifyPrivateWorkerCpuWindow(cpuMicroseconds,wallMicroseconds){
  if(!Number.isFinite(cpuMicroseconds)||!Number.isFinite(wallMicroseconds)||
     cpuMicroseconds<0||wallMicroseconds<=0)
    return 'unavailable';
  const fraction=cpuMicroseconds/wallMicroseconds;
  if(fraction>=0.5)return 'high';
  if(fraction<=0.1)return 'low';
  return 'moderate';
}

export function startPrivateCompiledImportWorker({
  main=isMainThread,data=workerData,platform=process.platform,
  write=message=>writeSync(2,message+'\n'),
  schedule=setInterval,readCpu=()=>process.cpuUsage(),
  nowMicroseconds=()=>Number(process.hrtime.bigint()/1000n),
}={}){
  if(main||platform!=='win32'||data!==IMPORT_WORKER_TOKEN)return false;
  // These literals contain no paths, environment data, URLs, user payloads
  // or model-provider data. fd 2 is an inherited fixed OS stderr handle.
  write(IMPORT_WORKER_ALIVE);
  const startTime=nowMicroseconds();
  const startCpu=readCpu();
  schedule(()=>{
    write(IMPORT_WORKER_PENDING);
    let category='unavailable';
    try{
      const cpu=readCpu();
      const duration=nowMicroseconds()-startTime;
      const usage=(cpu.user-startCpu.user)+(cpu.system-startCpu.system);
      category=classifyPrivateWorkerCpuWindow(usage,duration);
    }catch{ /* Fixed non-revealing unavailable classification only. */ }
    write(CATEGORY_PREFIX+category);
  },30_000);
  return true;
}
startPrivateCompiledImportWorker();
