/**
 * Bostan private Windows QA: read-only, fail-closed listener ownership proof.
 * The health endpoint alone cannot prove that the responding localhost service
 * is the ChildProcess we just spawned after releasing an ephemeral port.
 */
import {spawnSync} from 'node:child_process';
import {resolvePrivateWindowsPowerShellBinary} from './bostan-private-windows-powershell-binary.mjs';

const refused = (reason = 'invalid_input') => { throw Error(`Private Windows QA HTTP listener ownership unverified [${reason}]`); };

export function inspectPrivateWindowsHttpListeners(port) {
  if (process.platform !== 'win32' || !Number.isSafeInteger(port) ||
      port < 1024 || port > 65535) refused();
  let binary;
  try { binary = resolvePrivateWindowsPowerShellBinary(); } catch { refused('powershell_unavailable'); }
  // The only interpolated value is a validated integer. Read-only OS query;
  // no process termination, configuration changes, or user data access.
  const script = [
    "$ErrorActionPreference='Stop'",
    "$rows=@(Get-NetTCPConnection -State Listen -LocalPort " + port +
      " -ErrorAction Stop | Select-Object LocalAddress,LocalPort,OwningProcess)",
    'ConvertTo-Json -InputObject $rows -Compress -Depth 2',
  ].join('; ');
  const result = spawnSync(binary, ['-NoProfile','-NonInteractive','-Command',script], {
    windowsHide:true, encoding:'utf8', timeout:8000, maxBuffer:4096,
    // Preserve only the OS module discovery path: a stripped environment can prevent
    // Get-NetTCPConnection from loading NetTCPIP under the CI test account.
    // Do not inherit the operator's arbitrary PSModulePath or PATH.
    env:{SystemRoot:process.env.SystemRoot||'',WINDIR:process.env.WINDIR||'',
      PSModulePath:(process.env.SystemRoot||'')+'\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\Modules'},
  });
  if (result.status !== 0 || result.signal || result.error ||
      typeof result.stdout !== 'string' || result.stderr?.trim()) refused('query_failed');
  try { return JSON.parse(result.stdout); } catch { refused('invalid_query_output'); }
}

/** Two independent OS snapshots must bind the sole IPv4 loopback listener to
 * the live child PID. A wildcard/IPv6/foreign/duplicate listener is ambiguous.
 * This is bounded temporal evidence, not an atomic kernel-held port lease. */
export async function proveOwnedWindowsHttpListener({
  port, expectedPid, childAlive,
  inspect=inspectPrivateWindowsHttpListeners,
  pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
} = {}) {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 ||
      !Number.isSafeInteger(expectedPid) || expectedPid <= 0 ||
      typeof childAlive !== 'function' || typeof inspect !== 'function' ||
      typeof pause !== 'function') refused();
  for (let sample=0; sample<2; sample++) {
    if (childAlive() !== true) refused('child_exited');
    let rows;
    try { rows = await inspect(port); } catch (error) {
      // Preserve only our own bounded diagnostic codes; never forward OS output.
      if (typeof error?.message === 'string' &&
          /^Private Windows QA HTTP listener ownership unverified \[(?:powershell_unavailable|query_failed|invalid_query_output)\]$/.test(error.message)) throw error;
      refused('inspection_failed');
    }
    if (!Array.isArray(rows) || rows.length !== 1) refused('listener_count');
    const row = rows[0];
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        row.LocalAddress !== '127.0.0.1' || row.LocalPort !== port ||
        row.OwningProcess !== expectedPid) refused('listener_mismatch');
    if (childAlive() !== true) refused('child_exited');
    if (sample === 0) {
      try { await pause(125); } catch { refused('sampling_failed'); }
    }
  }
  if (childAlive() !== true) refused('child_exited');
  return true;
}
