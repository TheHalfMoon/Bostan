/**
 * Bounded, noninteractive child execution for private Windows auth/DB QA.
 * Never forwards untrusted child stdout/stderr into trusted QA receipts.
 * A full pipe or failed spawn is a failed step, not permission to bypass the
 * final read-only PostgreSQL orphan scan owned by the orchestrator.
 */
import {spawnSync} from 'node:child_process';

const failed=Object.freeze({status:1});
const passed=Object.freeze({status:0});
export const PRIVATE_WINDOWS_AUTH_DB_CHILD_MAX_BUFFER=1024*1024;

export function invokePrivateWindowsAuthDbCaptured(command,{env,spawn=spawnSync}={}) {
  if (!command || typeof command.binary!=='string' || !command.binary ||
      !Array.isArray(command.args) || !command.args.every(a=>typeof a==='string') ||
      typeof command.cwd!=='string' || !command.cwd ||
      !Number.isSafeInteger(command.timeout) || command.timeout<=0 ||
      !env || typeof env!=='object' || Array.isArray(env) ||
      typeof spawn!=='function') return failed;
  try {
    const result=spawn(command.binary,command.args,{
      cwd:command.cwd,env,stdio:['ignore','pipe','pipe'],
      encoding:'utf8',maxBuffer:PRIVATE_WINDOWS_AUTH_DB_CHILD_MAX_BUFFER,
      windowsHide:true,timeout:command.timeout,shell:false,
    });
    return result?.status===0 && !result.error && !result.signal ? passed : failed;
  } catch {
    return failed;
  }
}
