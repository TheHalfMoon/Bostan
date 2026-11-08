import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
const cli=fileURLToPath(new URL('./bostan-web-qualification.mjs',import.meta.url));
function invoke(...args){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});}
test('default Bostan source qualification plan remains read-only and never claims release',()=>{
  const r=invoke();assert.equal(r.status,0,r.stderr);
  const plan=JSON.parse(r.stdout);
  assert.equal(plan.kind,'bostan.web-source-preflight.v1');
  assert.equal(plan.releaseQualified,false);
  assert.equal(plan.steps.length,6);
  assert.ok(plan.steps.every(s=>s.name && s.args[0]==='--filter'));
  const actions=plan.steps.map(s=>s.args.join(' ')).join('\n');
  for(const prohibited of [/cargo/,/\brelease\b/,/\bpublish\b/,/\bdeploy\b/,/\bmigrate\b/,/\bseed\b/,/\bpnpm install\b/,/test:rust/]) {
    assert.doesNotMatch(actions,prohibited);
  }
  assert.match(actions,/@bostan\/server exec tsc --noEmit/);
  assert.match(actions,/@bostan\/runner build:typescript/);
  assert.match(actions,/PluginOrganizationSwitcher\.test\.tsx/);
});
test('unknown preflight arguments fail without invoking anything',()=>{
  const r=invoke('--publish');assert.equal(r.status,2);assert.match(r.stderr,/Usage:/);
});
