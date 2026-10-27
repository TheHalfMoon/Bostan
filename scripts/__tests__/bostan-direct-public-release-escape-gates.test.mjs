import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const shell=['scripts/rollback-latest.sh','scripts/e2e-update-migrations.sh','scripts/build-npm.sh'];
// On native Windows use Git for Windows Bash, never WSL's system32 bash.exe.
const bash=process.platform==='win32'
  ? join(process.env.ProgramFiles || 'C:\\Program Files','Git','bin','bash.exe')
  : '/bin/bash';
for(const relative of shell){
  test(`${relative} cannot invoke inherited donor registry actions`,()=>{
    const text=readFileSync(join(repo,relative),'utf8');
    const i=text.indexOf('Bostan: inherited public npm/release workflow disabled');
    assert.ok(i>0 && i<500, 'must fail before shell executable body');
    assert.ok(text.indexOf('exit 2',i)>i && text.indexOf('exit 2',i)<650);
    assert.ok(existsSync(bash),'native Git Bash or /bin/bash is required for direct-shell safety proof');
    const home=mkdtempSync(join(tmpdir(),'bostan-disabled-shell-'));
    try {
      for(const args of [[],['--help'],['--dry-run'],['--yes']]){
        const result=spawnSync(bash,[join(repo,relative),...args],{
          cwd:home,env:{HOME:home,PATH:'/usr/bin:/bin',E2E_REPO:'paperclipai/paperclip'},encoding:'utf8',timeout:5000,
        });
        assert.equal(result.status,2,`${relative}: ${result.stderr}`);
        assert.match(result.stderr,/Bostan: inherited public npm\/release workflow disabled/);
        assert.equal(result.stdout,'');
      }
      assert.deepEqual(readdirSync(home),[],'HOME must never be modified');
    } finally {rmSync(home,{recursive:true,force:true})}
  });
}
test('direct donor bootstrap cannot read registry, generate packages, or publish',()=>{
  const script=join(repo,'scripts/bootstrap-npm-package.mjs');
  const text=readFileSync(script,'utf8');
  assert.match(text,/if \(isDirectRun\)/);
  assert.match(text,/process\.exitCode = 2;/);
  const home=mkdtempSync(join(tmpdir(),'bostan-disabled-npm-bootstrap-'));
  try {
    for(const args of [[],['--help'],['@paperclipai/example','--publish'],['@bostan/example','--publish']]) {
      const result=spawnSync(process.execPath,[script,...args],{
        cwd:home,env:{...process.env,HOME:home,npm_config_registry:'https://registry.npmjs.org/'},encoding:'utf8',timeout:5000,
      });
      assert.equal(result.status,2,result.stderr);
      assert.match(result.stderr,/Bostan: inherited public npm\/release workflow disabled/);
      assert.equal(result.stdout,'');
    }
    assert.deepEqual(readdirSync(home),[]);
  } finally {rmSync(home,{recursive:true,force:true})}
});
test('native Bostan source QA remains present after blocking inherited release shortcuts',()=>{
  const qa=readFileSync(join(repo,'scripts/bostan-no-model-acceptance.mjs'),'utf8');
  assert.match(qa,/bostan.no-model-private-acceptance.v1/);
  assert.match(qa,/releaseQualified:false/);
});
