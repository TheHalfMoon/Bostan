import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const providers = new Map([
  ['cloudflare', 'plugin-cloudflare-sandbox'],
  ['createos', 'plugin-createos'],
  ['daytona', 'plugin-daytona'],
  ['e2b', 'plugin-e2b'],
  ['exe-dev', 'plugin-exe-dev'],
  ['kubernetes', 'plugin-kubernetes'],
  ['modal', 'plugin-modal'],
  ['novita', 'plugin-novita-sandbox'],
]);
const releaseInventory = JSON.parse(readFileSync(resolve(root, 'scripts/release-package-manifest.json'), 'utf8'));
for (const [folder, suffix] of providers) {
  test(`Bostan ${folder} sandbox provider is private, release-disabled and protocol-compatible`, () => {
    const dir = `packages/plugins/sandbox-providers/${folder}`;
    const manifest = JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8'));
    const entry = releaseInventory.filter(item => item.dir === dir);
    assert.equal(manifest.name, `@bostan/${suffix}`);
    assert.equal(manifest.private, true);
    assert.equal(manifest.publishConfig, undefined);
    assert.deepEqual(entry, [], 'private provider must be absent from the public release inventory');
    assert.equal(manifest.scripts.prepack, 'node ../../../../scripts/bostan-release-disabled.mjs');
    assert.equal(manifest.scripts.prepublishOnly, manifest.scripts.prepack);
    assert.equal(manifest.scripts.postpack, undefined, 'mutating inherited postpack must not run');
    assert.equal(manifest.paperclipPlugin.manifest, './dist/manifest.js', 'preserve saved versioned plugin wire schema');
    assert.equal(manifest.paperclipPlugin.worker, './dist/worker.js');
    assert.equal(manifest.homepage, 'https://github.com/TheHalfMoon/Bostan');
    assert.equal(manifest.repository.url, 'https://github.com/TheHalfMoon/Bostan');
  });
}
test('no private Bostan provider remains in the public release inventory', () => {
  const entries = releaseInventory.filter(item => item.dir.startsWith('packages/plugins/sandbox-providers/'));
  assert.deepEqual(entries, []);
});

test('Bostan publication guard refuses to run before any npm action', () => {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/bostan-release-disabled.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Bostan: release, registry bootstrap, npm packaging and rollback are disabled/);
});
