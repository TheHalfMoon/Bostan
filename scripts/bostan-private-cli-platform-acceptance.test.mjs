import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {acceptancePlan,qualifyNodeVersion,verifyPrivateSource} from './bostan-private-cli-platform-acceptance.mjs';

const script=fileURLToPath(new URL('./bostan-private-cli-platform-acceptance.mjs',import.meta.url));
function invoke(...args){return spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:7000})}

test('plan and import are read-only, no acceptance command runs implicitly',()=>{
  assert.equal(verifyPrivateSource(),true);
  const plan=acceptancePlan();
  assert.equal(plan.releaseQualified,false);
  assert.equal(plan.publicActionsEnabled,false);
  assert.equal(plan.tests.length,3);
  for(const args of [[],['--plan'],['--help']]){
    const p=invoke(...args);
    assert.equal(p.status,0,p.stderr);
    assert.deepEqual(JSON.parse(p.stdout),plan);
  }
  for(const args of [['--publish'],['--deploy'],['--release'],['--run','--publish']]){
    const p=invoke(...args);
    assert.equal(p.status,2);
  }
});

test('node engine admission matches private Bostan manifest and fails old distro Node 22',()=>{
  for(const version of ['24.11.0','24.19.0','25.1.0','26.0.0'])assert.equal(qualifyNodeVersion(version),true);
  for(const version of ['22.22.1','24.10.9','18.20.0','banana',''])assert.throws(()=>qualifyNodeVersion(version),/Node.js >=24.11.0/);
  assert.throws(()=>verifyPrivateSource('/definitely-nonexistent-bostan-root'));
});

test('CLI cannot qualify a source checkout if the all-package registry quarantine is not green',()=>{
  assert.throws(()=>verifyPrivateSource(undefined,{releaseGate:()=>({passed:false,registryPublicationDisabled:true,trackedManifestCount:48})}),/full private workspace registry quarantine/);
  assert.throws(()=>verifyPrivateSource(undefined,{releaseGate:()=>({passed:true,registryPublicationDisabled:false,trackedManifestCount:48})}),/full private workspace registry quarantine/);
  assert.throws(()=>verifyPrivateSource(undefined,{releaseGate:()=>({passed:true,registryPublicationDisabled:true,trackedManifestCount:2})}),/full private workspace registry quarantine/);
  let consulted=0;
  assert.equal(verifyPrivateSource(undefined,{releaseGate:({root})=>{consulted++;assert.match(root,/bostan-b067/);return{passed:true,registryPublicationDisabled:true,trackedManifestCount:48}}}),true);
  assert.equal(consulted,1);
});
