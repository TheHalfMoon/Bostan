import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { retainRunnerQualificationPackages } from '../retain-runner-qualification-packages.mjs';

test('private Bostan sandbox provider refuses inherited qualification packaging before writing output', () => {
  const root = mkdtempSync(join(tmpdir(), 'bostan-private-qualification-'));
  const relative = 'packages/plugins/sandbox-providers/daytona';
  const output = join(root, 'retained');
  try {
    mkdirSync(join(root, relative), { recursive: true });
    const bytes = readFileSync(new URL('../../packages/plugins/sandbox-providers/daytona/package.json', import.meta.url));
    writeFileSync(join(root, relative, 'package.json'), bytes);
    assert.throws(() => retainRunnerQualificationPackages({ repo: root, output, sourceRevision: '1'.repeat(40), releaseVersion: '0.0.0-test', publicArchives: [] }), /Bostan private sandbox provider qualification packaging is disabled/);
    assert.equal(existsSync(output), false, 'private guard must precede retained artifact generation');
    assert.deepEqual(readFileSync(join(root, relative, 'package.json')), bytes, 'source manifest must not be touched');
    assert.equal(existsSync(join(root, relative, 'package.dev.json')), false, 'mutating prepack must not execute');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
