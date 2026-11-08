import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { recoverInterruptedRuntime } from './bundle-runtime-recovery.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const MARKER = '.bostan-compiled-runtime-owner.json';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-b129-owned-'));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const entry = join(root, 'entry.js');
  const outdir = join(root, 'runtime');
  await writeFile(entry, 'export {};\n');
  const prefix = `.bostan-${basename(outdir)}-rollback-`;
  const files = [
    { name: 'index.mjs', body: 'import "./server.mjs";\n' },
    { name: 'server.mjs', body: 'console.log("OLD_WORKING");\n' },
  ];
  async function createBackup() {
    const backup = join(root, prefix + randomUUID());
    await mkdir(backup);
    for (const {name, body} of files) await writeFile(join(backup,name),body);
    const manifest = {
      schema: 'bostan.compiled-runtime-owner.v1', entry: resolve(entry), outdir: resolve(outdir),
      files: files.map(({name,body})=>({name,sha256:digest(body)})),
    };
    await writeFile(join(backup,MARKER),JSON.stringify(manifest));
    return backup;
  }
  async function assertSafeRuntimeOutdir(source, destination) {
    assert.equal(source, entry);
    assert.equal(destination, outdir);
    assert.ok((await lstat(entry)).isFile());
    const info = await lstat(outdir).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
    if (info) {
      assert.ok(info.isDirectory());
      assert.equal(await readFile(join(outdir, 'server.mjs'),'utf8'), files[1].body);
    }
    return outdir;
  }
  return {root,entry,outdir,prefix,createBackup,assertSafeRuntimeOutdir};
}

const recover = f => recoverInterruptedRuntime(f);

test('restores one fully verified backup after interrupted rename', async t => {
  const f=await fixture(t); const backup=await f.createBackup();
  assert.equal(await recover(f), 'restored');
  assert.equal(await readFile(join(f.outdir,'server.mjs'),'utf8'), 'console.log("OLD_WORKING");\n');
  await assert.rejects(lstat(backup), {code:'ENOENT'});
  assert.equal(await recover(f), 'present');
});

test('absence of backup leaves destination absent', async t=>{
  const f=await fixture(t);
  assert.equal(await recover(f),'none');
  assert.deepEqual((await readdir(f.root)).sort(),['entry.js']);
});

test('never overwrites an existing runtime even when backup is valid', async t => {
  const f=await fixture(t);const backup=await f.createBackup();
  await mkdir(f.outdir);
  await writeFile(join(f.outdir, 'server.mjs'), 'console.log("OLD_WORKING");\n');
  assert.equal(await recover(f), 'present');
  assert.ok((await lstat(backup)).isDirectory());
});

test('malformed or ambiguous candidate names fail closed', async t=>{
  const f=await fixture(t); const a=await f.createBackup();const b=await f.createBackup();
  await assert.rejects(recover(f), /not safely isolated/);
  assert.ok((await lstat(a)).isDirectory());assert.ok((await lstat(b)).isDirectory());
  await rm(b,{recursive:true});
  await rename(a, join(f.root,f.prefix+'not-a-uuid'));
  await assert.rejects(recover(f), /not safely isolated/);
});

test('foreign file in backup preserves backup and refuses restore',async t=>{
  const f=await fixture(t);const backup=await f.createBackup();
  await writeFile(join(backup,'DO_NOT_DELETE.txt'),'keep');
  await assert.rejects(recover(f), /not safely isolated/);
  assert.equal(await readFile(join(backup,'DO_NOT_DELETE.txt'),'utf8'),'keep');
});

test('changed compiled chunk hash refuses restore', async t=>{
  const f=await fixture(t);const backup=await f.createBackup();
  await writeFile(join(backup,'server.mjs'),'changed');
  await assert.rejects(recover(f), /not safely isolated/);
  assert.equal(await readFile(join(backup,'server.mjs'),'utf8'),'changed');
});

test('backup with copied marker bound to different source is rejected', async t=>{
  const f=await fixture(t);const backup=await f.createBackup();
  const marker=JSON.parse(await readFile(join(backup,MARKER),'utf8'));
  marker.entry=join(f.root,'different.js');
  await writeFile(join(backup,MARKER),JSON.stringify(marker));
  await assert.rejects(recover(f), /not safely isolated/);
});

test('a symlinked backup cannot be restored', async t=>{
  const f=await fixture(t);const original=await f.createBackup();
  const moved=join(f.root,'original-safe');await rename(original,moved);
  try { await symlink(moved,original,process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM','EACCES'].includes(error?.code)) { t.skip('Windows link privilege unavailable'); return; }
    throw error;
  }
  await assert.rejects(recover(f), /not safely isolated/);
  assert.ok((await lstat(moved)).isDirectory());
});

test('a symlinked file inside backup cannot be restored',async t=>{
  const f=await fixture(t);const backup=await f.createBackup();
  const path=join(backup,'server.mjs');
  const moved=join(f.root,'old-server.mjs');await rename(path,moved);
  try { await symlink(moved,path,'file'); }
  catch (error) {
    if (['EPERM','EACCES'].includes(error?.code)) { t.skip('Windows file symlink privilege unavailable'); return; }
    throw error;
  }
  await assert.rejects(recover(f), /not safely isolated/);
  assert.equal(await readFile(moved,'utf8'),'console.log("OLD_WORKING");\n');
});

test('failed destination rename leaves old backup unmodified',async t=>{
  const f=await fixture(t);const backup=await f.createBackup();
  await assert.rejects(recoverInterruptedRuntime({...f,renameDirectory:async()=>{throw Error('synthetic EACCES')}}),/synthetic EACCES/);
  assert.ok((await lstat(backup)).isDirectory());
  await assert.rejects(lstat(f.outdir),{code:'ENOENT'});
});

test('target appearing during final admission refuses restore without mutation',async t=>{
  const f=await fixture(t);const backup=await f.createBackup();
  let n=0;
  await assert.rejects(recoverInterruptedRuntime({...f,assertSafeRuntimeOutdir:async()=>{
    if(++n===2) {await mkdir(f.outdir);await writeFile(join(f.outdir,'keep.txt'),'KEEP');}
    return f.outdir;
  }}),/not safely isolated/);
  assert.equal(await readFile(join(f.outdir,'keep.txt'),'utf8'),'KEEP');
  assert.ok((await lstat(backup)).isDirectory());
});
