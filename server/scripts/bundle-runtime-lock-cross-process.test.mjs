import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const lockModule = join(here, 'bundle-runtime-lock.mjs');
const holdProgram = `
import { pathToFileURL } from 'node:url';
const { withExclusiveRuntimeBuildLock } = await import(pathToFileURL(process.argv[1]).href);
const [entry, outdir] = process.argv.slice(2);
await withExclusiveRuntimeBuildLock({ entry, outdir,
  assertSafeRuntimeOutdir: async () => outdir,
  operation: async () => {
    process.send({ kind: 'locked' });
    await new Promise(() => {});
  },
});
`;
const contenderProgram = `
import { pathToFileURL } from 'node:url';
const { withExclusiveRuntimeBuildLock } = await import(pathToFileURL(process.argv[1]).href);
const [entry, outdir] = process.argv.slice(2);
await withExclusiveRuntimeBuildLock({ entry, outdir,
  assertSafeRuntimeOutdir: async () => outdir,
  operation: async () => { process.stdout.write('CALLBACK_EXECUTED\\n'); },
});
`;

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-b132-owned-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const entry = join(root, 'entry.mjs');
  await writeFile(entry, 'export {};\n');
  return { root, entry, outdir: join(root, 'runtime'), lock: join(root, '.bostan-runtime-build.lock') };
}

async function withHeldChild(t, fixture, operation) {
  const args = ['--input-type=module', '-e', holdProgram,
    lockModule, fixture.entry, fixture.outdir];
  const child = spawn(process.execPath, args, {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
  });
  let ended = false;
  const exitPromise = once(child, 'exit').then(() => { ended = true; });
  t.after(async () => {
    if (!ended) child.kill();
    await exitPromise;
  });
  const handshake = new Promise((resolve, reject) => {
    child.once('message', resolve);
    child.once('error', reject);
    child.once('exit', (code, signal) => reject(new Error(`owner exited before lock: ${code}/${signal}`)));
  });
  const timeout = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('owner lock handshake exceeded 8 seconds')), 8000);
    timer.unref();
    handshake.finally(() => clearTimeout(timer)).catch(() => {});
  });
  const message = await Promise.race([handshake, timeout]);
  assert.deepEqual(message, { kind: 'locked' });
  await operation({ child, exitPromise });
}

function attempt(entry, outdir) {
  return spawnSync(process.execPath, [
    '--input-type=module', '-e', contenderProgram, lockModule, entry, outdir,
  ], { encoding: 'utf8', timeout: 10000, windowsHide: true });
}

test('two independent Node processes cannot concurrently build the same runtime', async t => {
  const f = await fixture(t);
  await withHeldChild(t, f, async ({ child, exitPromise }) => {
    const lockBefore = await readFile(f.lock, 'utf8');
    assert.match(lockBefore, /^[a-f0-9]{64}\n$/);
    const rejected = attempt(f.entry, f.outdir);
    assert.equal(rejected.status, 1, rejected.stderr?.slice(0, 250));
    assert.doesNotMatch(rejected.stdout, /CALLBACK_EXECUTED/);
    assert.match(rejected.stderr, /locked or unsafe/);
    assert.equal(await readFile(f.lock, 'utf8'), lockBefore);
    child.kill();
    await exitPromise;
    // A killed build never causes automatic stale-lock theft by another process.
    assert.equal(await readFile(f.lock, 'utf8'), lockBefore);
    const stillRejected = attempt(f.entry, f.outdir);
    assert.equal(stillRejected.status, 1);
    assert.doesNotMatch(stillRejected.stdout, /CALLBACK_EXECUTED/);
  });
});

test('a separate compiled runtime destination remains independently buildable', async t => {
  const f = await fixture(t);
  await withHeldChild(t, f, async () => {
    const separate = attempt(f.entry, join(f.root, 'dist-runtime'));
    assert.equal(separate.status, 0, separate.stderr?.slice(0, 500));
    assert.match(separate.stdout, /CALLBACK_EXECUTED/);
    assert.match(await readFile(f.lock, 'utf8'), /^[a-f0-9]{64}\n$/);
  });
});
