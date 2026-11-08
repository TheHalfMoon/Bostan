/** Fail-closed cleanup of an explicitly owned disposable PostgreSQL QA cluster. */
const outcome=(removed,reason)=>Object.freeze({removed,reason});
export function finalizeOwnedLocalPostgres({startAttempted,startConfirmed,stop,owned,remove}={}) {
  if(typeof startAttempted!=='boolean'||typeof startConfirmed!=='boolean'||
     (startConfirmed&&!startAttempted)||typeof stop!=='function'||
     typeof owned!=='function'||typeof remove!=='function')
    return outcome(false,'invalid_state');
  if(startAttempted&&!startConfirmed)
    return outcome(false,'start_unconfirmed');
  // Verify the marker and canonical scratch BEFORE any pg_ctl stop operation.
  // A swapped cluster path must never be passed to pg_ctl, even for teardown.
  try{if(owned()!==true)return outcome(false,'ownership_unconfirmed');}
  catch{return outcome(false,'ownership_unconfirmed');}
  if(startConfirmed){
    try{if(stop()!==true)return outcome(false,'stop_unconfirmed');}
    catch{return outcome(false,'stop_unconfirmed');}
    // Revalidate after stop: ownership may have changed during shutdown.
    try{if(owned()!==true)return outcome(false,'ownership_unconfirmed');}
    catch{return outcome(false,'ownership_unconfirmed');}
  }
  try{if(remove()!==true)return outcome(false,'removal_unconfirmed');}
  catch{return outcome(false,'removal_unconfirmed');}
  return outcome(true,'verified');
}
