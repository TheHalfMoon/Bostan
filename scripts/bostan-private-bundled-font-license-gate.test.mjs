import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {tmpdir} from 'node:os';
import {verifyBundledFontNotices,verifyStagedBoardFonts} from './bostan-private-bundled-font-license-gate.mjs';
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
    ['ui/public/fonts/Inter-OFL.txt','Copyright (c) 2016 The Inter Project Authors'],
    ['packages/bostan-runner/devtools/issue-thread/src/fonts/NOTICE.md','Bitstream Vera Fonts license'],
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


function stagedUiFixture(){
  const parent=mkdtempSync(join(tmpdir(),'bostan-font-stage-'));
  const ui=join(parent,'ui-dist');
  mkdirSync(join(ui,'fonts'),{recursive:true});
  for(const name of readdirSync(resolve(root,'ui/public/fonts'))){
    if(name.endsWith('.woff2')||['NOTICE.md','PaperMono-OFL.txt','Inter-OFL.txt'].includes(name))
      copyFileSync(resolve(root,'ui/public/fonts',name),join(ui,'fonts',name));
  }
  return {ui,clean:()=>rmSync(parent,{recursive:true,force:true})};
}

test('actual staged UI font and license copies are byte-identical to inventoried source',()=>{
  const fixture=stagedUiFixture();
  try{
    const receipt=verifyStagedBoardFonts(fixture.ui);
    assert.equal(receipt.passed,true);
    assert.equal(receipt.stagedBoardFonts,3);
    assert.equal(receipt.stagedLegalFiles,3);
    assert.equal(receipt.fullDependencyLicenseAuditComplete,false);
    const cli=invoke('--verify-stage',fixture.ui);
    assert.equal(cli.status,0,cli.stderr);
    assert.equal(JSON.parse(cli.stdout).byteIdenticalAssets,true);
  }finally{fixture.clean()}
});

test('staged Bostan UI cannot silently modify or drop its font license',()=>{
  for(const name of ['NOTICE.md','PaperMono-OFL.txt','Inter-OFL.txt']){
    const fixture=stagedUiFixture();
    try{
      writeFileSync(join(fixture.ui,'fonts',name),'synthetic damaged license');
      assert.throws(()=>verifyStagedBoardFonts(fixture.ui),/NOTICE differs/);
    }finally{fixture.clean()}
  }
});

test('staged WOFF2 tampering and unreviewed extra WOFF2 fail closed',()=>{
  const fixture=stagedUiFixture();
  try{
    writeFileSync(join(fixture.ui,'fonts','InterVariable.woff2'),'synthetic corrupt');
    assert.throws(()=>verifyStagedBoardFonts(fixture.ui),/does not match/);
  }finally{fixture.clean()}
  const extra=stagedUiFixture();
  try{
    writeFileSync(join(extra.ui,'fonts','unreviewed.woff2'),'synthetic');
    assert.throws(()=>verifyStagedBoardFonts(extra.ui),/Unreviewed or missing/);
  }finally{extra.clean()}
});

test('staged font path must be a real UI dist and must not redirect via symlink',()=>{
  assert.throws(()=>verifyStagedBoardFonts('/definitely-not-a-bostan-ui-dist'),/ui-dist/);
  const fixture=stagedUiFixture();
  try{
    const filename=join(fixture.ui,'fonts','InterVariable.woff2');
    rmSync(filename);
    // Linux/macOS privileged symlinks can be created; Windows may refuse it.
    try{symlinkSync(resolve(root,'ui/public/fonts/InterVariable.woff2'),filename,'file');}
    catch(error){
      if(process.platform==='win32'&&['EPERM','EACCES'].includes(error?.code))return;
      throw error;
    }
    assert.throws(()=>verifyStagedBoardFonts(fixture.ui),/Unsafe staged Bostan font/);
  }finally{fixture.clean()}
});
