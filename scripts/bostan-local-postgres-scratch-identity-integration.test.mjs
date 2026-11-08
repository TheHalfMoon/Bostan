import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./bostan-local-postgres-migration-qualification.mjs', import.meta.url), 'utf8');
test('actual local PG qualification captures the freshly created marker before fallible setup', () => {
  const scratch=source.indexOf('const ephemeral = mkdtempSync(');
  const write=source.indexOf('writeFileSync(marker, markerText);', scratch);
  const capture=source.indexOf('const originalScratchOwned = captureOwnedLocalPostgresScratch(', write);
  const socket=source.indexOf('mkdirSync(socketDir);', capture);
  const port=source.indexOf('const port = await availablePort();', socket);
  assert(scratch>=0 && write>scratch && capture>write && socket>capture && port>socket);
});
test('cleanup performs original-inode proof before copyable marker and cluster checks', () => {
  const finalizer=source.indexOf('const finalized = finalizeOwnedLocalPostgres(');
  const owned=source.indexOf('owned: () => {', finalizer);
  const newProof=source.indexOf('if (!originalScratchOwned()) return false;', owned);
  const oldProof=source.indexOf('if (!existsSync(ephemeral) || !existsSync(marker)) return false;', owned);
  const cluster=source.indexOf('isOwnedClusterDirectory(canonicalScratch, cluster', owned);
  const remove=source.indexOf('remove: () => { rmSync(ephemeral', cluster);
  assert(finalizer>=0 && owned>finalizer && newProof>owned && oldProof>newProof && cluster>oldProof && remove>cluster);
});
test('the same closure is used for finalizer stop path and no-start path', () => {
  assert.match(source, /startAttempted, startConfirmed: started,/);
  assert.match(source, /const originalScratchOwned = captureOwnedLocalPostgresScratch\(/);
  assert.equal((source.match(/if \(!originalScratchOwned\(\)\) return false;/g)||[]).length,1);
});
