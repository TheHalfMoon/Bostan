import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, lstat, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withExclusiveRuntimeBuildLock } from './bundle-runtime-lock.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-b131-lock-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const entry = join(root, 'entry.mjs');
  const outdir = join(root, 'runtime');
  const lock = join(root, '.bostan-runtime-build.lock');
  await writeFile(entry, 'export {};');
  const assertSafeRuntimeOutdir = async (source, candidate) => {
    assert.equal(source, entry);
    assert.equal(candidate, outdir);
    return outdir;
  };
  return { root, entry, outdir, lock, assertSafeRuntimeOutdir };
}

async function missing(path) {
  await assert.rejects(lstat(path), { code: 'ENOENT' });
}

test('successful build operation holds lock then releases it on completion', async t => {
  const f = await fixture(t);
  const result = await withExclusiveRuntimeBuildLock({ ...f,
    operation: async canonical => {
      assert.equal(canonical, f.outdir);
      assert.match(await readFile(f.lock, 'utf8'), /^[a-f0-9]{64}\n$/);
      return 42;
    },
  });
  assert.equal(result, 42);
  await missing(f.lock);
});

test('an operation rejection releases only its own unchanged lock', async t => {
  const f = await fixture(t);
  await assert.rejects(withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => { throw Error('synthetic compilation failure'); },
  }), /synthetic compilation failure/);
  await missing(f.lock);
});

test('a second concurrent build fails before running its callback', async t => {
  const f = await fixture(t);
  let release;
  let started;
  const ready = new Promise(r => { started = r; });
  const hold = new Promise(r => { release = r; });
  const first = withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => { started(); await hold; return 'first'; },
  });
  await ready;
  let secondRan = false;
  await assert.rejects(withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => { secondRan = true; },
  }), /locked or unsafe/);
  assert.equal(secondRan, false);
  assert.ok((await lstat(f.lock)).isFile());
  release();
  assert.equal(await first, 'first');
  await missing(f.lock);
});

test('pre-existing stale lock is not overwritten, removed or trusted', async t => {
  const f = await fixture(t);
  await writeFile(f.lock, 'UNOWNED_STALE_LOCK');
  await assert.rejects(withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => { throw Error('must not execute'); },
  }), /locked or unsafe/);
  assert.equal(await readFile(f.lock, 'utf8'), 'UNOWNED_STALE_LOCK');
});

test('linked lock never follows or modifies a foreign sentinel', async t => {
  const f = await fixture(t);
  const foreign = join(f.root, 'keep-me.txt');
  await writeFile(foreign, 'KEEP');
  try { await symlink(foreign, f.lock, 'file'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('no symlink permission'); return; } throw error; }
  await assert.rejects(withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => { throw Error('must not execute'); },
  }), /locked or unsafe/);
  assert.equal(await readFile(foreign, 'utf8'), 'KEEP');
});

test('mutating an owned lock leaves it untouched instead of deleting foreign data', async t => {
  const f = await fixture(t);
  await withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => { await writeFile(f.lock, 'ADDED_NOT_OWNED'); },
  });
  assert.equal(await readFile(f.lock, 'utf8'), 'ADDED_NOT_OWNED');
  await assert.rejects(withExclusiveRuntimeBuildLock({ ...f, operation: async () => null }), /locked or unsafe/);
});

test('separate runtime output destinations acquire independent locks', async t => {
  const f = await fixture(t);
  const other = join(f.root, 'dist-runtime');
  let called = false;
  await withExclusiveRuntimeBuildLock({ ...f,
    operation: async () => withExclusiveRuntimeBuildLock({
      entry: f.entry, outdir: other,
      assertSafeRuntimeOutdir: async () => other,
      operation: async () => { called = true; },
    }),
  });
  assert.equal(called, true);
  await missing(f.lock);
  await missing(join(f.root, '.bostan-dist-runtime-build.lock'));
});
