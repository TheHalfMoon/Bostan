#!/usr/bin/env node
/**
 * Explicit qualification admission for Linux with a small system tmpfs.
 * Default 4 GiB disk gate remains unchanged. This narrowly gated exception
 * never changes mount settings, user's HOME, or the stage cleanup root.
 */
import { readFileSync, realpathSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TMPFS_MAGIC=0x01021994;
const ROOT='/tmp';
const MIN_STAGE_FREE_KIB=3670016; // 3.5 GiB
const MIN_MEMORY_AVAILABLE_KIB=5242880; // 5 GiB

export function admitLinuxPrivateTmpfs({
  platform=process.platform,
  root=ROOT,
  filesystemType,
  freeKiB,
  availableMemoryKiB,
}={}) {
  if(platform!=='linux'||root!==ROOT||filesystemType!==TMPFS_MAGIC)
    throw Error('Bostan Linux private tmpfs QA requires the real Linux /tmp tmpfs');
  if(!Number.isSafeInteger(freeKiB)||freeKiB<MIN_STAGE_FREE_KIB)
    throw Error('Bostan private tmpfs requires at least 3.5 GiB available');
  if(!Number.isSafeInteger(availableMemoryKiB)||availableMemoryKiB<MIN_MEMORY_AVAILABLE_KIB)
    throw Error('Bostan private tmpfs requires at least 5 GiB available memory');
  return {
    schema:'bostan.private-linux-tmpfs-admission.v1',
    qualified:true,releaseQualified:false,temporaryStageOnly:true,
    freeKiB,availableMemoryKiB,
    stageFreeMinimumKiB:MIN_STAGE_FREE_KIB,
    standardSourceFreeMinimumKiB:4194304,
    otherPlatformsQualified:false,
    paidModelsUsed:false,
  };
}

export function inspectLinuxTmpfs() {
  if(process.platform!=='linux'||realpathSync(ROOT)!==ROOT)
    throw Error('Bostan Linux tmpfs admission only on canonical /tmp');
  const fs=statfsSync(ROOT);
  const mem=readFileSync('/proc/meminfo','utf8');
  const found=/^MemAvailable:\s+(\d+) kB$/m.exec(mem);
  if(!found)throw Error('Linux MemAvailable missing');
  const free=Math.floor((Number(fs.bavail)*Number(fs.bsize))/1024);
  return admitLinuxPrivateTmpfs({
    platform:process.platform,root:ROOT,filesystemType:Number(fs.type),
    freeKiB:free,availableMemoryKiB:Number(found[1]),
  });
}
const isEntrypoint=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntrypoint){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log(JSON.stringify({schema:'bostan.private-linux-tmpfs-admission.v1',
      run:false,releaseQualified:false,requiresExplicitOptIn:true,
      standardStageGateUnchanged:true},null,2));
  }else if(args.length===1&&args[0]==='--check'){
    try{console.log(JSON.stringify(inspectLinuxTmpfs(),null,2))}
    catch(error){console.error('Bostan private Linux tmpfs admission failed:',error.message);process.exitCode=2}
  }else {
    console.error('Usage: node scripts/bostan-private-linux-tmpfs-admission.mjs [--plan|--check]');
    process.exitCode=2;
  }
}
