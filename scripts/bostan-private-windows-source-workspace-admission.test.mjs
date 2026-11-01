import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPrivateWindowsSourceWorkspaceDependencies as check } from './bostan-private-windows-source-workspace-admission.mjs';

const scopes = ['server', 'packages/adapter-utils', 'packages/paperclip-runner'];
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-source-qa-deps-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const s of scopes) {
    await mkdir(join(root, s), { recursive: true });
    await writeFile(join(root, s, 'package.json'), JSON.stringify({
      private: true, dependencies: { 'smol-toml': '^1.9.1' },
    }));
  }
  return root;
}

test('refuses a missing installed dependency in any of the three workspace scopes', async t => {
  const root = await fixture(t);
  for (const scope of scopes) {
    const receipt = check({root, resolveDependency: manifest => {
      if (manifest === join(root, scope, 'package.json')) throw Error('private path');
      return 'synthetic-installed-package';
    }});
    assert.deepEqual(receipt, { allowed: false, reason: 'missing_workspace_dependency' });
    assert.equal(JSON.stringify(receipt).includes(root), false);
  }
});

test('reports pass only after each declared dependency resolves from its own scope', async t => {
  const root = await fixture(t);
  let checks = 0;
  const receipt = check({root, resolveDependency(manifest, name) {
    assert.equal(name, 'smol-toml');
    assert(scopes.some(s => manifest === join(root, s, 'package.json')));
    checks++;
    return 'synthetic-module';
  }});
  assert.equal(checks, 3);
  assert.deepEqual(receipt, {allowed: true, reason: 'pass'});
  assert(Object.isFrozen(receipt));
});

test('real Node resolution refuses absent package even when manifest declares it', async t => {
  const root = await fixture(t);
  assert.deepEqual(check({root}), {allowed: false, reason: 'missing_workspace_dependency'});
});

test('real Node resolution accepts only actual installed scoped packages', async t => {
  const root = await fixture(t);
  for (const s of scopes) {
    const mod = join(root, s, 'node_modules', 'smol-toml');
    await mkdir(mod, {recursive: true});
    await writeFile(join(mod, 'package.json'), '{"name":"smol-toml","version":"1.9.1","main":"index.js"}');
    await writeFile(join(mod, 'index.js'), 'export const parse = () => ({})');
  }
  assert.deepEqual(check({root}), {allowed: true, reason: 'pass'});
});

test('fails closed on malformed and missing manifests or undeclared package', async t => {
  const root = await fixture(t);
  const file = join(root, 'server', 'package.json');
  await writeFile(file, '{invalid');
  assert.equal(check({root}).reason, 'invalid_workspace_manifest');
  await writeFile(file, '{"dependencies":{}}');
  assert.equal(check({root}).reason, 'undeclared_workspace_dependency');
  await rm(file);
  assert.equal(check({root}).reason, 'invalid_workspace_manifest');
});

test('rejects relative roots, injected resolvers and malformed resolutions', async t => {
  const root = await fixture(t);
  assert.equal(check({root:'./'}).reason, 'invalid_source_root');
  assert.equal(check({root, resolveDependency: null}).reason, 'invalid_source_root');
  assert.equal(check({root, resolveDependency: () => ''}).reason, 'missing_workspace_dependency');
});

test('source-mode workspace preflight runs before disposable PostgreSQL fixture creation', async () => {
  const source = await readFile(new URL('./bostan-private-windows-live-http.mjs', import.meta.url), 'utf8');
  const checkPosition = source.indexOf('checkPrivateWindowsSourceWorkspaceDependencies({root:resolve(root)})');
  const fixturePosition = source.indexOf('const home=mkdtempSync(');
  assert(checkPosition >= 0 && fixturePosition > checkPosition);
  assert(source.includes('BOSTAN_WINDOWS_LIVE_SOURCE_DEPENDENCIES_REFUSED='));
});
