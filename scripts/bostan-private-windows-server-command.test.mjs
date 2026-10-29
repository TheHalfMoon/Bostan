import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordRuntimeOutputOwnership } from '../server/scripts/bundle-runtime-output-admission.mjs';
import { resolvePrivateWindowsQaServerCommand as resolveCommand } from './bostan-private-windows-server-command.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-b134-qa-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = join(root, 'server');
  const dist = join(server, 'dist');
  const output = join(server, 'dist-runtime');
  await mkdir(dist, { recursive: true });
  await mkdir(output);
  const entry = join(dist, 'index.js');
  const index = join(output, 'index.mjs');
  const module = join(output, 'server.mjs');
  await writeFile(entry, 'export {};\n');
  await writeFile(index, 'import "./server.mjs";\n');
  await writeFile(module, 'console.log("compiled");\n');
  return { root, entry, output, index, module };
}

test('original TypeScript mode stays unchanged without compiled output', async t => {
  const f = await fixture(t);
  const command = await resolveCommand({ root: f.root, mode: 'source' });
  assert.equal(command.mode, 'source');
  assert.deepEqual(command.nodeArgs, ['--import', 'tsx', '--import',
    '../scripts/bostan-private-windows-import-profiler.mjs',
    '../scripts/bostan-private-windows-server-entry.mjs']);
});

test('compiled mode refuses unmarked output, then accepts exact SHA-owned output', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveCommand({ root: f.root, mode: 'compiled' }), /not safely isolated/);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  const command = await resolveCommand({ root: f.root, mode: 'compiled' });
  assert.equal(command.mode, 'compiled');
  assert.deepEqual(command.nodeArgs, [f.index]);
});

test('compiled mode rejects modified output without executing it', async t => {
  const f = await fixture(t);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  await writeFile(f.module, 'MUTATED');
  await assert.rejects(resolveCommand({ root: f.root, mode: 'compiled' }), /not safely isolated/);
});

test('compiled mode rejects injected files and preserves foreign user content', async t => {
  const f = await fixture(t);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  const foreign = join(f.output, 'DO_NOT_DELETE.txt');
  await writeFile(foreign, 'KEEP');
  await assert.rejects(resolveCommand({ root: f.root, mode: 'compiled' }), /not safely isolated/);
  assert.equal(await readFile(foreign, 'utf8'), 'KEEP');
});

test('compiled mode refuses missing source to prevent wrong-manifest fallback', async t => {
  const f = await fixture(t);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  await rm(f.entry);
  await assert.rejects(resolveCommand({ root: f.root, mode: 'compiled' }), /not safely isolated/);
});

test('linked compiled entry is not executed', async t => {
  const f = await fixture(t);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  const moved = join(f.root, 'index-kept.mjs');
  await rm(f.index);
  await writeFile(moved, 'KEEP');
  try { await symlink(moved, f.index, 'file'); }
  catch (error) { if (error?.code === 'EPERM') { t.skip('symlink privilege unavailable'); return; } throw error; }
  await assert.rejects(resolveCommand({ root: f.root, mode: 'compiled' }), /not safely isolated/);
  assert.equal(await readFile(moved, 'utf8'), 'KEEP');
});

test('unsupported modes and invalid root are never accepted', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveCommand({ root: f.root, mode: 'cloud' }), /unsupported/);
  await assert.rejects(resolveCommand({ root: '.', mode: 'source' }), /unsafe/);
  await assert.rejects(resolveCommand({ root: f.root + '/..', mode: 'source' }), /unsafe/);
});

test('a validator admitting a different output cannot select executable path', async t => {
  const f = await fixture(t);
  await assert.rejects(resolveCommand({ root: f.root, mode: 'compiled',
    validateRuntime: async () => f.root }), /was not verified/);
});
