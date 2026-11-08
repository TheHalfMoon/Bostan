import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSelfContainedPostgresTemplateTree as safe } from './embedded-postgres-template-tree.ts';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bostan-b200-owned-'));
  const data = path.join(root, 'cluster');
  fs.mkdirSync(data, {mode:0o700});
  const config = path.join(data, 'postgresql.conf');
  fs.writeFileSync(config, "shared_preload_libraries = ''\n", {mode:0o600});
  t.after(() => {
    const info = fs.lstatSync(root);
    assert(info.isDirectory() && !info.isSymbolicLink());
    fs.rmSync(root,{recursive:true,force:false});
  });
  return {root,data,config};
}

test('owner-only regular configuration file is accepted',t=>{
  const {data,config}=fixture(t);
  fs.chmodSync(config,0o600);
  assert.equal(safe(data),true);
});
test('group-writable PostgreSQL configuration is rejected',{skip:process.getuid===undefined},t=>{
  const {data,config}=fixture(t);
  fs.chmodSync(config,0o660);
  assert.equal(safe(data),false);
});
test('world-writable PostgreSQL configuration is rejected',{skip:process.getuid===undefined},t=>{
  const {data,config}=fixture(t);
  fs.chmodSync(config,0o606);
  assert.equal(safe(data),false);
});
test('group-writable nested directory remains rejected',{skip:process.getuid===undefined},t=>{
  const {data}=fixture(t);
  const nested=path.join(data,'base');
  fs.mkdirSync(nested,{mode:0o700});
  fs.chmodSync(nested,0o770);
  assert.equal(safe(data),false);
});
