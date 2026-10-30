import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {instrumentPrivateRuntimeModule} from './bostan-private-windows-chunk-eval-trace.mjs';

test('owned packed ESM receives a fixed digest-only evaluation marker',async()=>{
  const root=await mkdtemp(join(tmpdir(),'bostan-private-chunk-unit-'));
  try{
    const runtime=join(root,'server','dist-runtime');
    await mkdir(runtime,{recursive:true});
    const file=join(runtime,'chunk-ABCD1234.mjs');
    await writeFile(file,'export const answer=42;\n');
    const transformed=instrumentPrivateRuntimeModule({
      root,url:pathToFileURL(file).href,format:'module',source:'export const answer=42;\n',
    });
    assert.match(transformed.id,/^[a-f0-9]{12}$/);
    assert.match(transformed.source,/^globalThis\[Symbol\.for\(/);
    assert.match(transformed.source,/export const answer=42/);
    assert.doesNotMatch(transformed.source,new RegExp(root));
    assert.equal(instrumentPrivateRuntimeModule({
      root,url:pathToFileURL(file).href,format:'commonjs',source:'hi',
    }),null);
    assert.equal(instrumentPrivateRuntimeModule({
      root,url:pathToFileURL(join(root,'outside.mjs')).href,
      format:'module',source:'hi',
    }),null);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('linked packed module escaping owned runtime fails closed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'bostan-private-chunk-link-'));
  try{
    const runtime=join(root,'server','dist-runtime');
    await mkdir(runtime,{recursive:true});
    const outside=join(root,'outside.mjs');
    await writeFile(outside,'export default 1;');
    const linked=join(runtime,'chunk-ABCD1234.mjs');
    await symlink(outside,linked);
    assert.throws(()=>instrumentPrivateRuntimeModule({
      root,url:pathToFileURL(linked).href,format:'module',source:'export default 1;',
    }),/linked runtime escape/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('unrecognized packed filenames are not instrumented',async()=>{
  const root=await mkdtemp(join(tmpdir(),'bostan-private-chunk-name-'));
  try{
    const runtime=join(root,'server','dist-runtime');
    await mkdir(runtime,{recursive:true});
    const file=join(runtime,'unexpected.mjs');
    await writeFile(file,'export default 1;');
    assert.equal(instrumentPrivateRuntimeModule({
      root,url:pathToFileURL(file).href,format:'module',source:'export default 1;',
    }),null);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('actual Node ESM hook traces entered packed modules without paths',async()=>{
  const {spawnSync}=await import('node:child_process');
  const root=await mkdtemp(join(tmpdir(),'bostan-private-chunk-real-'));
  try{
    const runtime=join(root,'server','dist-runtime');
    await mkdir(runtime,{recursive:true});
    await writeFile(join(runtime,'chunk-ABCD1234.mjs'),'export const value=42;\n');
    await writeFile(join(runtime,'index.mjs'),
      'import {value} from "./chunk-ABCD1234.mjs"; console.log("SYNTHETIC="+value);\n');
    const helper=new URL('./bostan-private-windows-chunk-eval-trace.mjs',import.meta.url).href;
    const script='import {pathToFileURL} from "node:url";'+
      'const {installPrivateRuntimeEvaluationTrace}=await import(process.argv[2]);'+
      'installPrivateRuntimeEvaluationTrace({root:process.argv[1]});'+
      'await import(pathToFileURL(process.argv[1]+"/server/dist-runtime/index.mjs"));';
    const run=spawnSync(process.execPath,
      ['--input-type=module','--eval',script,root,helper],
      {encoding:'utf8',timeout:8000});
    assert.equal(run.status,0,'owned synthetic Node load must exit zero');
    assert.match(run.stdout,/SYNTHETIC=42/);
    assert.equal((run.stderr.match(/BOSTAN_WIN_CHUNK_EVAL=[a-f0-9]{12}/g)||[]).length,2);
    assert.doesNotMatch(run.stderr,new RegExp(root));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('private preload denies an unowned process before application entry',async()=>{
  const {spawnSync}=await import('node:child_process');
  const preload=new URL('./bostan-private-windows-chunk-eval-preload.mjs',import.meta.url).href;
  const child=spawnSync(process.execPath,
    ['--import',preload,'--eval','console.log("APP_WOULD_HAVE_RUN")'],
    {encoding:'utf8',timeout:8000,env:{PATH:process.env.PATH}});
  assert.equal(child.status,2);
  assert.doesNotMatch(child.stdout,/APP_WOULD_HAVE_RUN/);
  assert.match(child.stderr,/BOSTAN_WIN_CHUNK_EVAL_TRACE_REFUSED/);
});
