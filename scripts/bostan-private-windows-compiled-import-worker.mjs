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

export function startPrivateCompiledImportWorker({
  main=isMainThread,data=workerData,platform=process.platform,
  write=message=>writeSync(2,message+'\n'),
  schedule=setInterval,
}={}){
  if(main||platform!=='win32'||data!==IMPORT_WORKER_TOKEN)return false;
  // These literals contain no paths, environment data, URLs, user payloads
  // or model-provider data. fd 2 is an inherited fixed OS stderr handle.
  write(IMPORT_WORKER_ALIVE);
  schedule(()=>write(IMPORT_WORKER_PENDING),30_000);
  return true;
}
startPrivateCompiledImportWorker();
