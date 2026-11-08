/**
 * Secret-safe, resource-only Windows HTTP QA memory policy.
 * Use at every admission checkpoint: a previous pass does not survive a
 * concurrent drop in free RAM while resolving packages or migrating DB.
 */
export const WINDOWS_CHROMIUM_MIN_FREE_GIB = 4;
const refuse = reason => Object.freeze({allowed:false,reason});

export function evaluateWindowsLiveMemory(observation,{browserMode=false}={}) {
  if (typeof browserMode !== 'boolean') return refuse('invalid_mode');
  if (!observation || observation.allowed !== true) return refuse('memory_refused');
  if (typeof observation.freeGiB !== 'number' ||
      !Number.isFinite(observation.freeGiB) || observation.freeGiB < 0)
    return refuse('invalid_memory_receipt');
  if (browserMode && observation.freeGiB < WINDOWS_CHROMIUM_MIN_FREE_GIB)
    return refuse('chromium_low_free_memory');
  return Object.freeze({allowed:true,reason:'pass'});
}
