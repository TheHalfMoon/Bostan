/**
 * Safe, bounded startup evidence for the private Windows compiled runtime.
 * This preloader runs only after the existing synthetic-QA admission guard.
 * It never prints an environment value, module path, URL, user or credential.
 */
import {Worker} from 'node:worker_threads';
import {IMPORT_WORKER_TOKEN} from './bostan-private-windows-compiled-import-worker.mjs';

export const COMPILED_IMPORT_START = "BOSTAN_WIN_SERVER_STAGE=static_import_start";
export const COMPILED_IMPORT_PENDING = "BOSTAN_WIN_SERVER_STAGE=static_import_pending";

export function startCompiledStartupProbe({
  platform = process.platform,
  environment = process.env,
  emit = message => console.error(message),
  schedule = setInterval,
  spawnWorker = () => new Worker(
    new URL('./bostan-private-windows-compiled-import-worker.mjs',import.meta.url),
    {execArgv:[],env:{},workerData:IMPORT_WORKER_TOKEN}),
} = {}) {
  if (platform !== "win32" || environment?.BOSTAN_PRIVATE_QA_ENTRY !== "B087_TEST_ONLY") {
    return false;
  }
  emit(COMPILED_IMPORT_START);
  const interval = schedule(() => emit(COMPILED_IMPORT_PENDING), 30000);
  interval.unref();
  // A regular event-loop interval can't execute during a synchronous ESM
  // module-evaluation stall. A fixed-token Worker writes to OS stderr without
  // routing through the stalled main thread. It may never keep a child alive.
  try {
    const worker=spawnWorker();
    if(!worker||typeof worker.unref!=='function')throw Error('Invalid QA worker');
    // Error observers must not emit untrusted filenames or error messages.
    if(typeof worker.on==='function')
      worker.on('error',()=>emit('BOSTAN_WIN_SERVER_STAGE=static_import_worker_failed'));
    worker.unref();
  } catch {
    emit('BOSTAN_WIN_SERVER_STAGE=static_import_worker_failed');
  }
  return true;
}

startCompiledStartupProbe();
