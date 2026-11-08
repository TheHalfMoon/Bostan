import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isOwnedClusterDirectory } from './bostan-local-postgres-cluster-ownership.mjs';

function fixture(fn) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'bostan-b223-')));
  try { return fn(base); } finally { rmSync(base, {recursive:true, force:false}); }
}
test('ordinary owned cluster accepted', () => fixture(base => {
  const cluster=join(base,'cluster'); mkdirSync(cluster);
  assert.equal(isOwnedClusterDirectory(base,cluster),true);
}));
test('missing cluster refused', () => fixture(base => {
  assert.equal(isOwnedClusterDirectory(base,join(base,'cluster')),false);
}));
test('cluster symlink to unrelated location refused', () => fixture(base => {
  const foreign=join(base,'foreign'); mkdirSync(foreign);
  symlinkSync(foreign,join(base,'cluster'),'dir');
  assert.equal(isOwnedClusterDirectory(base,join(base,'cluster')),false);
}));
test('cluster path alias refused', () => fixture(base => {
  mkdirSync(join(base,'cluster'));
  assert.equal(isOwnedClusterDirectory(base,base+'/cluster/../cluster'),false);
}));
test('root symlink refused', () => fixture(base => {
  mkdirSync(join(base,'cluster'));
  const alias=base+'-alias';
  try { symlinkSync(base,alias,'dir'); assert.equal(isOwnedClusterDirectory(alias,join(alias,'cluster')),false); }
  finally { try { rmSync(alias); } catch {} }
}));
test('wrong sibling path refused', () => fixture(base => {
  mkdirSync(join(base,'other'));
  assert.equal(isOwnedClusterDirectory(base,join(base,'other')),false);
}));
test('invalid input refused', () => {
  assert.equal(isOwnedClusterDirectory(null,null),false);
  assert.equal(isOwnedClusterDirectory('',''),false);
});

test('pre-start missing cluster can be cleaned but normal ownership still refuses', () => fixture(base => {
  const cluster=join(base,'cluster');
  assert.equal(isOwnedClusterDirectory(base,cluster),false);
  assert.equal(isOwnedClusterDirectory(base,cluster,{allowMissing:true}),true);
}));
test('pre-start mode still rejects symlink and file substitution', () => fixture(base => {
  const cluster=join(base,'cluster');
  symlinkSync(join(base,'absent'),cluster,'dir');
  assert.equal(isOwnedClusterDirectory(base,cluster,{allowMissing:true}),false);
  rmSync(cluster);
  mkdirSync(cluster);
  assert.equal(isOwnedClusterDirectory(base,cluster,{allowMissing:true}),true);
}));
