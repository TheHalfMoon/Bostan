/**
 * Bounded, noninteractive child execution for private Windows auth/DB QA.
 * Never forwards untrusted child stdout/stderr into trusted QA receipts.
 * A full pipe or failed spawn is a failed step, not permission to bypass the
 * final read-only PostgreSQL orphan scan owned by the orchestrator.
 */
import {spawnSync} from 'node:child_process';
import {isAbsolute} from 'node:path';

const failed=Object.freeze({status:1});
const passed=Object.freeze({status:0});
export const PRIVATE_WINDOWS_AUTH_DB_CHILD_MAX_BUFFER=1024*1024;
// A future caller must not accidentally restore ambient credentials, preload
// hooks or a foreign executable search environment to this private QA path.
const childEnvironmentKeys=new Set([
  'SYSTEMROOT','WINDIR','SYSTEMDRIVE','PATH','PATHEXT','COMSPEC',
  'HOME','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA',
  'XDG_CONFIG_HOME','CI','DO_NOT_TRACK','OTEL_SDK_DISABLED',
  'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD','NPM_CONFIG_OFFLINE',
  'PAPERCLIP_TEST_POSTGRES_TEMPLATE',
]);
const noNul=value=>typeof value==='string' && !value.includes('\0');
function admittedEnvironment(env){
  if(!env || typeof env!=='object' || Array.isArray(env)) return false;
  const seen=new Map();
  try {
    for(const [key,value] of Object.entries(env)) {
      const folded=key.toUpperCase();
      if(!childEnvironmentKeys.has(folded) || seen.has(folded) ||
          !noNul(key) || !noNul(value)) return false;
      seen.set(folded,value);
    }
    if(!seen.has('PATH')) return false;
    const systemRoot=seen.get('SYSTEMROOT');
    // Empty PATH is useful for isolated synthetic tests. Native Windows QA
    // must use only its admitted OS System32 search directory.
    if(systemRoot===undefined) return seen.get('PATH')==='';
    if(!/^[A-Za-z]:\\Windows$/i.test(systemRoot)) return false;
    const expectedPath=systemRoot+'\\System32';
    const equal=(key,value)=>!seen.has(key) ||
      seen.get(key).toLowerCase()===value.toLowerCase();
    return seen.get('PATH').toLowerCase()===expectedPath.toLowerCase() &&
      equal('WINDIR',systemRoot) &&
      equal('SYSTEMDRIVE',systemRoot.slice(0,2)) &&
      equal('COMSPEC',expectedPath+'\\cmd.exe') &&
      equal('PATHEXT','.COM;.EXE;.BAT;.CMD');
  } catch { return false; }
}

export function invokePrivateWindowsAuthDbCaptured(command,{env,spawn=spawnSync}={}) {
  if (!command || !noNul(command.binary) || !isAbsolute(command.binary) ||
      !Array.isArray(command.args) || !command.args.every(noNul) ||
      !noNul(command.cwd) || !isAbsolute(command.cwd) ||
      !Number.isSafeInteger(command.timeout) || command.timeout<=0 ||
      !admittedEnvironment(env) ||
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
