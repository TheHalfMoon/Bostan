import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAuthzFixture,runAuthenticatedIsolation} from './bostan-private-staged-authz-e2e.mjs';
const script=fileURLToPath(new URL('./bostan-private-staged-authz-e2e.mjs',import.meta.url));
function owned(){const dir=mkdtempSync(join(tmpdir(),'bostan-two-session-'));const marker=join(dir,'BOSTAN_TEMP_OWNED');writeFileSync(marker,'BOSTAN_TEST_ONLY\n');return {dir,marker,cleanup:()=>rmSync(dir,{recursive:true,force:true})}}
function environment(marker){return {PAPERCLIP_DEPLOYMENT_MODE:'authenticated',PAPERCLIP_DEPLOYMENT_EXPOSURE:'private',PAPERCLIP_AUTH_PUBLIC_BASE_URL:'http://127.0.0.1:46732',BOSTAN_TEST_ONLY_SENTINEL:marker,DATABASE_URL:'postgres://bostan_verify@127.0.0.1:46548/bostan_qualification'}}
test('real auth scenario cannot write outside a verified disposable local Postgres and private mode',()=>{
  const f=owned();try{
    assert.equal(validateAuthzFixture('http://127.0.0.1:46732/',environment(f.marker)),'http://127.0.0.1:46732');
    for(const url of ['https://127.0.0.1:46732/','http://localhost:46732/','http://127.0.0.1:80/','http://127.0.0.1:46732/extra','http://127.0.0.1:46732/?q=1','http://example.org:46732/'])assert.throws(()=>validateAuthzFixture(url,environment(f.marker)));
    for(const change of [{PAPERCLIP_DEPLOYMENT_MODE:'local_trusted'},{PAPERCLIP_DEPLOYMENT_EXPOSURE:'public'},{PAPERCLIP_AUTH_PUBLIC_BASE_URL:'http://127.0.0.1:9000'},{DATABASE_URL:'postgres://bostan_verify@127.0.0.1:46548/user_production'},{DATABASE_URL:'postgres://bostan_verify@not-local:46548/bostan_qualification'},{BOSTAN_TEST_ONLY_SENTINEL:join(f.dir,'missing')}])assert.throws(()=>validateAuthzFixture('http://127.0.0.1:46732/',{...environment(f.marker),...change}));
  }finally{f.cleanup();}
});
test('synthetic multi-session CLI is read-only without explicit opt-in',()=>{
  const p=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:4000});assert.equal(p.status,0);assert.match(p.stdout,/disposable PostgreSQL sentinel/);
  for(const args of [['--publish'],['--run'],['--run','--url','http://example.org:46732/']])assert.notEqual(spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:4000}).status,0);
});
test('no SQL mutation even with a mocked request if ownership is not verified',async()=>{
  let called=false;
  await assert.rejects(()=>runAuthenticatedIsolation('http://127.0.0.1:46732/',{env:{...environment('/definitely-not-a-test-file')},request:async()=>{called=true;throw Error('unexpected')}}),/marker is missing/);
  assert.equal(called,false);
});
