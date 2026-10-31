/**
 * PRIVATE QA only: bounded wait for the owned packed child.
 * A Promise.race with an uncancelled 36s timeout keeps the parent Node
 * process alive after an early child exit and misstates diagnostic duration.
 * This helper cancels the deadline on close and detaches the close listener
 * on deadline. The deadline remains fail-closed and never exceeds 36s.
 */
export function waitForPrivateWindowsImportProbeChild(child,{
  deadlineMs=36000,alreadyClosed=false,schedule=setTimeout,cancel=clearTimeout,
}={}){
  if(!child||typeof child.once!=='function'||typeof child.removeListener!=='function'||
     !Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>36000||
     typeof alreadyClosed!=='boolean'||
     typeof schedule!=='function'||typeof cancel!=='function')
    throw Error('Private Windows import probe deadline refused invalid configuration');
  // The owned lifecycle observer may have seen close before this wait attached.
  // In that case, do not start a misleading full-duration deadline.
  if(alreadyClosed)return Promise.resolve('child_exited');
  return new Promise((resolve,reject)=>{
    let timer;
    let finished=false;
    const onClose=()=>settle('child_exited');
    function settle(outcome){
      if(finished)return;
      finished=true;
      child.removeListener('close',onClose);
      if(timer!==undefined)cancel(timer);
      resolve(outcome);
    }
    child.once('close',onClose);
    try{timer=schedule(()=>settle('bounded_36s'),deadlineMs);}
    catch(error){child.removeListener('close',onClose);reject(error);}
  });
}
