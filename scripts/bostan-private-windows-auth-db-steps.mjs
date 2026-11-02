/**
 * Fail-closed orchestration for the private native Windows auth/DB QA runner.
 * A failed/throwing build or PostgreSQL test must not skip the final read-only
 * PostgreSQL orphan scan. Never attempts to terminate or reclaim a process.
 */
const stepNames = Object.freeze([
  'read-only orphan gate',
  'shared TypeScript build',
  'shared legal asset copy',
  'plugin SDK TypeScript build',
  'HTTP authentication and first-admin route tests',
  'real embedded PostgreSQL migration/reset',
  'final read-only orphan gate',
]);
const passMarkers = Object.freeze({
  3:'BOSTAN_WIN_AUTH_DB_PLUGIN_SDK_PASS',
  4:'BOSTAN_WIN_AUTH_DB_HTTP_TESTS_PASS',
  5:'BOSTAN_WIN_AUTH_DB_REAL_POSTGRES_PASS',
  6:'BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS',
});
const refuse = () => {throw Error('Private Windows auth/DB QA step plan refused');};

export function executePrivateWindowsAuthDbSteps({
  commands, invoke, log = () => {}, error = () => {},
} = {}) {
  if (!Array.isArray(commands) || commands.length !== stepNames.length ||
      typeof invoke !== 'function' || typeof log !== 'function' ||
      typeof error !== 'function') refuse();
  for (let i=0; i<stepNames.length; i++) {
    const c=commands[i];
    if (!c || c.name !== stepNames[i] || typeof c.binary !== 'string' ||
        !c.binary || !Array.isArray(c.args) || typeof c.cwd !== 'string' ||
        !c.cwd || !Number.isSafeInteger(c.timeout) || c.timeout <= 0) refuse();
  }
  // A broken diagnostic sink must never prevent the final read-only scan.
  // Fail closed: do not start another workload once receipts cannot be written.
  let diagnosticFailed=false;
  const emit=(sink,line)=>{
    try { sink(line); } catch { diagnosticFailed=true; }
  };
  const run = i => {
    emit(log,'BOSTAN_WIN_AUTH_DB_STEP=' + stepNames[i]);
    if (diagnosticFailed && i !== 0 && i !== 6) return false;
    try {
      const result=invoke(commands[i]);
      return result?.status === 0 && !result.error && !result.signal;
    } catch {
      return false;
    }
  };
  if (!run(0)) {
    emit(error,'BOSTAN_WIN_AUTH_DB_INITIAL_ORPHAN_GATE_FAILED');
    return Object.freeze({passed:false,failedStep:0,
      finalGateAttempted:false,finalGatePassed:false,diagnosticFailed});
  }
  let failedStep=-1;
  for (let i=1; i<6; i++) {
    if (diagnosticFailed) break;
    if (!run(i)) {
      failedStep=i;
      emit(error,'BOSTAN_WIN_AUTH_DB_STEP_FAILED=' + i);
      break;
    }
    if (passMarkers[i]) emit(log,passMarkers[i]);
  }
  // The final scan is read-only and must run after any attempted workload,
  // including when a child exits nonzero, times out, signals, or throws.
  const finalGatePassed=run(6);
  if (finalGatePassed) emit(log,passMarkers[6]);
  else emit(error,'BOSTAN_WIN_AUTH_DB_FINAL_ORPHAN_GATE_FAILED');
  return Object.freeze({passed:failedStep===-1 && finalGatePassed && !diagnosticFailed,
    failedStep,finalGateAttempted:true,finalGatePassed,diagnosticFailed});
}
