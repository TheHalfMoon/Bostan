import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const text = path => readFileSync(resolve(root, path), 'utf8');

test('Bostan owns the standalone Tailscale broker binary and forbids package publishing', () => {
  const manifest = JSON.parse(text('packages/tailscale-https-broker/package.json'));
  assert.equal(manifest.name, '@bostan/tailscale-https-broker');
  assert.equal(manifest.private, true);
  assert.equal(manifest.publishConfig, undefined);
  assert.deepEqual(manifest.bin, { 'bostan-tailscale-https-broker': './dist/main.js' });
  assert.equal(manifest.scripts.prepack, 'node ../../scripts/bostan-release-disabled.mjs');
  assert.equal(manifest.scripts.prepublishOnly, manifest.scripts.prepack);
  assert.ok(!text('scripts/release-package-manifest.json').includes('@bostan/tailscale-https-broker'));
});

test('Bostan systemd unit and broker default paths agree on private names', () => {
  const unit = text('packages/tailscale-https-broker/deploy/bostan-tailscale-https-broker.service');
  const config = text('packages/tailscale-https-broker/src/config.ts');
  assert.match(unit, /User=bostan-tsbroker\nGroup=bostan-tsbroker-sock/);
  assert.match(unit, /RuntimeDirectory=bostan-tailscale-broker/);
  assert.match(unit, /StateDirectory=bostan-tailscale-broker/);
  assert.match(unit, /LogsDirectory=bostan-tailscale-broker/);
  assert.match(unit, /\/etc\/bostan\/tailscale-https-broker.env/);
  assert.match(unit, /\/opt\/bostan\/packages\/tailscale-https-broker\/dist\/main.js/);
  for (const name of ['socketPath', 'registryPath', 'auditPath']) {
    assert.match(config, new RegExp(name + ': env\\.BROKER_'), 'host paths remain configurable');
  }
  assert.match(config, /\/run\/bostan-tailscale-broker\/broker.sock/);
  assert.match(config, /\/var\/lib\/bostan-tailscale-broker\/registry.json/);
  assert.match(config, /\/var\/log\/bostan-tailscale-broker\/audit.log/);
  assert.doesNotMatch(unit, /paperclip|Paperclip/i);
});

test('Bostan workspace first prefers owned socket setting, preserves inherited settings and wire keys', () => {
  const server = text('server/src/services/workspace-runtime.ts');
  const newEnv = server.indexOf('process.env.BOSTAN_TAILSCALE_BROKER_SOCKET?.trim()');
  const legacy = server.indexOf('process.env.PAPERCLIP_TAILSCALE_BROKER_SOCKET?.trim()');
  assert.ok(newEnv > 0 && legacy > newEnv && legacy - newEnv < 120);
  assert.match(server, /const DEFAULT_TAILSCALE_BROKER_SOCKET = "\/run\/bostan-tailscale-broker\/broker.sock"/);
  assert.match(server, /exposureConfig\.includePaperclipViteHmr/, 'do not silently change saved versioned protocol fields');
  const doc = text('packages/tailscale-https-broker/README.md');
  assert.match(doc, /pnpm --filter @bostan\/tailscale-https-broker build/);
  assert.match(doc, /BOSTAN_TAILSCALE_BROKER_SOCKET/);
});

test('broker inherits the same disabled Bostan release guard', () => {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/bostan-release-disabled.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});
