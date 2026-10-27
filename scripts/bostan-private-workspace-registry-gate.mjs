#!/usr/bin/env node
/**
 * Read-only, fail-closed Bostan release quarantine across ALL git-tracked
 * workspace and nested package manifests (including non-pnpm fixtures).
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const releaseBlocker='node ../../scripts/bostan-release-disabled.mjs';
const catalogs=['skills','teams'];

export function inspectPrivateManifest(manifest, relativePath) {
  if(!manifest || typeof manifest!=='object'||Array.isArray(manifest))
    throw Error(`Bostan invalid package manifest: ${relativePath}`);
  if(typeof manifest.name!=='string'||!manifest.name.trim())
    throw Error(`Bostan package name missing: ${relativePath}`);
  if(!(manifest.name==='bostan'||manifest.name.startsWith('bostan-')
      ||manifest.name.startsWith('@bostan/')))
    throw Error(`Bostan tracked package retains a non-Bostan identity: ${relativePath}`);
  if(manifest.private!==true)
    throw Error(`Bostan registry publication not quarantined: ${relativePath}`);
  if(Object.hasOwn(manifest,'publishConfig'))
    throw Error(`Bostan public registry publishConfig remains: ${relativePath}`);
  return {name:manifest.name,licensed:typeof manifest.license==='string'&&Boolean(manifest.license)};
}

export function checkCatalogReleaseHooks(manifest,category) {
  const relativePath=`packages/${category}-catalog/package.json`;
  if(manifest?.name!==`@bostan/${category}-catalog`)
    throw Error(`Bostan catalog package identity mismatch: ${relativePath}`);
  inspectPrivateManifest(manifest,relativePath);
  if(manifest.scripts?.prepack!==releaseBlocker
      ||manifest.scripts?.prepublishOnly!==releaseBlocker
      ||Object.hasOwn(manifest.scripts??{},'postpack'))
    throw Error(`Bostan catalog pack/publish hooks must fail closed: ${relativePath}`);
}

export function verifyBostanPrivateWorkspace({
  root=repoRoot,
  manifestFiles,
  read=(relativePath)=>readFileSync(resolve(root,relativePath),'utf8'),
}={}) {
  const paths=manifestFiles??execFileSync('git',['ls-files','--','**/package.json','package.json'],{
    cwd:root,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']
  }).trim().split('\n');
  const names=new Set();
  if(paths.length<30||!paths.includes('package.json')
      ||!paths.includes('packages/skills-catalog/package.json')
      ||!paths.includes('packages/teams-catalog/package.json'))
    throw Error('Incomplete Bostan tracked package manifest inventory');
  let licensed=0,missingLicense=0;
  for(const path of paths){
    if(!/^(?:[a-zA-Z0-9._-]+\/)*package\.json$/.test(path))throw Error('Untrusted Bostan tracked manifest path');
    const manifest=JSON.parse(read(path));
    const result=inspectPrivateManifest(manifest,path);
    if(names.has(path))throw Error('Duplicate Bostan inventory path');
    names.add(path);
    if(result.licensed)licensed++; else missingLicense++;
  }
  for(const category of catalogs)checkCatalogReleaseHooks(JSON.parse(read(`packages/${category}-catalog/package.json`)),category);
  const fixtures = [
    ['packages/paperclip-runner/scripts/pi-distribution/package.json','bostan-pi-runtime-distribution'],
    ['packages/plugins/sandbox-providers/cloudflare/bridge-template/package.json','bostan-cloudflare-sandbox-bridge-template'],
    ['tests/speko-voice-proof/package.json','@bostan/speko-voice-proof'],
  ];
  for(const [path,name] of fixtures){
    const pkg=JSON.parse(read(path));
    if(pkg.name!==name||pkg.private!==true)throw Error(`Bostan internal fixture identity mismatch: ${path}`);
  }
  const piLock=JSON.parse(read('packages/paperclip-runner/scripts/pi-distribution/package-lock.json'));
  if(piLock.name!=='bostan-pi-runtime-distribution'
      ||piLock.packages?.['']?.name!==piLock.name)
    throw Error('Bostan PI distribution private lockfile identity mismatch');
  const releaseMap=JSON.parse(read('scripts/release-package-manifest.json'));
  if(!Array.isArray(releaseMap)||releaseMap.length<5
    ||releaseMap.some(item=>item.publishFromCi!==false)
    ||catalogs.some(category=>!releaseMap.some(item=>item.dir===`packages/${category}-catalog`&&item.name===`@bostan/${category}-catalog`)))
    throw Error('Bostan release manifest has a public package or missing catalog');
  return {schema:'bostan.private-workspace-registry-quarantine.v1',
    passed:true,releaseQualified:false,registryPublicationDisabled:true,
    trackedManifestCount:paths.length,
    manifestsWithDeclaredLicenses:licensed,
    manifestsWithoutDeclaredLicenses:missingLicense,
    quarantinedCatalogs:catalogs.length,
    bostanPrivateFixtures:fixtures.length,
    releaseMapEntries:releaseMap.length,
    thirdPartyLicenseReviewComplete:false};
}

const isEntry=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntry){
  const args=process.argv.slice(2);
  if(args.length===0||(args.length===1&&args[0]==='--plan')){
    console.log(JSON.stringify({schema:'bostan.private-workspace-registry-quarantine.v1',run:false,
      releaseQualified:false,mode:'read-only-inventory',publishing:false},null,2));
  }else if(args.length===1&&args[0]==='--check'){
    try{console.log(JSON.stringify(verifyBostanPrivateWorkspace(),null,2))}
    catch(error){console.error('Bostan private workspace release quarantine failed:',error.message);process.exitCode=1}
  }else{
    console.error('Usage: node scripts/bostan-private-workspace-registry-gate.mjs [--plan|--check]');
    process.exitCode=2;
  }
}
