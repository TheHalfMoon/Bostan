import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSelfContainedPostgresTemplateTree as safe } from './embedded-postgres-template-tree.ts';

const MiB = 1024 * 1024;
// Windows's file allocation may differ; real 500MiB allocations are not
// acceptable for this test-only cap qualification on an under-resourced PC.
const sparseTest = process.platform === 'win32' ? test.skip : test;
function fixture(t) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bostan-b189-size-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const cluster = path.join(scratch, 'cluster');
  fs.mkdirSync(cluster, { mode: 0o700 });
  fs.writeFileSync(path.join(cluster, 'PG_VERSION'), '18\n');
  return { scratch, cluster };
}
function sparse(filename, size) {
  const fd = fs.openSync(filename, 'wx', 0o600);
  try { fs.ftruncateSync(fd, size); } finally { fs.closeSync(fd); }
}
test('accepts a normal small PostgreSQL test cluster', t => {
  const { cluster } = fixture(t);
  sparse(path.join(cluster, 'small'), 8 * MiB);
  assert.equal(safe(cluster), true);
});
sparseTest('accepts exactly 256 MiB in a single relation file', t => {
  const { cluster } = fixture(t);
  sparse(path.join(cluster,'relation'), 256 * MiB);
  assert.equal(safe(cluster), true);
});
sparseTest('refuses a single 256 MiB + 1 byte relation', t => {
  const { cluster } = fixture(t);
  sparse(path.join(cluster,'oversized'), 256 * MiB + 1);
  assert.equal(safe(cluster), false);
});
sparseTest('accepts exactly 512 MiB aggregate with each file inside cap', t => {
  const { cluster } = fixture(t);
  sparse(path.join(cluster,'one'), 256 * MiB);
  sparse(path.join(cluster,'two'), 256 * MiB - 3);
  assert.equal(safe(cluster), true);
});
sparseTest('refuses more than 512 MiB aggregate', t => {
  const { cluster } = fixture(t);
  sparse(path.join(cluster,'one'), 256 * MiB);
  sparse(path.join(cluster,'two'), 256 * MiB);
  sparse(path.join(cluster,'three'), 1);
  assert.equal(safe(cluster), false);
});
sparseTest('refuses 3 independently valid 200 MiB relation files', t => {
  const { cluster } = fixture(t);
  for(let i=0;i<3;i++) sparse(path.join(cluster,'rel'+i), 200 * MiB);
  assert.equal(safe(cluster), false);
});
test('retains ordinary nested directory acceptance', t => {
  const { cluster } = fixture(t);
  const nested = path.join(cluster, 'global');
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested,'pg_control'), 'synthetic');
  assert.equal(safe(cluster), true);
});
test('rejects a nested hardlink without modifying its external target', t => {
  const { scratch, cluster } = fixture(t);
  const outside = path.join(scratch, 'external');
  fs.writeFileSync(outside, 'keep');
  fs.linkSync(outside, path.join(cluster, 'postgresql.conf'));
  assert.equal(safe(cluster), false);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
});
test('rejects a link to an external directory', t => {
  const { scratch, cluster } = fixture(t);
  const outside = path.join(scratch, 'foreign');
  fs.mkdirSync(outside);
  try { fs.symlinkSync(outside, path.join(cluster, 'pg_tblspc'), 'dir'); }
  catch(e){ if(e.code === 'EPERM'){t.skip('Windows privilege unavailable');return;} throw e; }
  assert.equal(safe(cluster), false);
});
test('rejects dangling symlink in cluster', t => {
  const { scratch, cluster } = fixture(t);
  try { fs.symlinkSync(path.join(scratch,'absent'), path.join(cluster,'auto.conf')); }
  catch(e){ if(e.code === 'EPERM'){t.skip('Windows privilege unavailable');return;} throw e; }
  assert.equal(safe(cluster), false);
});
test('rejects a group writable nested directory on POSIX', t => {
  if(process.platform === 'win32') return t.skip('POSIX mode gate only');
  const { cluster } = fixture(t);
  const nested=path.join(cluster,'nested');
  fs.mkdirSync(nested);
  fs.chmodSync(nested,0o770);
  assert.equal(safe(cluster), false);
});
test('rejects a missing root', t => {
  const { scratch } = fixture(t);
  assert.equal(safe(path.join(scratch,'absent')), false);
});
