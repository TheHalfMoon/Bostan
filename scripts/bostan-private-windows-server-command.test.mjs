import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { recordRuntimeOutputOwnership } from '../server/scripts/bundle-runtime-output-admission.mjs';
import { resolvePrivateWindowsQaServerCommand as resolveCommand } from './bostan-private-windows-server-command.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'bostan-b134-qa-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = join(root, 'server');
  const dist = join(server, 'dist');
  const output = join(server, 'dist-runtime');
  await mkdir(join(root, 'scripts'), {recursive:true});
  for (const name of ['bostan-private-windows-compiled-entry-guard.mjs',
      'bostan-private-windows-entry-admission.mjs',
      'bostan-private-windows-qa-wave.mjs']) {
    await copyFile(new URL(name, import.meta.url), join(root, 'scripts', name));
  }
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
  assert.deepEqual(command.nodeArgs, [
    '--import', pathToFileURL(join(f.root, 'scripts', 'bostan-private-windows-compiled-entry-guard.mjs')).href,
    f.index,
  ]);
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


test('owned compiled runtime launches using plain Node without tsx', async t => {
  const f = await fixture(t);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  const command = await resolveCommand({root: f.root, mode: 'compiled'});
  // Verify the generated module itself is valid without the Windows-only QA
  // preload, whose own fail-closed behavior has separate tests.
  const child = spawnSync(process.execPath, [f.index], {
    cwd: join(f.root, 'server'), encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr?.slice(0, 500));
  assert.match(child.stdout, /compiled/);
});
 

test('compiled QA child rejects Linux preflight before evaluating server module', async t => {
  const f = await fixture(t);
  await recordRuntimeOutputOwnership(f.entry, f.output, [f.index, f.module]);
  const command = await resolveCommand({ root: f.root, mode: 'compiled' });
  const child = spawnSync(process.execPath, command.nodeArgs, {
    cwd: join(f.root, 'server'), encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.status, 2, child.stderr);
  assert.doesNotMatch(child.stdout, /compiled/);
  assert.match(child.stderr, /unsafe synthetic QA fixture/);
});
