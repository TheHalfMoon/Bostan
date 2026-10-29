import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isPrivateWindowsQaEntryAllowed as allowed } from './bostan-private-windows-entry-admission.mjs';

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'bostan-b135-shared-'));
  t.after(() => rm(parent,{recursive:true,force:true}));
  const root = join(parent,'Bostan-B135-qa');
  const marker = join(parent,'BOSTAN_QA_OWNED');
  await mkdir(root);
  await writeFile(marker,'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n');
  const env = {BOSTAN_PRIVATE_QA_ENTRY:'B087_TEST_ONLY',
    BOSTAN_PRIVATE_QA_MARKER:marker,
    DATABASE_URL:'postgres://synthetic:synthetic@127.0.0.1:54330/qa',
    PAPERCLIP_DEPLOYMENT_MODE:'authenticated',
    PAPERCLIP_DEPLOYMENT_EXPOSURE:'private'};
  return {parent,root,marker,env,platform:'win32'};
}
test('shared admission permits only synthetic Win32 fixture',async t=>{
  const f=await fixture(t);
  assert.equal(allowed(f),true);
  assert.equal(allowed({...f,platform:'linux'}),false);
  assert.equal(allowed({...f,root:join(f.parent,'user-profile')}),false);
});
test('shared admission refuses missing, modified, linked or directory markers',async t=>{
  const f=await fixture(t);
  const missing={...f,env:{...f.env,BOSTAN_PRIVATE_QA_MARKER:join(f.parent,'missing')}};
  assert.equal(allowed(missing),false);
  await writeFile(f.marker,'MUTATED');
  assert.equal(allowed(f),false);
  const owned=join(f.parent,'owned');
  await writeFile(owned,'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n');
  await rm(f.marker);
  await symlink(owned,f.marker,'file');
  assert.equal(allowed(f),false);
  await rm(f.marker);
  await mkdir(f.marker);
  assert.equal(allowed(f),false);
  assert.equal(await readFile(owned,'utf8'),'BOSTAN_PRIVATE_SYNTHETIC_ONLY\n');
});
test('shared admission refuses remote DB, cloud and public deployment',async t=>{
  const f=await fixture(t);
  for(const [key,value] of [
    ['BOSTAN_PRIVATE_QA_ENTRY','NORMAL'],
    ['DATABASE_URL','postgres://x:y@evil.test:5432/db'],
    ['DATABASE_URL','postgres://x:y@127.0.0.1:123/db'],
    ['PAPERCLIP_DEPLOYMENT_MODE','local_trusted'],
    ['PAPERCLIP_DEPLOYMENT_EXPOSURE','public'],
    ['PAPERCLIP_CLOUD_TOKEN','hidden'],
    ['BOSTAN_CLOUD_AUTH','hidden'],
    ['PAPERCLIP_MANAGED_CONFIG','1'],
  ]) assert.equal(allowed({...f,env:{...f.env,[key]:value}}),false,key);
});
test('Node compiled --import guard exits before loading an unrelated module',async t=>{
  const f=await fixture(t);
  const moduleFile=join(f.parent,'DO_NOT_RUN.mjs');
  const sentinel=join(f.parent,'server-ran.txt');
  await writeFile(moduleFile,
    "import {writeFileSync} from 'node:fs';writeFileSync("+JSON.stringify(sentinel)+",'RAN');");
  const guard=pathToFileURL(new URL('./bostan-private-windows-compiled-entry-guard.mjs',import.meta.url).pathname).href;
  const child=spawnSync(process.execPath,['--import',guard,moduleFile],
    {cwd:f.root,encoding:'utf8',env:{...process.env,...f.env},timeout:5000});
  assert.equal(child.status,2,child.stderr);
  assert.match(child.stderr,/unsafe synthetic QA fixture/);
  await assert.rejects(readFile(sentinel),{code:'ENOENT'});
});
