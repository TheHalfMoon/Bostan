import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('./bostan-local-postgres-migration-qualification.mjs', import.meta.url), 'utf8');
test('actual local PostgreSQL runner checks scratch identity BEFORE initdb command',()=>{
  const scratch=runner.indexOf('const ephemeral = mkdtempSync(');
  const receipt=runner.indexOf('const originalScratchOwned = captureOwnedLocalPostgresScratch(',scratch);
  const gate=runner.indexOf('const executionGate = createLocalPostgresPreExecGate(',receipt);
  const socket=runner.indexOf('mkdirSync(socketDir);',gate);
  const port=runner.indexOf('const port = await availablePort();',socket);
  const inspect=runner.indexOf('executionGate.beforeInitdb();',port);
  const initdb=runner.indexOf("exec('initdb',",inspect);
  assert(scratch>=0&&receipt>scratch&&gate>receipt&&socket>gate&&port>socket&&inspect>port&&initdb>inspect);
});
test('binds the initialized cluster inode BEFORE pg_ctl may attempt start',()=>{
  const initdb=runner.indexOf("exec('initdb',");
  const capture=runner.indexOf('executionGate.afterInitdb();',initdb);
  const inspect=runner.indexOf('executionGate.beforeStart();',capture);
  const attempt=runner.indexOf('startAttempted = true;',inspect);
  const pgctl=runner.indexOf("exec('pg_ctl', ['-D', cluster",attempt);
  assert(initdb>=0&&capture>initdb&&inspect>capture&&attempt>inspect&&pgctl>attempt);
});
test('the real finalizer refuses compromised pre-execution gate before stop or deletion',()=>{
  const finalizer=runner.indexOf('const finalized = finalizeOwnedLocalPostgres(');
  const owned=runner.indexOf('owned: () => {',finalizer);
  const gate=runner.indexOf('if (!executionGate.ownedForFinalizer()) return false;',owned);
  const marker=runner.indexOf('if (!originalScratchOwned()) return false;',gate);
  const cluster=runner.indexOf('isOwnedClusterDirectory(canonicalScratch, cluster',marker);
  const remove=runner.indexOf('remove: () => { rmSync(ephemeral',cluster);
  assert(finalizer>=0&&owned>finalizer&&gate>owned&&marker>gate&&cluster>marker&&remove>cluster);
});
