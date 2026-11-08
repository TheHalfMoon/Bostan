import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./bostan-private-linux-native-prebuilt-stage-authz.sh',import.meta.url));
const source=readFileSync(script,'utf8');
const run=(...args)=>spawnSync('bash',[script,...args],{encoding:'utf8',timeout:5000});
test('private Linux native prebuilt stage is inert by default, no publication',()=>{
  for(const args of [[],['--plan']]){
    const result=run(...args);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/prebuilt-stage qualification/);
    assert.match(result.stdout,/--run-admin-race/);
    assert.match(result.stdout,/--run-authz-ui/);
  }
  for(const args of [['--publish'],['--run'],['--run-authz','--publish'],['--run-admin-race','--publish'],['--run-authz-ui','--publish']]){
    const result=run(...args);
    assert.equal(result.status,2,result.stderr);
  }
  assert.doesNotMatch(source,/\bpnpm\s+(?:publish|release)\b/);
});
test('refuses non-Linux host and without explicit private tmpfs admission',()=>{
  if(process.platform!=='linux'){
    assert.equal(run('--run-authz').status,2);
    assert.equal(run('--run-admin-race').status,2);
    assert.equal(run('--run-authz-ui').status,2);
  }else{
    const noOptIn=spawnSync('bash',[script,'--run-authz'],{
      env:{...process.env,BOSTAN_LINUX_PRIVATE_TMPFS_QA:'0'},
      encoding:'utf8',timeout:5000
    });
    assert.equal(noOptIn.status,2,noOptIn.stderr);
  }
});
test('prebuilt stage keeps native Linux code, resource, source and vendor gates',()=>{
  for(const marker of [
    'bostan-private-linux-native-runtime-preflight.mjs --check',
    'BOSTAN_LINUX_NATIVE_TOOLCHAIN_EARLY_ADMITTED',
    'bostan-private-linux-tmpfs-admission.mjs --check',
    'bostan-private-linux-native-build-closure.mjs --check',
    'bostan-private-bundled-font-license-gate.mjs --check',
    'build-info.json',
    'git merge-base --is-ancestor',
    'git diff --quiet',
    'verify-runner-vendor-dependencies.mjs',
    '4194304',
    'bostan-private-staged-server-check.mjs --stage-root',
    'bostan-private-staged-server-check.mjs --repair-owned-self-link',
    'bostan-private-staged-server-check.mjs --verify',
    'bostan-private-bundled-font-license-gate.mjs --verify-stage',
    'BOSTAN_LINUX_NATIVE_TMPFS_STAGE_VERIFIED',
    'BOSTAN_LINUX_NATIVE_STAGED_POSTGRES_AUTHZ_PASS',
    'BOSTAN_LINUX_NATIVE_QA_CLEANUP',
  ])assert.ok(source.includes(marker),marker);
});
test('no bypass of actual compiled UI, deploy, SQL authz or safe stage ownership',()=>{
  for(const marker of [
    'BOSTAN_LINUX_PRIVATE_TMPFS_QA',
    'pnpm --filter @bostan/ui build',
    'PAPERCLIP_RELEASE_REUSE_UI_DIST=1',
    'pnpm --filter @bostan/server deploy --prod --offline --ignore-scripts',
    'bostan-staged-server-XXXXXXXX',
    'bostan-staged-server-????????',
    '--run-deployed-authz "$STAGE"',
    'rm -rf -- "$STAGE"',
    'DO_NOT_TRACK=1',
    'OTEL_SDK_DISABLED=true'
  ])assert.ok(source.includes(marker),marker);
  assert.doesNotMatch(source,/\b(?:rm -rf|rm -r|rmdir)\s+["']?\$ROOT\b/);
  assert.match(source,/--run-deployed-admin-race/);
  assert.match(source,/--run-deployed-authz-ui/);
  assert.match(source,/BOSTAN_LINUX_NATIVE_STAGED_CHROMIUM_AUTHZ_UI_PASS/);
  assert.match(source,/import\('@playwright\/test'\)/);
  assert.match(source,/BOSTAN_LINUX_NATIVE_STAGED_POSTGRES_FIRST_ADMIN_RACE_PASS/);
  assert.match(source,/\[ "\$MODE" = --run-admin-race \]/);
  assert.match(source,/unset OPENAI_API_KEY/);
  assert.match(source,/export DO_NOT_TRACK=1/);
});
