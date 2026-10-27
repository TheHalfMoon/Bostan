import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {verifyBundledFontNotices} from './bostan-private-bundled-font-license-gate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=fileURLToPath(new URL('./bostan-private-bundled-font-license-gate.mjs',import.meta.url));
const readText=relative=>readFileSync(resolve(root,relative),'utf8');
const invoke=(...args)=>spawnSync(process.execPath,[file,...args],{encoding:'utf8',timeout:12000});

test('Bostan bundled fonts include eight byte-pinned assets and preserve all identified notices',()=>{
  const receipt=verifyBundledFontNotices();
  assert.equal(receipt.passed,true);
  assert.equal(receipt.releaseQualified,false);
  assert.equal(receipt.bundledFonts,8);
  assert.equal(receipt.boardFonts,3);
  assert.equal(receipt.issueThreadFonts,5);
  assert.equal(receipt.noticesPreserved,2);
  assert.equal(receipt.sourceCopyrightPreserved,true);
  assert.equal(receipt.fullDependencyLicenseAuditComplete,false);
});

test('tampered font bytes are refused without editing real source files',()=>{
  assert.throws(()=>verifyBundledFontNotices({
    readBlob:absolute=>absolute.endsWith('InterVariable.woff2')?Buffer.from('synthetic-change'):readFileSync(absolute),
  }),/digest has changed/);
});

test('removing original MIT attribution or bundled font notices fails the audit',()=>{
  for(const [relative,marker] of [
    ['LICENSE','Copyright (c) 2025 Paperclip AI'],
    ['packages/shared/src/cliplab/LICENSE','Jérémy Perret'],
    ['ui/public/fonts/NOTICE.md','Bostan bundles Inter'],
    ['packages/paperclip-runner/devtools/issue-thread/src/fonts/NOTICE.md','Bitstream Vera Fonts license'],
  ]){
    assert.throws(()=>verifyBundledFontNotices({
      readText:source=>source===relative?readText(source).replace(marker,''):readText(source),
    }),/notice incomplete/);
  }
});

test('missing/inconsistent inventory is rejected before acceptance',()=>{
  const path='scripts/bostan-private-bundled-font-inventory.json';
  const inventory=JSON.parse(readText(path));
  for(const tampered of [
    {...inventory,assets:inventory.assets.slice(1)},
    {...inventory,assets:[...inventory.assets.slice(0,7),{...inventory.assets[7],sha256:'a'.repeat(64)}]},
    {...inventory,assets:[...inventory.assets.slice(0,7),{...inventory.assets[0]}]},
    {...inventory,assets:[...inventory.assets.slice(0,7),{...inventory.assets[7],notice:'other/NOTICE.md'}]},
  ]){
    assert.throws(()=>verifyBundledFontNotices({
      readText:source=>source===path?JSON.stringify(tampered):readText(source),
    }));
  }
});

test('read-only default, deliberate check and no publisher/silent mutation paths',()=>{
  for(const args of [[],['--plan']]){
    const result=invoke(...args);assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).run,false);
  }
  const success=invoke('--check');assert.equal(success.status,0,success.stderr);
  assert.equal(JSON.parse(success.stdout).bundledFonts,8);
  for(const args of [['--publish'],['--release'],['--check','--publish']]){
    const result=invoke(...args);assert.equal(result.status,2,result.stderr);
  }
});
