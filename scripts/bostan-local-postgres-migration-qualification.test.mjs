import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('./bostan-local-postgres-migration-qualification.mjs',import.meta.url));
const source=readFileSync(script,'utf8');
const invoke=(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
test('default help is read-only and never creates a database',()=>{
  const output=invoke();
  assert.equal(output.status,0,output.stderr);
  assert.match(output.stdout,/Run only with --run/);
  assert.match(output.stdout,/disposable localhost database/);
});
test('unknown arguments fail closed instead of running migration',()=>{
  const output=invoke('--migrate');
  assert.equal(output.status,2);
  assert.match(output.stderr,/Usage:/);
});
test('live PostgreSQL qualification must isolate cluster and always stop it before cleanup',()=>{
  assert.match(source,/mkdtempSync\(join\(tmpdir\(\), 'bostan-pg-qualification-'\)\)/);
  assert.match(source,/socket\.listen\(0, '127\.0\.0\.1'/);
  assert.match(source,/listen_addresses=127\.0\.0\.1/);
  assert.match(source,/initialTables, 0/);
  assert.match(source,/DATABASE_URL: connectionString/);
  assert.match(source,/PAPERCLIP_CONFIG: join\(ephemeral, 'absent-config\.json'\)/);
  assert.match(source,/pg_restore/);
  assert.match(source,/bostan_qualification_probe\.roundtrip/);
  assert.match(source,/restoredMigration, \/No pending migrations\//);
  assert.match(source,/pg_ctl', \['-D', cluster, '-m', 'immediate', '-w', 'stop'/);
  assert.match(source,/releaseQualified:false/);
});

test('Windows PostgreSQL smoke is portable and does not rely on Unix which',()=>{
  assert.doesNotMatch(source, /exec\('which'/);
  assert.match(source, /exec\(bin, \['--version'\]/);
  assert.match(source, /process\.platform === 'win32'/);
  assert.match(source, /'pnpm\.cmd'/);
  assert.match(source, /'cmd\.exe'/);
  assert.match(source, /migrateDatabase\(restoreEnv, 120_000\)/);
  assert.match(source, /bostan-private-local-cloud-isolation\.mjs/);
  assert.match(source, /process\.platform === 'win32' \? '' : ' -c unix_socket_directories='/);
});
