/**
 * Read-only path admission for the private native Windows auth/DB smoke runner.
 * A matching B### basename alone does not make an ancestor junction, a .git
 * indirection, or a foreign TEMP directory an owned QA checkout.
 * This is a bounded preflight, NOT atomic ownership against concurrent swaps.
 */
import {lstatSync, realpathSync} from 'node:fs';
import {win32} from 'node:path';
import {matchingPrivateWindowsQaWave} from './bostan-private-windows-qa-wave.mjs';

const refuse=()=>{throw Error('Private Windows auth/DB QA workspace admission refused');};
const forbiddenName=/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;
const canonicalComponents=path=>{
  if(typeof path!=='string'||!/^[A-Za-z]:\\/.test(path)||
     path!==win32.normalize(path)||path.includes('/')||
     /[\x00-\x1f\x7f]/.test(path))refuse();
  const root=win32.parse(path).root;
  if(!/^[A-Za-z]:\\$/.test(root))refuse();
  const parts=path.slice(root.length).split('\\');
  if(!parts.length||parts.some(part=>!part||part==='.'||part==='..'||
       /[:<>"|?*]/.test(part)||/[. ]$/.test(part)||forbiddenName.test(part)))refuse();
  return {root,parts};
};
const checkDirectoryChain=(path,statPath,realPath)=>{
  const {root,parts}=canonicalComponents(path);
  let current=root;
  for(const component of [null,...parts]){
    if(component!==null)current=win32.join(current,component);
    const info=statPath(current);
    if(!info?.isDirectory?.()||info.isSymbolicLink?.()||
       realPath(current)?.toLowerCase?.()!==current.toLowerCase())refuse();
  }
};

export function assertPrivateWindowsAuthDbWorkspace({
  root,temp,platform=process.platform,statPath=lstatSync,realPath=realpathSync,
}={}){
  try{
    if(platform!=='win32'||typeof statPath!=='function'||typeof realPath!=='function')refuse();
    canonicalComponents(root);
    canonicalComponents(temp);
    if(!matchingPrivateWindowsQaWave(win32.basename(root),win32.basename(temp)))refuse();
    checkDirectoryChain(root,statPath,realPath);
    checkDirectoryChain(temp,statPath,realPath);
    // A .git file may redirect to a different working tree. Native QA requires
    // a self-contained checkout with ordinary, unlinked Git metadata.
    const git=win32.join(root,'.git');
    const info=statPath(git);
    if(!info?.isDirectory?.()||info.isSymbolicLink?.()||
       realPath(git)?.toLowerCase?.()!==git.toLowerCase())refuse();
    return Object.freeze({root,temp});
  }catch{
    refuse();
  }
}
