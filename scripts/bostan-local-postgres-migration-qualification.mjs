#!/usr/bin/env node
/**
 * A temporary, disposable, strictly localhost PostgreSQL migration qualification.
 * No user's Bostan database, credentials, global Postgres service, or config are read/written.
 * Requires local initdb, pg_ctl, createdb and psql; does not use Docker or cloud.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, lstatSync, realpathSync, readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeOwnedLocalPostgres } from './bostan-local-postgres-safe-finalize.mjs';
import { buildIsolatedLocalPostgresEnv } from './bostan-local-postgres-isolated-env.mjs';
import { isOwnedClusterDirectory } from './bostan-local-postgres-cluster-ownership.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const identity = 'bostan_verify';
const database = 'bostan_qualification';
const mode = process.argv[2] ?? '--help';

function exec(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', timeout: options.timeout ?? 120_000,
    cwd: options.cwd ?? root, env: options.env ?? process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const tail = String(result.stderr || result.stdout || result.error?.message || '').slice(-1200);
    throw new Error(`${command} failed (exit ${result.status ?? 'unknown'}): ${tail}`);
  }
  return result.stdout.trim();
}

async function availablePort() {
  const socket = createServer();
  try {
    await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok); });
    return socket.address().port;
  } finally { await new Promise(resolve => socket.close(resolve)); }
}

// On Windows, pnpm is a .cmd shim, which spawnSync cannot invoke as a native
// executable. Keep shell tokens fixed; never embed private paths in commands.
function migrateDatabase(env, timeout) {
  const args = ['--filter', '@bostan/db', 'migrate'];
  return process.platform === 'win32'
    ? exec(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'pnpm.cmd', ...args], {env, timeout})
    : exec('pnpm', args, {env, timeout});
}

async function run() {
  // Probe PostgreSQL CLI directly; POSIX path lookup is unavailable on Windows.
  for (const bin of ['initdb', 'pg_ctl', 'createdb', 'psql', 'pg_dump', 'pg_restore']) {
    exec(bin, ['--version'], { timeout: 10_000 });
  }
  // Refuse managed Cloud signals before any scratch database creation.
  exec(process.execPath, [join(root, 'scripts/bostan-private-local-cloud-isolation.mjs'), '--check']);
  const ephemeral = mkdtempSync(join(tmpdir(), 'bostan-pg-qualification-'));
  const cluster = join(ephemeral, 'cluster');
  const socketDir = join(ephemeral, 'sockets');
  const marker = join(ephemeral, 'BOSTAN_OWNED_DISPOSABLE_CLUSTER');
  const markerText = 'This directory belongs only to Bostan local qualification.\n';
  const canonicalScratch = realpathSync(ephemeral);
  const canonicalMarker = join(canonicalScratch, 'BOSTAN_OWNED_DISPOSABLE_CLUSTER');
  // Establish ownership proof before any fallible socket setup. A failed
  // marker write must retain scratch rather than delete an unverified path.
  writeFileSync(marker, markerText);
  let started = false, startAttempted = false;
  let isolatedEnv;
  try {
    // A socket-directory failure must still reach owned-scratch finalization.
    mkdirSync(socketDir);
    // Port reservation may fail. Keep it inside the owned-scratch finalization
    // scope, before any PostgreSQL startup or process invocation.
    const port = await availablePort();
    // Never inherit PGHOSTADDR/PGSERVICE/PGOPTIONS or other ambient libpq controls.
    // PGHOSTADDR can redirect even a libpq client passed -h 127.0.0.1.
    isolatedEnv = buildIsolatedLocalPostgresEnv(process.env, {
      port, identity, database, configPath: join(ephemeral, 'absent-config.json'),
    });
    console.log('Preparing fresh isolated PostgreSQL cluster (loopback only, no existing data).');
    exec('initdb', ['--no-instructions', '--no-sync', '--encoding=UTF8', '--locale=C', `--username=${identity}`, '--auth-local=trust', '--auth-host=trust', '-D', cluster], {timeout:60_000, env:isolatedEnv});
    const postgresArgs = '-c listen_addresses=127.0.0.1 -c port=' + port +
      (process.platform === 'win32' ? '' : ' -c unix_socket_directories=' + socketDir) +
      ' -c fsync=off';
    // A timed-out or failed pg_ctl may have started a background daemon.
    // Never delete scratch unless startup and a later owned stop are proven.
    startAttempted = true;
    exec('pg_ctl', ['-D', cluster, '-l', join(ephemeral, 'postgres.log'), '-o',
      postgresArgs, '-w', 'start'], {timeout:45_000, env:isolatedEnv});
    started = true;
    exec('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', identity, database], {env:isolatedEnv});
    const psql = statement => exec('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', statement], {env:isolatedEnv, timeout:30_000});
    assert.equal(psql('select current_database()'), database, 'must operate only on the newly created scratch DB');
    const initialTables = Number(psql("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"));
    assert.equal(initialTables, 0, 'fresh DB must not have preexisting public tables');
    const first = migrateDatabase(isolatedEnv, 240_000);
    assert.match(first, /Migrations complete/, 'initial migration must finish completely');
    const tableCount = Number(psql("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"));
    const migrationCount = Number(psql('select count(*) from drizzle.__drizzle_migrations'));
    assert.ok(tableCount > 0, 'Bostan must create application schema tables');
    assert.ok(migrationCount > 0, 'the migration journal must record migration history');
    const second = migrateDatabase(isolatedEnv, 120_000);
    assert.match(second, /No pending migrations/, 'repeated application must be idempotent');
    assert.equal(Number(psql('select count(*) from drizzle.__drizzle_migrations')), migrationCount);
    assert.equal(Number(psql("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")), tableCount);
    // A real data round-trip, separate from Bostan's own schema: no product table is mutated.
    psql('create schema bostan_qualification_probe');
    psql('create table bostan_qualification_probe.roundtrip (id integer primary key, evidence text not null)');
    psql("insert into bostan_qualification_probe.roundtrip (id,evidence) values (1,'bostan-restored-data')");
    const archive = join(ephemeral, 'qualification.dump');
    exec('pg_dump', ['-Fc', '-f', archive, '-h', '127.0.0.1', '-p', String(port), '-U', identity, '-d', database], {env:isolatedEnv, timeout:120_000});
    const restoredDb = 'bostan_qualification_restored';
    exec('createdb', ['-h','127.0.0.1','-p',String(port),'-U',identity,restoredDb], {env:isolatedEnv});
    const restoreEnv = {...isolatedEnv, PGDATABASE:restoredDb, DATABASE_URL:`postgres://${identity}@127.0.0.1:${port}/${restoredDb}`};
    exec('pg_restore', ['--exit-on-error','--no-owner','--no-acl','-h','127.0.0.1','-p',String(port),'-U',identity,'-d',restoredDb,archive], {env:restoreEnv, timeout:180_000});
    const restoredSql = statement => exec('psql', ['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',statement], {env:restoreEnv, timeout:30_000});
    assert.equal(restoredSql('select evidence from bostan_qualification_probe.roundtrip where id=1'),'bostan-restored-data');
    assert.equal(Number(restoredSql('select count(*) from drizzle.__drizzle_migrations')), migrationCount);
    assert.equal(Number(restoredSql("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")), tableCount);
    const restoredMigration = migrateDatabase(restoreEnv, 120_000);
    assert.match(restoredMigration, /No pending migrations/, 'a restored database must preserve migration state');
    console.log(JSON.stringify({kind:'bostan.local-postgres-migration.v1',releaseQualified:false,postgresVersion:exec('psql', ['--version']),isolated:true,localhostOnly:true,initialTables,tableCount,migrationJournalEntries:migrationCount,repeatedMigration:'no-op',backupRestore:'verified',restoredMigration:'no-op',roundTripData:'verified',externalServices:false},null,2));
  } finally {
    const finalized = finalizeOwnedLocalPostgres({
      startAttempted, startConfirmed: started,
      stop: () => {
        exec('pg_ctl', ['-D', cluster, '-m', 'immediate', '-w', 'stop'], {timeout:45_000, env:isolatedEnv});
        return true;
      },
      owned: () => {
        if (!existsSync(ephemeral) || !existsSync(marker)) return false;
        const directory = lstatSync(ephemeral), proof = lstatSync(marker);
        return directory.isDirectory() && !directory.isSymbolicLink() &&
          proof.isFile() && !proof.isSymbolicLink() &&
          realpathSync(ephemeral) === canonicalScratch &&
          realpathSync(marker) === canonicalMarker &&
          readFileSync(marker, 'utf8') === markerText &&
          isOwnedClusterDirectory(canonicalScratch, cluster, {allowMissing: !startAttempted});
      },
      remove: () => { rmSync(ephemeral, {recursive:true,force:false}); return true; },
    });
    if (!finalized.removed)
      throw new Error('Bostan local PostgreSQL QA scratch retained: ' + finalized.reason);
  }
}

if (mode === '--help' && process.argv.length <= 3) {
  console.log('Bostan isolated PostgreSQL migration qualification. Run only with --run.');
  console.log('Requires local initdb, pg_ctl, createdb, psql and frozen pnpm workspace dependencies.');
  console.log('Creates and deletes ONLY a new disposable localhost database in the system temp folder.');
} else if (mode === '--run' && process.argv.length <= 3) {
  await run().catch(error => { console.error(`Bostan local database qualification FAILED: ${error.message}`); process.exitCode = 1; });
} else {
  console.error('Usage: node scripts/bostan-local-postgres-migration-qualification.mjs [--help|--run]');
  process.exitCode = 2;
}
