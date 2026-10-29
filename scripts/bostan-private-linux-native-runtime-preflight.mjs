#!/usr/bin/env node
/**
 * Read-only, offline Linux native runtime/build preflight. It must execute
 * before pnpm, Docker, PostgreSQL or any mutable stage is created.
 * Never install dependencies, report user paths or print credentials.
 */
import {accessSync,constants,realpathSync,statfsSync,readFileSync} from 'node:fs';
import {join,delimiter,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const requiredCommands=['node','pnpm','initdb','pg_ctl','createdb','psql',
  'curl','git','bash','python3'];
const MIN_MEMORY_KIB=5*1024*1024;
const MIN_TMPFS_FREE_KIB=3584*1024;  // 3.5 GiB
const MIN_SOURCE_FREE_KIB=4*1024*1024;
const TMPFS_MAGIC=0x01021994;
export const NATIVE_LINUX_REQUIRED_COMMANDS=Object.freeze([...requiredCommands]);

export function isAdmittedNativeLinuxExecutable(value){
  if(typeof value!=='string'||!value.startsWith('/')||value.includes('\0')||
      /\.(exe|cmd|bat|ps1)$/i.test(value))return false;
  const canonical=value.replace(/\/+/g,'/');
  if(canonical.startsWith('/mnt/')||canonical.startsWith('/media/')||
      canonical.startsWith('/run/desktop/'))return false;
  return ['/usr/','/bin/','/opt/','/home/'].some(prefix=>canonical.startsWith(prefix));
}
export function findAdmittedLinuxCommand(name,searchPath=process.env.PATH??''){
  if(!requiredCommands.includes(name)||typeof searchPath!=='string')return false;
  for(const dir of searchPath.split(delimiter).filter(Boolean)){
    const candidate=join(dir,name);
    if(!isAdmittedNativeLinuxExecutable(candidate))continue;
    try{
      const target=realpathSync(candidate);
      if(!isAdmittedNativeLinuxExecutable(target))continue;
      accessSync(candidate,constants.X_OK);
      return true;
    }catch{ /* Always fail closed and try the next native directory. */ }
  }
  return false;
}
export function assessNativeLinuxRuntimePreflight({
  platform='linux',arch='x64',nodeMajor=24,glibc=true,
  nativeCommands={},tmpfsType=TMPFS_MAGIC,
  tmpfsFreeKiB=4*1024*1024,availableMemoryKiB=6*1024*1024,
  sourceFreeKiB=8*1024*1024,
}={}){
  const blocks=[];
  if(platform!=='linux')blocks.push('not_linux');
  if(arch!=='x64')blocks.push('not_x64');
  if(glibc!==true)blocks.push('not_glibc');
  if(!Number.isSafeInteger(nodeMajor)||nodeMajor<24)blocks.push('node_below_24');
  for(const cmd of requiredCommands){
    if(nativeCommands[cmd]!==true)blocks.push('missing_native_'+cmd.replaceAll('-','_'));
  }
  if(tmpfsType!==TMPFS_MAGIC)blocks.push('tmp_not_linux_tmpfs');
  if(!Number.isSafeInteger(tmpfsFreeKiB)||tmpfsFreeKiB<MIN_TMPFS_FREE_KIB)
    blocks.push('tmpfs_below_3_5_gib');
  if(!Number.isSafeInteger(availableMemoryKiB)||availableMemoryKiB<MIN_MEMORY_KIB)
    blocks.push('ram_below_5_gib');
  if(!Number.isSafeInteger(sourceFreeKiB)||sourceFreeKiB<MIN_SOURCE_FREE_KIB)
    blocks.push('source_below_4_gib');
  return {
    schema:'bostan.private-linux-native-runtime-preflight.v1',
    admitted:blocks.length===0,releaseQualified:false,offline:true,mutated:false,
    missingRequirements:blocks,
    checkedNativeCommands:requiredCommands.length,
    // Never report PATH, device names, package versions, API keys or data.
  };
}
function filesystemFreeKiB(path){
  const fs=statfsSync(path);
  return Math.floor(Number(fs.bavail)*Number(fs.bsize)/1024);
}
export function inspectNativeLinuxRuntimePreflight({
  root=fileURLToPath(new URL('../',import.meta.url)),pathEnv=process.env.PATH,
}={}){
  // No network, process launch, package installations or repo modifications.
  const glibc=Boolean(process.report?.getReport?.()?.header?.glibcVersionRuntime);
  const nativeCommands=Object.fromEntries(requiredCommands.map(cmd=>
    [cmd,findAdmittedLinuxCommand(cmd,pathEnv)]));
  let tmpfsType=null,tmpfsFreeKiB=null,availableMemoryKiB=null,sourceFreeKiB=null;
  try{
    const fs=statfsSync('/tmp');
    tmpfsType=Number(fs.type);
    tmpfsFreeKiB=filesystemFreeKiB('/tmp');
    const matched=/^MemAvailable:\s+(\d+) kB$/m.exec(readFileSync('/proc/meminfo','utf8'));
    if(matched)availableMemoryKiB=Number(matched[1]);
    sourceFreeKiB=filesystemFreeKiB(resolve(root));
  }catch{ /* Missing or inaccessible native Linux evidence refuses admission. */ }
  return assessNativeLinuxRuntimePreflight({
    platform:process.platform,arch:process.arch,
    nodeMajor:Number(process.versions.node.split('.')[0]),
    glibc,nativeCommands,tmpfsType,tmpfsFreeKiB,
    availableMemoryKiB,sourceFreeKiB,
  });
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log(JSON.stringify({schema:'bostan.private-linux-native-runtime-preflight.v1',
      run:false,offline:true,releaseQualified:false,requiresExplicitCheck:true}));
  }else if(args.length===1&&args[0]==='--check'){
    try{
      const report=inspectNativeLinuxRuntimePreflight();
      console.log(JSON.stringify(report));
      if(!report.admitted)process.exitCode=2;
    }catch{
      console.error('BOSTAN_LINUX_NATIVE_PREFLIGHT_UNAVAILABLE');
      process.exitCode=2;
    }
  }else{
    console.error('Usage: node scripts/bostan-private-linux-native-runtime-preflight.mjs [--plan|--check]');
    process.exitCode=2;
  }
}
