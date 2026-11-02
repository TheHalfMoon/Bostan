import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePrivateWindowsModuleProfile as safe} from './bostan-private-windows-module-profile-safe.mjs';
const profile = (overrides={}) => JSON.stringify({
  schema:'bostan.private-module-load-profile.v1',loadCount:42,loadMs:91,
  errorCount:1,topLoads:[{module:'server/src/index.ts',loadMs:3.5},
    {module:'third_party',loadMs:2}],...overrides,
});
test('preserves bounded legitimate module timings and fixed categories',()=>{
  assert.deepEqual(safe(profile()),{loadCount:42,loadMs:91,errorCount:1,
    topLoads:[{module:'server/src/index.ts',loadMs:3.5},{module:'third_party',loadMs:2}]});
});
test('accepts existing profiler filename vocabulary including spaces',()=>{
  const names=['packages/db/src/embedded-postgres.ts','server/src/my file.tsx',
    'packages/feature/index.cjs','external_file','virtual_or_builtin','other_repo_file'];
  for (const module of names) assert.equal(safe(profile({topLoads:[{module,loadMs:0}]}))?.topLoads[0].module,module);
});
test('rejects newline/control, path traversal, backslash, and fake prefixes',()=>{
  for (const module of ['packages/ok.ts\nPRIVATE_QA_SECRET','packages/ok.ts\rSECRET',
    'packages/../secret.ts','packages//other.ts','server/src/../../secret.ts',
    'packages/ok\\secret.ts','packages/ok.ts?token=secret','packages/ok.ts\u0000secret',
    'packages/ok.ts\u2028secret','server/src/not-a-module','packages/'])
    assert.equal(safe(profile({topLoads:[{module,loadMs:1}]})),null,module);
});
test('rejects unbounded and nonnumeric metrics',()=>{
  for (const patch of [{loadCount:-1},{loadCount:1.5},{loadCount:'42'},
    {loadCount:10_000_001},{loadMs:'1'},{loadMs:-2},{loadMs:1e12},
    {errorCount:Infinity},{topLoads:[{module:'third_party',loadMs:'1'}]}])
    assert.equal(safe(profile(patch)),null);
});
test('rejects malformed and excessive input',()=>{
  for (const raw of [null,'','[]','null','{','{}','x'.repeat(4097),
    profile({schema:'other'}),profile({topLoads:Array(6).fill({module:'third_party',loadMs:1})})])
    assert.equal(safe(raw),null);
});
test('does not retain attacker-controlled properties',()=>{
  const result=safe(profile({email:'private@example.invalid',topLoads:[{
    module:'packages/db/src/index.ts',loadMs:2,token:'secret'}]}));
  assert.deepEqual(Object.keys(result),['loadCount','loadMs','errorCount','topLoads']);
  assert.equal(JSON.stringify(result).includes('secret'),false);
  assert.equal(Object.isFrozen(result),true);
});
test('rejects noncanonical Unicode and very long labels',()=>{
  for (const module of ['packages/é.ts','packages/'+'a'.repeat(171)+'.ts',
    'packages/a\tb.ts','packages/a.ts\nBOSTAN_WIN_SERVER_STAGE=runtime_ready'])
    assert.equal(safe(profile({topLoads:[{module,loadMs:1}]})),null);
});
