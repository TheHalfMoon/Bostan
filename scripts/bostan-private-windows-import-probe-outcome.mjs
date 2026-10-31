/** Fail-closed diagnostic admission: a child failure can never be a GREEN probe.
 * A bounded observation is valid only if the child had not exited at the
 * deadline. The intentional teardown signal after the snapshot is not a
 * failure, but a nonzero exit observed during teardown always is.
 */
export function admitPrivateWindowsProbeChildExit({
  outcome,exitCode,signalCode=null,finalExitCode=null,
}={}){
  if(signalCode!==null || (finalExitCode!==null && finalExitCode!==0))return false;
  if(outcome==='bounded_36s')return exitCode==null;
  return outcome==='child_exited' && exitCode===0;
}
