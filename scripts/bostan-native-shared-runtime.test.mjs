import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const parse=p=>JSON.parse(read(p));
const manifest=parse('scripts/release-package-manifest.json');
for(const dir of ['shared','adapter-utils']){
  test(`core Bostan ${dir} package is owned, private, and never packaged`,()=>{
    const p=parse(`packages/${dir}/package.json`);
    assert.equal(p.name,`@bostan/${dir}`);
    assert.equal(p.private,true);
    assert.equal(p.publishConfig,undefined);
    assert.equal(p.repository.url,'https://github.com/TheHalfMoon/Bostan');
    assert.equal(p.repository.directory,`packages/${dir}`);
    assert.equal(p.scripts.prepack,'node ../../scripts/bostan-release-disabled.mjs');
    assert.equal(p.scripts.prepublishOnly,p.scripts.prepack);
    assert.ok(!manifest.some(e=>e.dir===`packages/${dir}`));
  });
}
test('shared runtime ownership is consistent across Bostan CLI, server and core utility workspace dependencies',()=>{
  for (const path of ['cli/package.json','server/package.json','ui/package.json','packages/adapter-utils/package.json']){
    const data=parse(path);
    assert.ok(!Object.keys(data.dependencies??{}).includes('@paperclipai/shared'),path);
    assert.ok(!Object.keys(data.dependencies??{}).includes('@paperclipai/adapter-utils'),path);
  }
  const utils=parse('packages/adapter-utils/package.json');
  assert.equal(utils.dependencies['@bostan/shared'],'workspace:*');
  const lock=read('pnpm-lock.yaml');
  assert.match(lock,/\n      '@bostan\/shared':\n        specifier: workspace:\*/);
  assert.match(lock,/\n      '@bostan\/adapter-utils':\n        specifier: workspace:\*/);
  assert.doesNotMatch(read('scripts/run-vitest-stable.mjs'),/@paperclipai\/(shared|adapter-utils)/);
});
test('Bostan package release guard still fails closed',()=>{
  const result=spawnSync(process.execPath,[resolve(root,'scripts/bostan-release-disabled.mjs')],{encoding:'utf8'});
  assert.equal(result.status,2);
});
