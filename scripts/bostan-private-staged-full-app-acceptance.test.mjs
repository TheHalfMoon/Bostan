import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('./bostan-private-staged-full-app-acceptance.sh',import.meta.url));
const source=readFileSync(path,'utf8');
const invoke=args=>spawnSync('bash',[path,...args],{encoding:'utf8',timeout:4000});
test('all-in-one stage acceptance is read-only by default and fail-closed on other commands',()=>{
  for(const args of [[],['--plan']]){
    const r=invoke(args);assert.equal(r.status,0,r.stderr);
    assert.match(r.stdout,/No native end-user installer/);
  }
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
    'BOSTAN_STAGE_BROWSER_E2E=1','--run-deployed "$STAGE"',
    'BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS',
  ])assert.ok(source.includes(required),required);
  assert.match(source,/mktemp -d \"\$STAGE_ROOT\/bostan-staged-server-/);
  assert.match(source,/rm -rf -- "\$STAGE"/);
  assert.match(source,/4194304/);
  assert.ok(source.includes('for disk in "$ROOT" "$STAGE_ROOT"; do'));
  assert.doesNotMatch(source,/npm publish|gh release create|cargo build --release/);
});
