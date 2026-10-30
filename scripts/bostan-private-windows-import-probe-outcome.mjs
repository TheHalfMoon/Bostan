/** Fail-closed diagnostic admission: a child failure can never be a GREEN probe. */
export function admitPrivateWindowsProbeChildExit({outcome,exitCode}={}){
  if(outcome==='bounded_36s')return true; // timed diagnostic, NOT app success
  return outcome==='child_exited' && exitCode===0;
}
