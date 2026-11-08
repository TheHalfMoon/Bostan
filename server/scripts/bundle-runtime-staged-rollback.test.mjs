import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, lstat, readFile, readdir, rm, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildAndCommitCompiledRuntime, commitCompiledRuntimeOutputs } from './bundle-runtime-commit.mjs';
const SCHEMA='bostan.compiled-runtime-owner.v1';
const sha=buf=>createHash('sha256').update(buf).digest('hex');
const response=(dir, contents='NEW')=>({outputFiles:[
  {path:join(dir,'index.mjs'),contents:Buffer.from('import "./server.mjs";')},
  {path:join(dir,'server.mjs'),contents:Buffer.from(contents)}]});
async function owner(entry, dir, paths) {
  const files=[];
  for(const file of paths) files.push({name:file.split(/[\\/]/).at(-1),sha256:sha(await readFile(file))});
  const manifest={schema:SCHEMA,entry:resolve(entry),outdir:resolve(dir),files};
  await writeFile(join(dir,'.bostan-compiled-runtime-owner.json'),JSON.stringify(manifest),{flag:'wx'});
}
function APIs(entry, dir, {ownerCallback=owner}={}) {
  return {
    assertSafeRuntimeOutdir: async (e,d)=>{
      assert.equal(e,entry);assert.equal(d,dir);
      const names=await readdir(dir).catch(x=>x.code==='ENOENT'?[]:Promise.reject(x));
      if (names.includes('.bostan-compiled-runtime-owner.json')) {
        const m=JSON.parse(await readFile(join(dir,'.bostan-compiled-runtime-owner.json'),'utf8'));
        assert.equal(m.outdir,dir);
        assert.deepEqual(names.sort(),[...m.files.map(x=>x.name),'.bostan-compiled-runtime-owner.json'].sort());
        for(const f of m.files) assert.equal(sha(await readFile(join(dir,f.name))),f.sha256);
      }
      return d;
    },
    recordRuntimeOutputOwnership: ownerCallback,
  };
}
async function fixture(t, old='OLD') {
  const root=await mkdtemp(join(tmpdir(),'bostan-b128-owned-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const dir=join(root,'runtime'); const entry=join(root,'entry.js');
  await writeFile(entry,'export {}');
  await mkdir(dir);
  if(old!==null){
    for (const [name,content] of [['index.mjs','import "./server.mjs";'],['server.mjs',old]])
      await writeFile(join(dir,name),content);
    await owner(entry,dir,[join(dir,'index.mjs'),join(dir,'server.mjs')]);
  }
  return {root,dir,entry,...APIs(entry,dir)};
}
test('stages compiled files, promotes and safely removes exact owned backup',async t=>{
  const f=await fixture(t);const out=await commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:response(f.dir)});
  assert.equal(out,f.dir);
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'NEW');
  assert.deepEqual(await readdir(f.root),['entry.js','runtime']);
});
test('same-volume staged outputs preserve old bundle on simulated rename failure',async t=>{
  const f=await fixture(t);let renames=0;
  await assert.rejects(commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:response(f.dir),renameDirectory:async(a,b)=>{
    renames++;if(renames===2)throw Error('synthetic rename permission denied');
    return rename(a,b);
  }}),/rename permission denied/);
  assert.equal(renames,3);
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'OLD');
  assert.equal(JSON.parse(await readFile(join(f.dir,'.bostan-compiled-runtime-owner.json'),'utf8')).schema,SCHEMA);
  assert.deepEqual(await readdir(f.root), ['entry.js','runtime']);
});
test('owner manifest-write failure restores old runtime after new staged promotion',async t=>{
  const f=await fixture(t);
  await assert.rejects(commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:response(f.dir),
    recordRuntimeOutputOwnership:async()=>{throw Error('synthetic marker write failure')}
  }),/marker write failure/);
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'OLD');
  const names=await readdir(f.root);
  assert.ok(names.some(name=>name.includes('-rejected-')));
  assert.ok(!names.some(name=>name.includes('-rollback-')));
});
test('failed compile never stages or changes last known good files',async t=>{
  const f=await fixture(t);
  await assert.rejects(buildAndCommitCompiledRuntime({...f,outdir:f.dir,options:{write:true},
    buildRuntime:async o=>{assert.equal(o.write,false);throw Error('synthetic syntax failure')}
  }),/syntax failure/);
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'OLD');
  assert.deepEqual(await readdir(f.root),['entry.js','runtime']);
});
test('admission rejection while stage prepared does not rename old bundle',async t=>{
  const f=await fixture(t);let n=0;
  await assert.rejects(commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:response(f.dir),
    assertSafeRuntimeOutdir:async()=>{if(++n===2)throw Error('synthetic admission changed');return f.dir}
  }),/admission changed/);
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'OLD');
});
test('malformed, nested, duplicate and escaping generated outputs do not rename old',async t=>{
  const f=await fixture(t);const good=response(f.dir).outputFiles;
  for(const invalid of [
    {outputFiles:[good[0]]},
    {outputFiles:[...good,good[0]]},
    {outputFiles:[...good,{path:join(f.root,'escaped.mjs'),contents:Buffer.from('x')}]},
    {outputFiles:[...good,{path:join(f.dir,'nested','strange.mjs'),contents:Buffer.from('x')}]},
    {outputFiles:[good[0],{path:join(f.dir,'server.mjs'),contents:'not bytes'}]},
  ]){
    await assert.rejects(commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:invalid}),/not safely isolated/);
    assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'OLD');
  }
});
test('new empty destination promotes without old backup',async t=>{
  const f=await fixture(t,null);
  await commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:response(f.dir)});
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'NEW');
  assert.deepEqual(await readdir(f.root),['entry.js','runtime']);
});
test('never deletes a backup if a foreign file appears in it after promotion',async t=>{
  const f=await fixture(t);const originalOwner=f.recordRuntimeOutputOwnership;
  let backupDir;
  await commitCompiledRuntimeOutputs({...f,outdir:f.dir,result:response(f.dir),
    recordRuntimeOutputOwnership:async(...args)=>{
      backupDir=(await readdir(f.root)).find(x=>x.includes('-rollback-'));
      assert.ok(backupDir);
      await writeFile(join(f.root,backupDir,'EXTERNAL_KEEP_ME.txt'),'safeguard');
      return originalOwner(...args);
    },
  });
  assert.equal(await readFile(join(f.dir,'server.mjs'),'utf8'),'NEW');
  assert.equal(await readFile(join(f.root,backupDir,'EXTERNAL_KEEP_ME.txt'),'utf8'),'safeguard');
});
