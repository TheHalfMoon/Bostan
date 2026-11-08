#!/usr/bin/env node
/** Copy legally required bundled Cliplab provenance through the OS-neutral Node API. */
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const filenames=['LICENSE','PROVENANCE.md'];
const isInside=(path,root)=>path.startsWith(root+sep);
export function copyClipLabNotices(packageRoot){
  const root=realpathSync(packageRoot);
  const from=join(root,'src','cliplab');
  const dist=join(root,'dist');
  const target=join(dist,'cliplab');
  if(!isInside(realpathSync(from),root))throw Error('Cliplab source outside package');
  for(const name of filenames){
    const file=join(from,name);
    if(!existsSync(file)||!isInside(realpathSync(file),root)){
      throw Error('Required Cliplab legal file missing or external: '+name);
    }
  }
  for(const dir of [dist,target]){
    if(existsSync(dir)&&lstatSync(dir).isSymbolicLink()){
      throw Error('Refusing symlinked Cliplab output directory');
    }
    mkdirSync(dir,{recursive:true});
    if(!isInside(realpathSync(dir),root))throw Error('Cliplab output outside package');
  }
  for(const name of filenames){
    const destination=join(target,name);
    if(existsSync(destination)&&lstatSync(destination).isSymbolicLink()){
      throw Error('Refusing symlinked Cliplab legal file');
    }
    copyFileSync(join(from,name),destination);
    if(!readFileSync(destination).equals(readFileSync(join(from,name)))){
      throw Error('Cliplab legal file did not copy byte-identically: '+name);
    }
  }
  return {schema:'bostan.shared-cliplab-legal-copy.v1',
    sourceAndOutputInsidePackage:true,byteIdentical:true,files:filenames};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const packageRoot=dirname(dirname(fileURLToPath(import.meta.url)));
  console.log(JSON.stringify(copyClipLabNotices(packageRoot)));
  console.log('BOSTAN_SHARED_CLIPLAB_NOTICES_VERIFIED');
}
