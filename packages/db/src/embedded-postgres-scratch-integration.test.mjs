import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Source-order contract for the real PostgreSQL test fixture, requiring
// capture immediately after each mkdtemp and revalidation at every cleanup.
const source=readFileSync(new URL('./test-embedded-postgres.ts',import.meta.url),'utf8');
test('real db source imports the test scratch guard',()=>{
  assert(source.includes('captureOwnedPostgresScratchReclaimer } from "./embedded-postgres-scratch-ownership.mjs";'));
});
test('fresh cluster registers before instance construction',()=>{
  const start=source.indexOf('async function createEmbeddedPostgresTestInstance(tempDirPrefix: string)');
  const registration=source.indexOf('registerOwnedPostgresScratch(dataDir)',start);
  const instance=source.indexOf('return await createEmbeddedPostgresTestInstanceAt(dataDir)',start);
  assert(start>=0 && registration>start && instance>registration);
});
test('template-copy root registers before filesystem copy',()=>{
  const start=source.indexOf('async function startEmbeddedPostgresFromTemplateWithRetry(');
  const registration=source.indexOf('registerOwnedPostgresScratch(rootDir)',start);
  const copied=source.indexOf('fs.cpSync(templateDir, dataDir, { recursive: true })',start);
  assert(start>=0 && registration>start && copied>registration);
});
test('reclaim requires recorded identity and only forgets after successful cleanup',()=>{
  const block=source.slice(source.indexOf('function cleanupEmbeddedPostgresTestDirs(dataDir: string): void'),source.indexOf('const EMBEDDED_POSTGRES_STOP_TIMEOUT_MS'));
  assert.match(block,/ownedPostgresScratchReclaimers\.get\(dataDir\)/);
  assert.match(block,/if \(!reclaim\)/);
  assert(block.indexOf('reclaim();')>=0 && block.indexOf('ownedPostgresScratchReclaimers.delete(dataDir);')>block.indexOf('reclaim();'));
  assert.doesNotMatch(block,/fs\.rmSync\(dataDir/);
});
test('publisher drops disposal authority on preserved published cluster',()=>{
  const rename=source.indexOf('fs.renameSync(dataDir, templateDir)');
  const release=source.indexOf('ownedPostgresScratchReclaimers.delete(dataDir)',rename);
  const published=source.indexOf('published = true',rename);
  assert(rename>=0 && published>rename && release>published);
});
test('early empty scratch cleanup clears tracking only after rmdir',()=>{
  const early=source.indexOf('fs.rmdirSync(dataDir)');
  const deleteTracking=source.indexOf('ownedPostgresScratchReclaimers.delete(dataDir)',early);
  assert(early>=0 && deleteTracking>early && deleteTracking-early<150);
});
