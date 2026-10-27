import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('./bostan-private-staged-full-app-acceptance.sh',import.meta.url));
const source=readFileSync(path,'utf8');
const invoke=args=>spawnSync('bash',[path,...args],{encoding:'utf8',timeout:4000});
// This is an actual macOS/Linux Bash entrypoint; Windows is source-only QA.
// Avoid invoking WSL's bash.exe as if it were a native Windows stage.
const bashOnly=process.platform==='win32'?test.skip:test;
bashOnly('all-in-one stage acceptance is read-only by default and fail-closed on other commands',()=>{
  for(const args of [[],['--plan']]){
    const r=invoke(args);assert.equal(r.status,0,r.stderr);
    assert.match(r.stdout,/No native end-user installer/);
  }
  assert.match(invoke(['--plan']).stdout,/--run-relocated/);
  assert.match(invoke(['--plan']).stdout,/--run-relocated-authz/);
  assert.match(invoke(['--plan']).stdout,/--run-relocated-authz-ui/);
  assert.match(invoke(['--plan']).stdout,/--run-relocated-admin-race/);
  for(const args of [['--publish'],['--run','--deploy'],['--help']]){
    const r=invoke(args);assert.equal(r.status,2,r.stderr);assert.equal(r.stdout,'');
  }
});
test('real full-app private QA isolates provider credentials, offline deploy, temporary stage and browser',()=>{
  for(const required of [
    'npm_config_offline=true','--offline --frozen-lockfile --ignore-scripts',
    'deploy --prod --offline --ignore-scripts',
    'bostan-private-compiled-server-http-qualification.sh --run',
    'pnpm --filter @bostan/ui build','prepare-server-ui-dist.sh',
    'bostan-private-staged-server-check.mjs --repair-owned-self-link',
    'bostan-private-staged-server-check.mjs --verify',
    'bostan-private-bundled-font-license-gate.mjs --check',
    'bostan-private-bundled-font-license-gate.mjs --verify-stage "$STAGE/ui-dist"',
    'BOSTAN_STAGE_BROWSER_E2E=1','BOSTAN_STAGE_CRUD_E2E=1','--run-deployed "$STAGE"',
    'BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS',
  ])assert.ok(source.includes(required),required);
  assert.match(source,/mktemp -d \"\$STAGE_ROOT\/bostan-staged-server-/);
  assert.match(source,/rm -rf -- "\$STAGE"/);
  assert.match(source,/--run-relocated/);
  assert.match(source,/RELOCATED_STAGE=\"\$\(mktemp -d/);
  assert.match(source,/rmdir \"\$RELOCATED_STAGE\"/);
  assert.match(source,/mv \"\$STAGE\" \"\$RELOCATED_STAGE\"/);
  assert.match(source,/node scripts\/bostan-private-staged-server-check\.mjs --verify \"\$STAGE\"/);
  assert.equal(source.split('--verify-stage "$STAGE/ui-dist"').length-1,2,
    'packed UI fonts must be verified both before and after relocation');
  assert.match(source,/BOSTAN_PRIVATE_STAGED_RELOCATION_ACCEPTANCE_PASS/);
  assert.match(source,/--run-deployed-authz/);
  assert.match(source,/--run-deployed-authz-ui/);
  assert.match(source,/--run-deployed-admin-race/);
  assert.match(source,/BOSTAN_PRIVATE_RELOCATED_ADMIN_RACE_ACCEPTANCE_PASS/);
  assert.match(source,/BOSTAN_PRIVATE_RELOCATED_MEMBER_BROWSER_ACCEPTANCE_PASS/);
  assert.match(source,/BOSTAN_PRIVATE_RELOCATED_TWO_SESSION_AUTHZ_ACCEPTANCE_PASS/);
  assert.match(source,/4194304/);
  assert.match(source,/BOSTAN_LINUX_PRIVATE_TMPFS_QA/);
  assert.match(source,/bostan-private-linux-tmpfs-admission.mjs --check/);
  assert.match(source,/BOSTAN_LINUX_TMPFS_EXPLICIT_RESOURCE_ADMISSION_PASS/);
  assert.match(source,/MIN_STAGE_FREE_KIB=3670016/);
  assert.match(source,/export npm_config_optional=false/);
  assert.match(source,/BOSTAN_LINUX_REQUIRED_DEPENDENCIES_ONLY_QA/);
  assert.ok(source.includes('for disk in "$ROOT" "$STAGE_ROOT"; do'));
  assert.doesNotMatch(source,/npm publish|gh release create|cargo build --release/);
});
