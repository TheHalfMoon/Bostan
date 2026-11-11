import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const readJSON=(name)=>JSON.parse(readFileSync(root+name,'utf8'));
const pkg=readJSON('package.json');
const db=readJSON('packages/db/package.json');
const runner=readJSON('packages/bostan-runner/package.json');
const kernel=readJSON('packages/bostan-eval-kernel/package.json');

test('DB CLI operations select the Bostan database package installed by this workspace',()=>{
  assert.equal(db.name,'@bostan/db');
  for(const [key,script] of [
    ['db:generate','generate'],
    ['db:migrate','migrate'],
  ]){
    assert.equal(pkg.scripts[key],`pnpm --filter ${db.name} ${script}`);
    assert.equal(typeof db.scripts?.[script],'string');
  }
});

test('workflow evaluations target real runner and eval kernel packages',()=>{
  assert.equal(runner.name,'@bostan/runner');
  assert.equal(kernel.name,'@bostan/eval-kernel');
  assert.equal(
    pkg.scripts['test:runner-workflow-evals'],
    `pnpm --filter ${kernel.name} build && pnpm --filter ${runner.name} test:runner-workflow-evals`,
  );
  assert.ok(runner.scripts['test:runner-workflow-evals']);
  assert.ok(kernel.scripts.build);
});

test('no root executable scripts still target the removed donor npm workspace names',()=>{
  for(const [command,script] of Object.entries(pkg.scripts)){
    assert.doesNotMatch(script,/@paperclipai\//,`stale pnpm target in ${command}`);
  }
});
