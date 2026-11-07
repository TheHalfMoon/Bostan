import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./bostan-local-postgres-migration-qualification.mjs',import.meta.url),'utf8');
test('cloud isolation runs before any external PostgreSQL version probe or scratch creation',()=>{
  const start=source.indexOf('async function run() {');
  const admission=source.indexOf('validatePrivateLocalCloudIsolation(process.env);',start);
  const scratch=source.indexOf('const ephemeral = mkdtempSync(',admission);
  const probe=source.indexOf("qaExec(bin, ['--version']",scratch);
  assert(start>=0 && admission>start && scratch>admission && probe>scratch);
  assert(!source.slice(start,scratch).includes("exec(bin,"));
  assert(!source.slice(start,scratch).includes("exec(process.execPath,"));
});
test('real runner allocates private home after owned marker and before any PG CLI',()=>{
  const scratch=source.indexOf('const ephemeral = mkdtempSync(');
  const marker=source.indexOf('writeFileSync(marker, markerText);',scratch);
  const receipt=source.indexOf('const originalScratchOwned = captureOwnedLocalPostgresScratch(',marker);
  const port=source.indexOf('const port = await availablePort();',receipt);
  const attempt=source.indexOf('profileAttempted = true;',port);
  const create=source.indexOf('createOwnedLocalPostgresProfileEnv(isolatedEnv,',attempt);
  const ready=source.indexOf('isolatedEnv = profile.env;',create);
  const version=source.indexOf("qaExec(bin, ['--version']",ready);
  const initdb=source.indexOf("qaExec('initdb',",version);
  assert(scratch>=0 && marker>scratch && receipt>marker && port>receipt && attempt>port &&
         create>attempt && ready>create && version>ready && initdb>version);
});
test('all local PostgreSQL tools and migrations use qaExec rather than bare exec',()=>{
  for(const bin of ['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore','pnpm']){
    assert(!source.includes("exec('"+bin+"'"),bin);
    assert(source.includes("qaExec('"+bin+"'")||bin==='pnpm',bin);
  }
  assert(source.includes("migrateDatabase(isolatedEnv, 240_000, qaExec)"));
  assert(source.includes("migrateDatabase(isolatedEnv, 120_000, qaExec)"));
  assert(source.includes("migrateDatabase(restoreEnv, 120_000, qaExec)"));
});
test('the finalizer declines removal if a profile was created or attempted but is unverified',()=>{
  const finalizer=source.indexOf('const finalized = finalizeOwnedLocalPostgres(');
  const owned=source.indexOf('owned: () => {',finalizer);
  const profile=source.indexOf('if (profileAttempted && !profileOwned?.()) return false;',owned);
  const cluster=source.indexOf('if (!executionGate.ownedForFinalizer()) return false;',profile);
  const remove=source.indexOf('remove: () => { rmSync(ephemeral',cluster);
  assert(finalizer>=0 && profile>owned && cluster>profile && remove>cluster);
});
test('actual qaExec wrapper rejects changed profile before reaching subprocess creation',()=>{
  const start=source.indexOf('  const qaExec = (command, args, options = {}) => {');
  const end=source.indexOf('  };\n  try {',start);
  assert(start>=0 && end>start);
  const fragment=source.slice(start,end+4);
  const make=vm.runInNewContext('(function(profileOwned,exec){'+fragment+'\nreturn qaExec;})',{Error});
  let calls=0;
  let valid=false;
  const call=make(()=>valid,()=>{calls++;return 'safe synthetic result';});
  assert.throws(()=>call('psql',[],{}),e=>e.message.includes('retaining fixture'));
  assert.equal(calls,0);
  valid=true;
  assert.equal(call('psql',[],{}),'safe synthetic result');
  assert.equal(calls,1);
  valid=false;
  assert.throws(()=>call('pg_ctl',[],{}),/retaining fixture/);
  assert.equal(calls,1);
});
test('new profile environment is used by version checks and normal CLIs',()=>{
  assert.match(source,/isolatedEnv = profile\.env;/);
  assert.match(source,/qaExec\(bin, \['--version'\], \{ timeout: 10_000, env: isolatedEnv \}\)/);
  assert.match(source,/qaExec\('initdb',[^\n]+/);
  assert.match(source,/qaExec\('pg_ctl', \['-D', cluster/);
});
