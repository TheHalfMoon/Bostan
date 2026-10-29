import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildAndCommitCompiledRuntime } from './bundle-runtime-commit.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-b131-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = join(root, 'entry.js');
  const outdir = join(root, 'runtime');
  await writeFile(entry, 'export {};');
  await mkdir(outdir);
  const statReady = async (e, path) => {
    assert.equal(e, entry);
    assert.equal(path, outdir);
    const names = await readdir(outdir).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
    if (names.includes('.bostan-compiled-runtime-owner.json')) {
      const m = JSON.parse(await readFile(join(outdir,'.bostan-compiled-runtime-owner.json'),'utf8'));
      assert.equal(m.outdir, outdir);
      assert.deepEqual(names.sort(), ['.bostan-compiled-runtime-owner.json', ...m.files.map(f=>f.name)].sort());
      for(const f of m.files) assert.equal(createHash('sha256').update(await readFile(join(outdir,f.name))).digest('hex'), f.sha256);
    }
    return path;
  };
  const writeOwnership = async (e, path, paths) => {
    const files = [];
    for (const file of paths) {
      assert.ok((await stat(file)).isFile());
      files.push({name:file.split('/').at(-1),sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
    }
    await writeFile(join(path,'.bostan-compiled-runtime-owner.json'),JSON.stringify({schema:'bostan.compiled-runtime-owner.v1',entry:resolve(e),outdir:resolve(path),files}),{flag:'wx'});
  };
  let release;
  const hold = new Promise(r=> {release=r});
  const outputFiles = [{path:join(outdir,'index.mjs'),contents:Buffer.from('import "./server.mjs";')},{path:join(outdir,'server.mjs'),contents:Buffer.from('VALID')}];
  return {entry,outdir,root,release,hold,assertSafeRuntimeOutdir:statReady,recordRuntimeOutputOwnership:writeOwnership,outputFiles};
}

test('production build wrapper holds the same lock across compilation AND promotion', async t => {
  const f=await fixture(t);
  const lock=join(f.root,'.bostan-runtime-build.lock');
  let running;
  const began = new Promise(r => {running=r});
  const first=buildAndCommitCompiledRuntime({...f,options:{write:true},buildRuntime:async options=>{
    assert.equal(options.write,false);
    assert.equal(options.outdir,f.outdir);
    assert.ok((await stat(lock)).isFile());
    running();
    await f.hold;
    return { outputFiles:f.outputFiles };
  }});
  await began;
  let ran=false;
  await assert.rejects(buildAndCommitCompiledRuntime({...f,options:{},buildRuntime:async()=>{ran=true;return {outputFiles:f.outputFiles}}}),/locked or unsafe/);
  assert.equal(ran,false);
  f.release();
  const result=await first;
  assert.equal(result.admittedOutdir,f.outdir);
  assert.equal(await readFile(join(f.outdir,'server.mjs'),'utf8'),'VALID');
  await assert.rejects(stat(lock),{code:'ENOENT'});
});

test('a compile failure releases a lock and leaves the existing complete runtime intact', async t => {
  const f=await fixture(t);
  await buildAndCommitCompiledRuntime({...f,options:{},buildRuntime:async()=>({outputFiles:f.outputFiles})});
  await assert.rejects(buildAndCommitCompiledRuntime({...f,options:{},buildRuntime:async()=>{throw Error('synthetic broken import')}}),/broken import/);
  assert.equal(await readFile(join(f.outdir,'server.mjs'),'utf8'),'VALID');
  await assert.rejects(stat(join(f.root,'.bostan-runtime-build.lock')),{code:'ENOENT'});
});
