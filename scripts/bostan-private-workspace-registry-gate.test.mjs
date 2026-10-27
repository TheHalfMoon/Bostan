import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {checkCatalogReleaseHooks,inspectPrivateManifest,verifyBostanPrivateWorkspace} from './bostan-private-workspace-registry-gate.mjs';
const path=fileURLToPath(new URL('./bostan-private-workspace-registry-gate.mjs',import.meta.url));
const invoke=args=>spawnSync(process.execPath,[path,...args],{encoding:'utf8',timeout:15000});

test('repository-wide source inventory keeps every Bostan package unpublishable',()=>{
  const receipt=verifyBostanPrivateWorkspace();
  assert.equal(receipt.passed,true);
  assert.equal(receipt.registryPublicationDisabled,true);
  assert.equal(receipt.releaseQualified,false);
  assert.ok(receipt.trackedManifestCount>=45);
  assert.equal(receipt.quarantinedCatalogs,2);
  assert.equal(receipt.thirdPartyLicenseReviewComplete,false);
  assert.equal(receipt.manifestsWithDeclaredLicenses+receipt.manifestsWithoutDeclaredLicenses,receipt.trackedManifestCount);
});

test('manifest gate rejects both public registry exposure patterns and omission',()=>{
  const good={name:'@bostan/test',private:true,license:'MIT'};
  assert.equal(inspectPrivateManifest(good,'test/package.json').name,good.name);
  for(const bad of [
    {...good,private:false},{name:'@bostan/test'}, {...good,private:'true'},
    {...good,publishConfig:{access:'public'}},
  ])assert.throws(()=>inspectPrivateManifest(bad,'test/package.json'),/quarantined|publishConfig/);
  assert.throws(()=>inspectPrivateManifest({private:true},'test/package.json'),/name missing/);
});

test('both public-facing catalogs also block packaging hooks',()=>{
  for(const category of ['skills','teams']){
    const ok={name:`@bostan/${category}-catalog`,private:true,
      scripts:{prepack:'node ../../scripts/bostan-release-disabled.mjs',prepublishOnly:'node ../../scripts/bostan-release-disabled.mjs'}};
    assert.doesNotThrow(()=>checkCatalogReleaseHooks(ok,category));
    for(const bad of [{...ok,scripts:{...ok.scripts,prepack:'node ./build.mjs'}},
      {...ok,scripts:{...ok.scripts,prepublishOnly:'echo published'}},
      {...ok,scripts:{...ok.scripts,postpack:'echo ok'}},
      {...ok,publishConfig:{access:'public'}}]){
      assert.throws(()=>checkCatalogReleaseHooks(bad,category));
    }
  }
});

test('CLI is read-only by default and refuses release/publish actions',()=>{
  for(const args of [[],['--plan']]){
    const res=invoke(args);
    assert.equal(res.status,0,res.stderr);
    assert.equal(JSON.parse(res.stdout).publishing,false);
  }
  const checked=invoke(['--check']);
  assert.equal(checked.status,0,checked.stderr);
  assert.equal(JSON.parse(checked.stdout).passed,true);
  for(const args of [['--publish'],['--release'],['--pack'],['--check','--publish']]){
    const res=invoke(args);
    assert.equal(res.status,2,res.stderr);
  }
});
