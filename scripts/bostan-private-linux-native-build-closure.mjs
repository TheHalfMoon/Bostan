#!/usr/bin/env node
/** Read-only native compiler/Vite dependency admission for isolated Linux QA.
 * Does not install packages, publish, execute inference or change pnpm config.
 */
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));

export function validateLinuxBuildClosure({
  platform='linux',arch='x64',glibc=true,nodeMajor=24,readPackage,
}={}){
  if(platform!=='linux'||arch!=='x64'||glibc!==true||nodeMajor<24)
    throw Error('Bostan native Linux build closure requires Linux x64 glibc Node >=24');
  if(typeof readPackage!=='function')throw Error('Missing read-only dependency inspector');
  const required=(source,name)=>{
    let pkg;
    try{pkg=readPackage(source,name)}catch{throw Error('Missing native Linux build dependency: '+source+' -> '+name)}
    if(pkg?.name!==name||typeof pkg.version!=='string'||!pkg.version.trim())
      throw Error('Invalid native Linux build dependency: '+source+' -> '+name);
    return pkg;
  };
  const ts=required('shared','typescript');
  const typeBin=required('typescript','@typescript/typescript-linux-x64');
  if(ts.optionalDependencies?.['@typescript/typescript-linux-x64']!==typeBin.version)
    throw Error('Native Linux TypeScript binary does not match TypeScript dependency');
  required('shared','@types/node');
  required('ui','@types/react');
  const vite=required('ui','vite');
  const roll=required('vite','rolldown');
  const rollBin=required('rolldown','@rolldown/binding-linux-x64-gnu');
  if(roll.optionalDependencies?.['@rolldown/binding-linux-x64-gnu']!==rollBin.version)
    throw Error('Native Linux Rolldown binding does not match its parent');
  return {schema:'bostan.private-linux-native-build-closure.v1',
    qualified:true,releaseQualified:false,installedPackagesChecked:7,
    nodeMajor,typescriptVersion:ts.version,
    nativeTypeScriptVersion:typeBin.version,viteVersion:vite.version,
    rolldownVersion:roll.version,rolldownNativeVersion:rollBin.version,
    optionalNativePackagesRequired:true,paidModelsUsed:false};
}
export function inspectLinuxBuildClosure({rootDir=root}={}){
  const report=process.report?.getReport?.();
  const glibc=Boolean(report?.header?.glibcVersionRuntime);
  function readPackage(source,name){
    const locations={
      shared:'packages/shared/package.json',ui:'ui/package.json',
    };
    let current;
    if(locations[source])current=resolve(rootDir,locations[source]);
    else if(['typescript','vite','rolldown'].includes(source))
      current=resolveFrom(source);
    else throw Error('Invalid native dependency source');
    function resolveFrom(pkgName){
      if(pkgName==='typescript')return readLocation('shared','typescript');
      if(pkgName==='vite')return readLocation('ui','vite');
      return readLocation('vite','rolldown');
    }
    function readLocation(parent,pkgName){
      const parentSource=locations[parent] ? resolve(rootDir,locations[parent])
        :resolveFrom(parent);
      return createRequire(parentSource).resolve(pkgName+'/package.json');
    }
    const manifest=createRequire(current).resolve(name+'/package.json');
    return JSON.parse(readFileSync(manifest,'utf8'));
  }
  return validateLinuxBuildClosure({
    platform:process.platform,arch:process.arch,glibc,
    nodeMajor:Number(process.versions.node.split('.')[0]),readPackage,
  });
}
const entry=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(entry){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log(JSON.stringify({schema:'bostan.private-linux-native-build-closure.v1',
      run:false,releaseQualified:false,offline:true},null,2));
  }else if(args.length===1&&args[0]==='--check'){
    try{console.log(JSON.stringify(inspectLinuxBuildClosure(),null,2))}
    catch(error){console.error('Bostan native Linux build dependency gate failed:',error.message);process.exitCode=2}
  }else{
    console.error('Usage: node scripts/bostan-private-linux-native-build-closure.mjs [--plan|--check]');
    process.exitCode=2;
  }
}
