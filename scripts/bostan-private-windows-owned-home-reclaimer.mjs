/**
 * Test-only Windows HTTP QA scratch-home reclamation.
 * The marker's bytes alone do not prove that the directory is still the
 * one created by mkdtempSync; capture both original filesystem identities.
 * This is not an atomic defense against privileged concurrent swaps.
 */
import {lstatSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';

const MARKER='BOSTAN_QA_OWNED';
const BYTES='BOSTAN_PRIVATE_SYNTHETIC_ONLY\n';
const REFUSED='BOSTAN_WINDOWS_LIVE_OWNED_HOME_RECLAIM_REFUSED';
const fail=()=>{throw Error(REFUSED);};
const identity=s=>({dev:s.dev,ino:s.ino,birthtimeMs:s.birthtimeMs});
const same=(s,id)=>s.dev===id.dev&&s.ino===id.ino&&s.birthtimeMs===id.birthtimeMs;
const ordinaryDirectory=s=>s.isDirectory()&&!s.isSymbolicLink();
const ordinaryMarker=s=>s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size===Buffer.byteLength(BYTES);
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

export function captureOwnedWindowsHttpHomeReclaimer({home,temp}={}) {
  if(typeof home!=='string'||typeof temp!=='string'||
      !basename(home).startsWith('bostan-private-auth-http-'))fail();
  let originalTemp,originalHome,originalMarker,canonicalTemp,canonicalHome;
  const marker=join(home,MARKER);
  try {
    originalTemp=lstatSync(temp);
    originalHome=lstatSync(home);
    originalMarker=lstatSync(marker);
    canonicalTemp=realpathSync(temp);
    canonicalHome=realpathSync(home);
    if(!ordinaryDirectory(originalTemp)||!ordinaryDirectory(originalHome)||
       !ordinaryMarker(originalMarker)||
       !samePath(dirname(canonicalHome),canonicalTemp)||
       readFileSync(marker,'utf8')!==BYTES)fail();
  }catch{fail();}
  const tempId=identity(originalTemp);
  const homeId=identity(originalHome);
  const markerId=identity(originalMarker);
  let reclaimed=false;
  return () => {
    if(reclaimed)fail();
    try {
      const currentTemp=lstatSync(temp);
      const currentHome=lstatSync(home);
      const currentMarker=lstatSync(marker);
      if(!ordinaryDirectory(currentTemp)||!same(currentTemp,tempId)||
         !ordinaryDirectory(currentHome)||!same(currentHome,homeId)||
         !ordinaryMarker(currentMarker)||!same(currentMarker,markerId)||
         !samePath(realpathSync(temp),canonicalTemp)||
         !samePath(realpathSync(home),canonicalHome)||
         !samePath(dirname(realpathSync(home)),canonicalTemp)||
         readFileSync(marker,'utf8')!==BYTES)fail();
      rmSync(home,{recursive:true,force:false});
      reclaimed=true;
    }catch{fail();}
  };
}
