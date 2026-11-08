import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { finalizeOwnedLocalPostgres } from './bostan-local-postgres-safe-finalize.mjs';

const runner = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'bostan-local-postgres-migration-qualification.mjs'), 'utf8');

test('loopback port probe is inside owned-scratch try/finally', () => {
  const scratch = runner.indexOf('const ephemeral = mkdtempSync(');
  const guard = runner.indexOf('  try {\n    // A socket-directory failure must still reach owned-scratch finalization.', scratch);
  const socketSetup = runner.indexOf('mkdirSync(socketDir);', guard);
  const port = runner.indexOf('const port = await availablePort();', scratch);
  const finallyBlock = runner.indexOf('  } finally {\n    const finalized = finalizeOwnedLocalPostgres(', port);
  assert.ok(scratch >= 0 && guard > scratch && socketSetup > guard && port > socketSetup && finallyBlock > port);
});

test('port failure occurs before startup and leaves safe finalizer available', () => {
  const port = runner.indexOf('const port = await availablePort();');
  const start = runner.indexOf('startAttempted = true;', port);
  const finalize = runner.indexOf('const finalized = finalizeOwnedLocalPostgres(', start);
  assert.ok(port >= 0 && start > port && finalize > start);
  assert.match(runner, /let started = false, startAttempted = false;/);
  assert.match(runner, /let isolatedEnv;/);
});

test('never-started owned scratch may be removed without stopping PostgreSQL', () => {
  let stops = 0, removes = 0;
  const result = finalizeOwnedLocalPostgres({
    startAttempted: false, startConfirmed: false,
    stop: () => { stops++; return true; },
    owned: () => true,
    remove: () => { removes++; return true; },
  });
  assert.deepEqual(result, {removed:true,reason:'verified'});
  assert.equal(stops, 0);
  assert.equal(removes, 1);
});

test('unowned scratch after prestart failure remains untouched', () => {
  let stops = 0, removes = 0;
  const result = finalizeOwnedLocalPostgres({
    startAttempted:false, startConfirmed:false,
    stop: () => { stops++; return true; },
    owned: () => false,
    remove: () => { removes++; return true; },
  });
  assert.equal(result.removed, false);
  assert.equal(stops, 0);
  assert.equal(removes, 0);
});
