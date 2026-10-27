import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./bostan-local-http-postgres-smoke.sh',import.meta.url));
const contents=readFileSync(script,'utf8');
function call(arg){return spawnSync('bash',[script,...(arg?[arg]:[])],{encoding:'utf8',timeout:5000});}
test('HTTP smoke is opt-in and --help is read-only',()=>{
  const help=call('--help');assert.equal(help.status,0);assert.match(help.stdout,/Run with:/);assert.match(help.stdout,/--run-dist/);assert.match(help.stdout,/--run-deployed/);
  assert.equal(call().status,2);
  assert.equal(call('--publish').status,2);
});
test('HTTP smoke uses disposable localhost postgres and isolated Bostan instance only',()=>{
  for(const name of ['mktemp -d "$TMP_ROOT/bostan-live-http.','BOSTAN_TEMP_OWNED','PAPERCLIP_HOME="$TMP/bostan-home"','PAPERCLIP_CONFIG="$TMP/bostan-config.json"','listen_addresses=127.0.0.1','HOST=127.0.0.1','PORT="$HTTPPORT"','DATABASE_URL=', 'BOSTAN_FEEDBACK_EXPORT_ENABLED=0','externalModelsUsed:false']) assert.ok(contents.includes(name),name);
  assert.match(contents,/node --import tsx src\/index\.ts/);
  assert.match(contents,/node --conditions=bostan-compiled dist\/index\.js/);
  assert.match(contents,/BOSTAN_PORTABLE_STAGED_UI_HTTP_QUALIFIED/);
  assert.match(contents,/BOSTAN_PORTABLE_STAGED_BROWSER_QUALIFIED/);
  assert.match(contents,/BOSTAN_PORTABLE_STAGED_COMPANY_TASK_API_QUALIFIED/);
  assert.match(contents,/BOSTAN_STAGE_CRUD_E2E/);
  assert.match(contents,/bostan-private-staged-crud\.mjs --run --url/);
  assert.match(contents,/node_modules\/@bostan\/db\/dist\/migrate\.js/);
  assert.match(contents,/bootstrapStatus==="ready"/);
  assert.match(contents,/bostan-private-staged-server-check\.mjs.*--stage-root/);
  assert.match(contents,/TMP_ROOT.*bostan-live-http/);
  assert.match(contents,/case \"\$TMP\" in \"\$TMP_ROOT\"/);
  assert.match(contents,/524288/);
  assert.doesNotMatch(contents,/mktemp -d \/private\/tmp/);
  assert.match(contents,/pg_ctl -D "\$PGDATA" -m immediate -w stop/);
  assert.match(contents,/kill -TERM "\$SPID"/);
  assert.doesNotMatch(contents,/\b(?:publish|deploy|release)\s+\S+\s*$/m);
});
