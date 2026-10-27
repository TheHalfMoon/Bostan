import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const text = relative => readFileSync(resolve(root,relative),'utf8');
const json = relative => JSON.parse(text(relative));
const adapters = new Map([
  ['claude-local','adapter-claude-local'],
  ['codex-local','adapter-codex-local'],
  ['cursor-cloud','adapter-cursor-cloud'],
  ['cursor-local','adapter-cursor-local'],
  ['gemini-local','adapter-gemini-local'],
  ['grok-local','adapter-grok-local'],
  ['hermes','adapter-hermes'],
  ['hermes-gateway','adapter-hermes-gateway'],
  ['kimi-local','adapter-kimi-local'],
  ['openclaw-gateway','adapter-openclaw-gateway'],
  ['opencode-local','adapter-opencode-local'],
  ['pi-local','adapter-pi-local'],
]);
const publicInventory = json('scripts/release-package-manifest.json');
for(const [dir,name] of adapters){
  test(`Bostan owns non-publishable ${dir} adapter without changing versioned adapter protocol`,()=>{
    const m=json(`packages/adapters/${dir}/package.json`);
    assert.equal(m.name,`@bostan/${name}`);
    assert.equal(m.private,true);
    assert.equal(m.publishConfig,undefined);
    assert.equal(m.repository.url,'https://github.com/TheHalfMoon/Bostan');
    assert.equal(m.repository.directory,`packages/adapters/${dir}`);
    assert.equal(m.scripts.prepack,'node ../../../scripts/bostan-release-disabled.mjs');
    assert.equal(m.scripts.prepublishOnly,m.scripts.prepack);
    assert.equal(m.scripts.postpack,undefined);
    assert.ok(!publicInventory.some(item=>item.dir===`packages/adapters/${dir}`));
    for(const section of ['dependencies','devDependencies','optionalDependencies','peerDependencies']){
      for(const dep of Object.keys(m[section]??{})){
        assert.ok((!dep.startsWith('@paperclipai/adapter-') || dep==='@paperclipai/adapter-utils') && dep!=='@paperclipai/hermes-paperclip-adapter',`${m.name} depends on obsolete adapter ${dep}`);
      }
    }
    if(dir==='hermes' || dir==='hermes-gateway'){
      assert.equal(m.paperclip.adapterUiParser,'1.0.0','persistent protocol metadata must remain supported');
    }
  });
}
test('owning CLI and server registries, workspace tests and manifests use native Bostan adapter packages',()=>{
  const files=['cli/package.json','server/package.json','ui/package.json','cli/src/adapters/registry.ts','server/src/adapters/registry.ts','scripts/run-vitest-stable.mjs'];
  for (const file of files) {
    const contents=text(file);
    assert.doesNotMatch(contents, /@paperclipai\/(?:adapter-(?!utils)|hermes-paperclip-adapter)/,`${file} leaks an obsolete adapter name`);
  }
  const lock=text('pnpm-lock.yaml');
  assert.match(lock,/\n      '@bostan\/adapter-hermes':\n        specifier: workspace:\*/);
  assert.ok(adapters.size===12);
});
