import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, rename, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSafeRuntimeOutdir, recordRuntimeOutputOwnership } from './bundle-runtime-output-admission.mjs';

async function ownedFixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-b126-source-ancestor-'));
  try {
    const server = join(root, 'server');
    const dist = join(server, 'dist');
    const outdir = join(server, 'dist-runtime');
    await mkdir(dist, { recursive: true });
    await mkdir(outdir);
    const entry = join(dist, 'index.js');
    const index = join(outdir, 'index.mjs');
    const runtime = join(outdir, 'server.mjs');
    await writeFile(entry, 'export {};\n');
    await writeFile(index, "import './server.mjs';\n");
    await writeFile(runtime, "console.log('owned');\n");
    await recordRuntimeOutputOwnership(entry, outdir, [index, runtime]);
    await fn({ root, server, dist, entry, outdir, runtime });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('refuses a source ancestor substituted with a directory symlink, preserving owned output', async t => {
  await ownedFixture(async ({ root, dist, entry, outdir, runtime }) => {
    const moved = join(root, 'relocated-dist');
    await rename(dist, moved);
    try { await symlink(moved, dist, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (e) { if (e?.code === 'EPERM') { t.skip('link privilege unavailable'); return; } throw e; }
    await assert.rejects(assertSafeRuntimeOutdir(entry, outdir), /not safely isolated/);
    assert.equal(await readFile(runtime, 'utf8'), "console.log('owned');\n");
  });
});

test('unchanged ordinary source ancestors preserve repeat-build admission', async () => {
  await ownedFixture(async ({ entry, outdir }) => {
    assert.equal(await assertSafeRuntimeOutdir(entry, outdir), outdir);
  });
});
