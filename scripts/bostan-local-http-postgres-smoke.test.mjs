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
  assert.match(contents,/--run-deployed-authz/);
  assert.match(contents,/--run-deployed-authz-ui/);
  assert.match(contents,/--run-packed-authz-ui/);
  assert.match(contents,/BOSTAN_PACKED_SERVER_CHROMIUM_AUTHZ_UI_QUALIFIED/);
  assert.match(contents,/BOSTAN_PACKED_UI_REQUIRES_NATIVE_MAC_QA/);
  assert.match(contents,/BOSTAN_PACKED_UI_REQUIRES_OWNED_CHROMIUM/);
  assert.ok(contents.includes('if [ "$MODE" = "--run-deployed-authz-ui" ] || [ "$MODE" = "--run-packed-authz-ui" ]; then'));
  assert.match(contents,/--run-deployed-admin-race/);
  assert.match(contents,/BOSTAN_PORTABLE_STAGED_FIRST_ADMIN_RACE_QUALIFIED/);
  assert.match(contents,/BOSTAN_AUTHZ_BROWSER_UI=1/);
  assert.match(contents,/BOSTAN_PORTABLE_STAGED_AUTHENTICATED_TWO_SESSION_QUALIFIED/);
  assert.match(contents,/bootstrap_pending/);
  assert.match(contents,/BOSTAN_TEST_ONLY_SENTINEL/);
  assert.match(contents,/BOSTAN_STAGE_CRUD_E2E/);
  assert.match(contents,/bostan-private-staged-crud\.mjs --run --url/);
  assert.match(contents,/node_modules\/@bostan\/db\/dist\/migrate\.js/);
  assert.match(contents,/bootstrapStatus==="ready"/);
  assert.match(contents,/bostan-private-local-cloud-isolation.mjs" --check/);
  assert.match(contents,/Object.hasOwn\(data, 'cloud'\)/);
  assert.match(contents,/externalCloudConfigured:false/);
  assert.match(contents,/HEALTH_ATTEMPTS=90/);
  assert.match(contents,/HEALTH_ATTEMPTS=300/);
  assert.match(contents,/BOSTAN_LINUX_PRIVATE_COLD_BOOT_QA/);
  assert.match(contents,/BOSTAN_LINUX_PRIVATE_TMPFS_QA/);
  assert.match(contents,/bostan-private-linux-tmpfs-admission.mjs.*--check/);
  assert.match(contents,/BOSTAN_HTTP_BOOT_PENDING/);
  assert.match(contents,/BOSTAN_HTTP_STARTUP_DIAGNOSTIC_LOG_EMPTY/);
  assert.match(contents,/bostan-private-staged-server-check\.mjs.*--stage-root/);
  assert.match(contents,/TMP_ROOT.*bostan-live-http/);
  assert.match(contents,/case \"\$TMP\" in \"\$TMP_ROOT\"/);
  assert.match(contents,/524288/);
  assert.doesNotMatch(contents,/mktemp -d \/private\/tmp/);
  assert.match(contents,/pg_ctl -D "\$PGDATA" -m immediate -w stop/);
  assert.match(contents,/kill -TERM "\$SPID"/);
  assert.doesNotMatch(contents,/\b(?:publish|deploy|release)\s+\S+\s*$/m);
});


test('packed Chromium mode fails before PostgreSQL creation without an owned browser',()=>{
  const result=spawnSync('bash',[script,'--run-packed-authz-ui'],{
    encoding:'utf8',timeout:20000,
    env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:''},
  });
  assert.equal(result.status,2);
  assert.match(result.stderr,/BOSTAN_PACKED_UI_REQUIRES_OWNED_CHROMIUM/);
  assert.doesNotMatch(result.stdout,/MIGRATED|BOSTAN_BOOT_BANNER_QUALIFIED/);
});

test('actual local PostgreSQL HTTP runner refuses inherited Cloud keys before making a QA database',()=>{
  const result=spawnSync('bash',[script,'--run'],{
    encoding:'utf8',timeout:5000,
    env:{...process.env,PAPERCLIP_CLOUD_TENANT_SERVER_TOKEN:'fixture-secret-must-not-print'},
  });
  assert.equal(result.status,2,result.stderr);
  assert.match(result.stderr,/PAPERCLIP_CLOUD_TENANT_SERVER_TOKEN/);
  assert.ok(!result.stderr.includes('fixture-secret-must-not-print'));
  assert.doesNotMatch(result.stdout,/MIGRATED|CLEANUP_COMPLETED|BOSTAN_BOOT_BANNER_QUALIFIED/);
});
