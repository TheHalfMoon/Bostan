import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const bash=process.platform==='win32'?'C:\\Program Files\\Git\\bin\\bash.exe':'/bin/bash';
const inherited=[
  'scripts/install.sh',
  'scripts/e2e-install-lifecycle.sh',
  'scripts/release.sh',
  'scripts/create-github-release.sh',
];
for(const name of inherited){
  test(`${name} denies inherited public actions before any side effect`,()=>{
    const path=join(root,name);
    const text=readFileSync(path,'utf8');
    const guard=text.indexOf('Bostan: inherited public install/release entrypoint disabled');
    const exit=text.indexOf('\nexit 2\n',guard);
    assert.ok(guard>0 && guard<700,`guard must precede all inherited ${name} logic`);
    assert.ok(exit>guard && exit<900,`exit must immediately follow ${name} guard`);
    assert.match(text.slice(0,guard),/^#!\/.*\n(?:#.*\n)*printf /);
    if(!existsSync(bash))return;
    const home=mkdtempSync(join(tmpdir(),'bostan-legacy-no-publish-'));
    try {
      for(const args of [[],['--help'],['--dry-run'],['--yes']]) {
        const result=spawnSync(bash,[path,...args],{
          cwd:home,env:{...process.env,HOME:home,E2E_REPO:'paperclipai/paperclip'},
          encoding:'utf8',timeout:6_000,
        });
        assert.equal(result.status,2,`${name} ${args}: ${result.stderr}`);
        assert.match(result.stderr,/Bostan: inherited public install\/release entrypoint disabled/);
        assert.equal(result.stdout,'','no inherited public installer output');
      }
      assert.deepEqual(readdirSync(home),[],'cannot install or modify temporary user HOME');
    } finally {rmSync(home,{recursive:true,force:true});}
  });
}
test('native Bostan QA remains independent of retired public scripts',()=>{
  const code=readFileSync(join(root,'scripts/bostan-no-model-acceptance.mjs'),'utf8');
  assert.match(code,/bostan.no-model-private-acceptance.v1/);
  assert.match(code,/releaseQualified:false/);
});
