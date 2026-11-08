import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
const read = p => readFileSync(resolve(root,p),'utf8');
const json = p => JSON.parse(read(p));

test('native Bostan database package is private, release-disabled and keeps build/migration entrypoints',()=>{
  const m=json('packages/db/package.json');
  assert.equal(m.name,'@bostan/db');
  assert.equal(m.private,true);
  assert.equal(m.publishConfig,undefined);
  assert.equal(m.repository.url,'https://github.com/TheHalfMoon/Bostan');
  assert.equal(m.scripts.prepack,'node ../../scripts/bostan-release-disabled.mjs');
  assert.equal(m.scripts.prepublishOnly,m.scripts.prepack);
  assert.match(m.scripts.build,/check:migrations/);
  assert.match(m.scripts.migrate,/check:migrations/);
  const inventory=json('scripts/release-package-manifest.json');
  assert.ok(!inventory.some(e=>e.dir==='packages/db'));
});

test('native database workspace consumer links use Bostan without changing persisted SQL migrations',()=>{
  const lock=read('pnpm-lock.yaml');
  assert.match(lock,/\n      '@bostan\/db':\n        specifier: workspace:\*/);
  for(const file of ['server/package.json','cli/package.json']){
    assert.ok(!Object.hasOwn(json(file).dependencies??{},'@paperclipai/db'),file);
  }
  const edited=execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).split('\n');
  assert.ok(!edited.some(p=>p.startsWith('packages/db/src/migrations/')||p.startsWith('packages/db/src/__fixtures__/')),
    'existing SQL migrations and historical snapshots must remain byte-identical');
});

test('database packaging guard fails before any npm publication',()=>{
  const r=spawnSync(process.execPath,[resolve(root,'scripts/bostan-release-disabled.mjs')],{encoding:'utf8'});
  assert.equal(r.status,2);
});
