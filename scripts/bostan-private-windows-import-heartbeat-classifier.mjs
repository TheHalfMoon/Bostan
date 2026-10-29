/**
 * Privacy-preserving Windows import liveness correlation.
 * Correlates exact fixed markers, not strings from raw user/model log data.
 * Never infer a CPU hang solely from the absence of a main-thread timer.
 */
export function classifyPrivateWindowsImportHeartbeat(output){
  if(typeof output!=='string'||output.length>65536)
    return Object.freeze({schema:'bostan.private-import-heartbeat.v1',
      worker:'invalid_observation',main:'invalid_observation',
      finding:'insufficient_evidence',releaseQualified:false});
  const prefix='BOSTAN_WIN_SERVER_STAGE=';
  const allowed=new Set(['static_import_start','static_import_pending',
    'static_import_worker_alive','static_import_worker_pending',
    'static_import_worker_failed']);
  const tokens=new Set(output.split(/\r?\n/).filter(line=>
    line.startsWith(prefix)&&allowed.has(line.slice(prefix.length)))
    .map(line=>line.slice(prefix.length)));
  const main=tokens.has('static_import_pending')?'timer_observed':
    tokens.has('static_import_start')?'start_only':'not_observed';
  const worker=tokens.has('static_import_worker_failed')?'failed':
    tokens.has('static_import_worker_pending')?'timer_observed':
    tokens.has('static_import_worker_alive')?'started_only':'not_observed';
  const finding=worker==='failed'?'worker_failed':
    worker==='timer_observed'&&main==='start_only'?
      'worker_timer_seen_main_timer_not_seen':
    worker==='timer_observed'&&main==='timer_observed'?
      'both_timers_seen':
    worker==='started_only'&&main==='start_only'?
      'worker_started_main_timer_not_seen':
    'insufficient_evidence';
  return Object.freeze({schema:'bostan.private-import-heartbeat.v1',
    worker,main,finding,releaseQualified:false});
}
