/**
 * Bind disposable local PostgreSQL QA migrations to the exact installed pnpm
 * package, not ambient PATH, a .cmd wrapper, or a downloading Corepack shim.
 * This is local identity/digest evidence, NOT trusted publisher attestation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REFUSAL='Bostan local pnpm entry unverified; retaining fixture';
const deny=()=>{throw Error(REFUSAL);};
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.birthtimeMs===b.birthtimeMs;
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const acceptable=(p,expectedType,platform)=>{
  if(fs.realpathSync(p)!==p)deny();
  const s=fs.lstatSync(p);
  if(s.isSymbolicLink() || (expectedType==='file' ? !s.isFile()||s.nlink!==1 : !s.isDirectory())) deny();
  if(platform!=='win32' && (s.mode&0o022))deny();
  return s;
};
/** @param {string} packageDir - explicit canonical pnpm@9.15.4 package directory */
export function captureLocalPinnedPnpm(packageDir,{platform=process.platform, expectedVersion='9.15.4'}={}){
  if(!['linux','darwin','win32'].includes(platform)||typeof packageDir!=='string'||
     !path.isAbsolute(packageDir)||path.normalize(packageDir)!==packageDir||
     (platform==='win32'&&!/^[A-Za-z]:\\/.test(packageDir))||
     expectedVersion!=='9.15.4')deny();
  const manifest=path.join(packageDir,'package.json');
  const bin=path.join(packageDir,'bin');
  const cli=path.join(bin,'pnpm.cjs');
  let packageIdentity, binIdentity, manifestIdentity, cliIdentity, manifestHash, cliHash;
  const inspectManifest=()=>{
    const bytes=fs.readFileSync(manifest);
    if(bytes.length>128*1024)deny();
    const pkg=JSON.parse(bytes.toString('utf8'));
    if(pkg?.name!=='pnpm'||pkg?.version!==expectedVersion||
       !pkg.bin||typeof pkg.bin!=='object'||
       !['bin/pnpm.cjs','./bin/pnpm.cjs'].includes(pkg.bin.pnpm))deny();
    return createHash('sha256').update(bytes).digest('hex');
  };
  try{
    packageIdentity=acceptable(packageDir,'directory',platform);
    binIdentity=acceptable(bin,'directory',platform);
    manifestIdentity=acceptable(manifest,'file',platform);
    cliIdentity=acceptable(cli,'file',platform);
    manifestHash=inspectManifest();
    cliHash=digest(cli);
  }catch{deny();}
  return Object.freeze({
    pathForNode(){
      try{
        if(!same(packageIdentity,acceptable(packageDir,'directory',platform))||
           !same(binIdentity,acceptable(bin,'directory',platform))||
           !same(manifestIdentity,acceptable(manifest,'file',platform))||
           !same(cliIdentity,acceptable(cli,'file',platform))||
           inspectManifest()!==manifestHash||digest(cli)!==cliHash) deny();
        return cli;
      }catch{deny();}
    },
  });
}
