import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./bostan-private-windows-live-http.mjs',import.meta.url),'utf8');

test('real Windows HTTP QA imports the shared memory policy',()=>{
  assert.match(source,/import \{evaluateWindowsLiveMemory\} from "\.\/bostan-private-windows-live-memory-policy\.mjs";/);
});
test('original Chromium RAM preflight uses shared policy, not a separate threshold',()=>{
  assert(source.includes('!evaluateWindowsLiveMemory(memoryAdmission,{browserMode}).allowed'));
  assert(!source.includes('memoryAdmission.freeGiB<4'));
});
test('refuses a fresh low-memory reading before PostgreSQL scratch creation',()=>{
  const resolved=source.indexOf('BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_PASS');
  const guard=source.indexOf('const beforeDatabasePolicy=evaluateWindowsLiveMemory(');
  const scratch=source.indexOf('const home=mkdtempSync(');
  const database=source.indexOf('db=await startEmbeddedPostgresTestDatabase(');
  assert(resolved>0 && guard>resolved && scratch>guard && database>scratch);
  assert(source.includes('BOSTAN_WINDOWS_LIVE_MEMORY_BEFORE_DATABASE_REFUSED'));
});
test('after migration rechecks Chromium at the same threshold, without a 3 GiB exception',()=>{
  const migration=source.indexOf('db=await startEmbeddedPostgresTestDatabase(');
  const guard=source.indexOf('const afterDbPolicy=evaluateWindowsLiveMemory(');
  const env=source.indexOf('const env=buildPrivateWindowsHttpQaEnvironment(');
  assert(migration>0 && guard>migration && env>guard);
  assert(!source.includes('afterDbMemory.freeGiB<3'));
  assert(source.includes('BOSTAN_WINDOWS_LIVE_MEMORY_POSTGRES_REFUSED'));
});
test('checks a current reading after preparing env, immediately before server spawn',()=>{
  const env=source.indexOf('const env=buildPrivateWindowsHttpQaEnvironment(');
  const policy=source.indexOf('const beforeServerPolicy=evaluateWindowsLiveMemory(');
  const spawn=source.indexOf('server=spawn(process.execPath,serverCommand.nodeArgs,');
  assert(env>0 && policy>env && spawn>policy);
  assert(source.includes('BOSTAN_WINDOWS_LIVE_MEMORY_BEFORE_SERVER_REFUSED'));
});
test('every rejection keeps sensitive OS readings and environment out of diagnostics',()=>{
  for(const marker of ['BOSTAN_WINDOWS_LIVE_MEMORY_BEFORE_DATABASE_REFUSED',
    'BOSTAN_WINDOWS_LIVE_MEMORY_POSTGRES_REFUSED',
    'BOSTAN_WINDOWS_LIVE_MEMORY_BEFORE_SERVER_REFUSED']) {
    assert(source.includes(marker+'="+'));
  }
});
