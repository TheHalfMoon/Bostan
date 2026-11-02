/**
 * Bounded, noninteractive child execution for private Windows auth/DB QA.
 * Never forwards untrusted child stdout/stderr into trusted QA receipts.
 * A full pipe or failed spawn is a failed step, not permission to bypass the
 * final read-only PostgreSQL orphan scan owned by the orchestrator.
 */
import {spawnSync} from 'node:child_process';
import {isAbsolute, win32} from 'node:path';

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
const fixtureKeys=Object.freeze([
  'HOME','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME',
]);
const pinnedValues=Object.freeze({
  CI:'1',DO_NOT_TRACK:'1',OTEL_SDK_DISABLED:'true',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1',NPM_CONFIG_OFFLINE:'true',
  PAPERCLIP_TEST_POSTGRES_TEMPLATE:'0',
});
// Pure string boundary only; the runner separately verifies each directory
// ancestor, ownership marker and Git metadata on the native Windows host.
function canonicalPrivateTemp(path) {
  if(typeof path!=='string'||! /^[A-Za-z]:\\/.test(path)||
      path!==win32.normalize(path)||path.includes('/')||
      /[\x00-\x1f\x7f]/.test(path)) return false;
  const components=path.slice(3).split('\\');
  if(!components.length||!/^Bostan-B[0-9]{3}-temp$/i.test(components.at(-1))) return false;
  return components.every(part=>part && part!=='.' && part!=='..' &&
    !/[:<>"|?*]/.test(part) && !/[. ]$/.test(part) &&
    !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part));
}
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
    // Minimal empty-PATH synthetic Node unit tests have no Windows OS root;
    // they cannot carry arbitrary profile paths or disable safety controls.
    if(systemRoot===undefined) return seen.get('PATH')==='' &&
      fixtureKeys.every(key=>!seen.has(key)) &&
      Object.entries(pinnedValues).every(([key,value])=>
        !seen.has(key) || seen.get(key)===value);
    if(!/^[A-Za-z]:\\Windows$/i.test(systemRoot)) return false;
    const expectedPath=systemRoot+'\\System32';
    const equal=(key,value)=>!seen.has(key) ||
      seen.get(key).toLowerCase()===value.toLowerCase();
    if(seen.get('PATH').toLowerCase()!==expectedPath.toLowerCase() ||
      !equal('WINDIR',systemRoot) ||
      !equal('SYSTEMDRIVE',systemRoot.slice(0,2)) ||
      !equal('COMSPEC',expectedPath+'\\cmd.exe') ||
      !equal('PATHEXT','.COM;.EXE;.BAT;.CMD')) return false;
    // Native QA is only admitted with its explicit offline flags and a
    // single wave-scoped synthetic TEMP/HOME, never operator profile folders.
    if(!Object.entries(pinnedValues).every(([key,value])=>seen.get(key)===value)) return false;
    const temp=seen.get('TEMP');
    return canonicalPrivateTemp(temp) &&
      fixtureKeys.every(key=>seen.get(key)?.toLowerCase()===temp.toLowerCase());
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
