/**
 * Fail-closed finalization for an explicitly disposable local PostgreSQL QA
 * cluster. A timed-out or failed pg_ctl start is NOT proof the daemon is absent.
 * No process termination is attempted without a confirmed owned start.
 * The caller verifies exact scratch ownership before any removal.
 */
const outcome=(removed,reason)=>Object.freeze({removed,reason});

export function finalizeOwnedLocalPostgres({
  startAttempted,startConfirmed,stop,owned,remove,
}={}) {
  if(typeof startAttempted!=='boolean'||typeof startConfirmed!=='boolean'||
     (startConfirmed&&!startAttempted)||typeof stop!=='function'||
     typeof owned!=='function'||typeof remove!=='function')
    return outcome(false,'invalid_state');
  if(startAttempted&&!startConfirmed)
    return outcome(false,'start_unconfirmed');
  if(startConfirmed){
    try{if(stop()!==true)return outcome(false,'stop_unconfirmed');}
    catch{return outcome(false,'stop_unconfirmed');}
  }
  try{if(owned()!==true)return outcome(false,'ownership_unconfirmed');}
  catch{return outcome(false,'ownership_unconfirmed');}
  try{if(remove()!==true)return outcome(false,'removal_unconfirmed');}
  catch{return outcome(false,'removal_unconfirmed');}
  return outcome(true,'verified');
}
