import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectLinks,repairOwnedSelfLink,verifyStage,portableStagingRoot,verifiedStagingRoot} from './bostan-private-staged-server-check.mjs';
const script=fileURLToPath(new URL('./bostan-private-staged-server-check.mjs',import.meta.url));
const smoke=fileURLToPath(new URL('./bostan-local-http-postgres-smoke.sh',import.meta.url));
function fixture(){
  const parent=mkdtempSync(join(verifiedStagingRoot(),'bostan-staged-qa-tests-'));
  const stage=join(parent,'bostan-staged-server-fixture');
  const source=join(parent,'bostan-source-fixture');
  mkdirSync(stage,{recursive:true});mkdirSync(join(source,'server'),{recursive:true});
  const file=(name,data='fixture')=>{let p=join(stage,name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,data)};
  file('package.json',JSON.stringify({name:'@bostan/server',private:true,scripts:{start:'node --conditions=bostan-compiled dist/index.js'}}));
  return {parent,stage,source,file,cleanup:()=>rmSync(parent,{recursive:true,force:true})};
}
function fillValidStage(f){
  for(const path of [
    'dist/index.js','dist/build-info.json','dist/vendor/paperclip-runner/index.js',
    'node_modules/@bostan/db/dist/index.js','node_modules/@bostan/db/dist/migrate.js',
    'node_modules/@bostan/db/dist/migrations/meta/_journal.json',
    'node_modules/@bostan/shared/dist/index.js',
    'node_modules/@bostan/adapter-codex-local/dist/server/index.js',
    'node_modules/@bostan/adapter-codex-local/dist/server/codex-auth-merge-extract.sh',
    'node_modules/@bostan/plugin-sdk/dist/index.js',
    'node_modules/@anthropic-ai/sdk/package.json',
    'node_modules/@bostan/skills-catalog/dist/src/index.js',
  ])f.file(path);
  for(let i=0;i<375;i++)f.file(`node_modules/@bostan/db/dist/migrations/${i}.sql`);
}
test('Linux and macOS use fixed safe system staging roots regardless of TMPDIR',()=>{
  assert.equal(portableStagingRoot('linux'),'/tmp');
  assert.equal(portableStagingRoot('darwin'),'/private/tmp');
  assert.throws(()=>portableStagingRoot('win32'),/macOS\/Linux only/);
  const allowed=verifiedStagingRoot();
  const changed=process.env.TMPDIR;
  try {
    process.env.TMPDIR='/tmp/nonexistent-untrusted-home-location';
    assert.equal(verifiedStagingRoot(),allowed);
    const result=spawnSync(process.execPath,[script,'--stage-root'],{encoding:'utf8',timeout:5000,env:{...process.env,TMPDIR:'/tmp/bostan-untrusted'}});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout.trim(),allowed);
  }finally{if(changed===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=changed;}
});
test('stage inspection is read-only and confirms package, migrations and internal links',()=>{
  const f=fixture();try{
    fillValidStage(f);
    const result=verifyStage(f.stage);
    assert.equal(result.validated,true);assert.equal(result.releaseQualified,false);
    assert.equal(result.sqlMigrationFiles,375);assert.equal(result.foreignLinks,0);
    const cli=spawnSync(process.execPath,[script,'--verify',f.stage],{encoding:'utf8',timeout:5000});
    assert.equal(cli.status,0,cli.stderr);
    assert.equal(JSON.parse(cli.stdout).browserUIIncluded,false);
    rmSync(join(f.stage,'node_modules/@anthropic-ai/sdk/package.json'));
    assert.throws(()=>verifyStage(f.stage),/anthropic-ai\/sdk/);
  }finally{f.cleanup();}
});
test('staging check refuses external, broken and symlinked stage roots',()=>{
  const f=fixture();try{
    fillValidStage(f);
    const foreign=join(f.parent,'secrets');f.file('node_modules/probe.js','probe');writeFileSync(foreign,'secret');
    symlinkSync(foreign,join(f.stage,'node_modules/escapes'));
    assert.throws(()=>verifyStage(f.stage),/escapes private deployment/);
    rmSync(join(f.stage,'node_modules/escapes'));
    symlinkSync(join(f.parent,'missing'),join(f.stage,'node_modules/broken'));
    assert.throws(()=>inspectLinks(f.stage),/Broken stage link/);
    const pointed=join(f.parent,'pointed');symlinkSync(f.stage,pointed,'dir');
    assert.throws(()=>verifyStage(pointed),/real directory/);
  }finally{f.cleanup();}
});
test('only an exact source checkout self-link is atomically repaired to the owned stage',()=>{
  const f=fixture();try{
    const link=join(f.stage,'node_modules/.pnpm/node_modules/@bostan/server');
    mkdirSync(dirname(link),{recursive:true});symlinkSync(join(f.source,'server'),link,'dir');
    assert.throws(()=>inspectLinks(f.stage),/escapes private deployment/);
    assert.throws(()=>repairOwnedSelfLink(f.stage,join(f.parent,'incorrect-source')));
    assert.equal(realpathSync(link),realpathSync(join(f.source,'server')));
    assert.deepEqual(repairOwnedSelfLink(f.stage,f.source),{status:'repaired-only-generated-self-link'});
    assert.equal(realpathSync(link),realpathSync(f.stage));
    assert.equal(repairOwnedSelfLink(f.stage,f.source).status,'already-internal');
    assert.equal(inspectLinks(f.stage),1);
  }finally{f.cleanup();}
});
test('self-link repair refuses foreign targets and non-disposable stage locations',()=>{
  const f=fixture();try{
    const link=join(f.stage,'node_modules/.pnpm/node_modules/@bostan/server');
    mkdirSync(dirname(link),{recursive:true});symlinkSync(f.parent,link,'dir');
    assert.throws(()=>repairOwnedSelfLink(f.stage,f.source),/Unexpected foreign symlink/);
    assert.equal(realpathSync(link),realpathSync(f.parent));
    assert.throws(()=>repairOwnedSelfLink(f.stage,relative('.',f.source)),/explicit and absolute/);
    const renamed=join(f.parent,'other-workspace');
    mkdirSync(renamed);writeFileSync(join(renamed,'package.json'),readFileSync(join(f.stage,'package.json')));
    assert.throws(()=>repairOwnedSelfLink(renamed,f.source),/disposable Bostan stage/);
  }finally{f.cleanup();}
});
test('CLI refuses implicit unsafe operations and source smoke remains opt-in',()=>{
  const help=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.equal(help.status,0);assert.match(help.stdout,/No publish\/install/);
  assert.equal(spawnSync(process.execPath,[script,'--publish'],{encoding:'utf8'}).status,2);
  for(const args of [[],['--run-deployed'],['--run-deployed','relative/stage'],['--publish']]){
    const r=spawnSync('bash',[smoke,...args],{encoding:'utf8',timeout:3000});
    assert.equal(r.status,2,`${args}: ${r.stderr}`);
  }
});
