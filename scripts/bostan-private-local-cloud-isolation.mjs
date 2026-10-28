#!/usr/bin/env node
/**
 * Synthetic-only Bostan localhost PostgreSQL/HTTP QA admission.
 * Never read/write persisted credentials, connect to providers or alter env.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function validatePrivateLocalCloudIsolation(env=process.env){
  const conflicting=Object.keys(env).filter(key=>
    key==='PAPERCLIP_MANAGED_CONFIG'||
    key==='PAPERCLIP_PRIMARY_HOST'||
    key.startsWith('PAPERCLIP_CLOUD_')||
    key.startsWith('BOSTAN_CLOUD_')
  ).sort();
  // Even an empty managed config is a cloud signal, and an empty cloud origin
  // can mask accidental deployment configuration. Do not silently unset it.
  if(conflicting.length)throw Error(
    'Isolated Bostan localhost QA refuses managed/Cloud environment keys: '+conflicting.join(', ')
  );
  return {schema:'bostan.private-local-cloud-isolation.v1',
    qualified:true,releaseQualified:false,cloudEnvironmentSignals:0,
    externalCloudConfigured:false,paidProvidersUsed:false};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log(JSON.stringify({schema:'bostan.private-local-cloud-isolation.v1',
      run:false,releaseQualified:false,readOnly:true,
      requiresExplicitCheck:true},null,2));
  }else if(args.length===1&&args[0]==='--check'){
    try{
      console.log(JSON.stringify(validatePrivateLocalCloudIsolation(),null,2));
      console.log('BOSTAN_PRIVATE_LOCAL_CLOUD_ISOLATION_ADMITTED');
    }catch(error){
      // Names only, never secret values.
      console.error('Bostan private localhost isolation refused:',error.message);
      process.exitCode=2;
    }
  }else{
    console.error('Usage: node scripts/bostan-private-local-cloud-isolation.mjs [--plan|--check]');
    process.exitCode=2;
  }
}
