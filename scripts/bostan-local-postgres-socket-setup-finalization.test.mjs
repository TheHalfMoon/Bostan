import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { finalizeOwnedLocalPostgres } from './bostan-local-postgres-safe-finalize.mjs';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'bostan-local-postgres-migration-qualification.mjs'), 'utf8');

test('socket setup occurs after marker proof and within finalization scope', () => {
  const start = source.indexOf('const ephemeral = mkdtempSync(');
  const marker = source.indexOf('writeFileSync(marker, markerText);', start);
  const guard = source.indexOf('  try {\n    // A socket-directory failure', marker);
  const socket = source.indexOf('mkdirSync(socketDir);', guard);
  const port = source.indexOf('const port = await availablePort();', socket);
  const cleanup = source.indexOf('  } finally {\n    const finalized = finalizeOwnedLocalPostgres(', port);
  assert.ok(start >= 0 && marker > start && guard > marker && socket > guard && port > socket && cleanup > port);
  assert.equal(source.slice(start, guard).includes('mkdirSync(socketDir);'), false);
});

test('prestart socket failure uses safe finalizer without stop', () => {
  let stops = 0, removes = 0;
  const result = finalizeOwnedLocalPostgres({
    startAttempted: false, startConfirmed: false,
    stop: () => { stops++; return true; },
    owned: () => true,
    remove: () => { removes++; return true; },
  });
  assert.deepEqual(result, { removed: true, reason: 'verified' });
  assert.equal(stops, 0);
  assert.equal(removes, 1);
});

test('prestart failure with missing or untrusted proof retains scratch', () => {
  let stops = 0, removes = 0;
  const result = finalizeOwnedLocalPostgres({
    startAttempted: false, startConfirmed: false,
    stop: () => { stops++; return true; },
    owned: () => false,
    remove: () => { removes++; return true; },
  });
  assert.equal(result.removed, false);
  assert.equal(stops, 0);
  assert.equal(removes, 0);
});
