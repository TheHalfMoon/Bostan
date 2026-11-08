import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {validatePrivateAdminRace,runPrivateAdminRace} from './bostan-private-staged-admin-race-e2e.mjs';
const script=fileURLToPath(new URL('./bostan-private-staged-admin-race-e2e.mjs',import.meta.url));
const invoke=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});

test('private admin HTTP race fixture is read-only until explicit --run',()=>{
  for(const args of [[],['--plan']]){
    const result=invoke(args);
    assert.equal(result.status,0,result.stderr);
    const plan=JSON.parse(result.stdout);
    assert.equal(plan.releaseQualified,false);
    assert.equal(plan.run,false);
    assert.equal(plan.claimants,8);
  }
  for(const args of [['--publish'],['--run'],['--run','--url','https://evil.test/']]){
    const result=invoke(args);
    assert.notEqual(result.status,0);
  }
});

test('private admin race admits only owned synthetic loopback and authenticated deployment',async()=>{
  const root=mkdtempSync(join(tmpdir(),'bostan-race-admission-'));
  const sentinel=join(root,'BOSTAN_TEMP_OWNED');
  writeFileSync(sentinel,'BOSTAN_TEST_ONLY\n',{mode:0o600});
  const env={BOSTAN_AUTHZ_RACE_HTTP:'1',BOSTAN_TEST_ONLY_SENTINEL:sentinel,
    PAPERCLIP_DEPLOYMENT_MODE:'authenticated',PAPERCLIP_DEPLOYMENT_EXPOSURE:'private',
    PAPERCLIP_AUTH_PUBLIC_BASE_URL:'http://127.0.0.1:45123',
    DATABASE_URL:'postgres://bostan_verify@127.0.0.1:54123/bostan_qualification'};
  try{
    assert.equal(validatePrivateAdminRace('http://127.0.0.1:45123/',env),'http://127.0.0.1:45123');
    for(const bad of [
      {...env,BOSTAN_AUTHZ_RACE_HTTP:'0'},
      {...env,PAPERCLIP_DEPLOYMENT_EXPOSURE:'public'},
      {...env,DATABASE_URL:'postgres://bostan_verify@127.0.0.1:54123/production'},
      {...env,PAPERCLIP_AUTH_PUBLIC_BASE_URL:'http://localhost:45123'},
    ])assert.throws(()=>validatePrivateAdminRace('http://127.0.0.1:45123/',bad));
    let requests=0;
    await assert.rejects(runPrivateAdminRace('http://127.0.0.1:45123/',{
      env:{...env,BOSTAN_AUTHZ_RACE_HTTP:'0'},
      request:async()=>{requests++;throw Error('Should not make any network request');},
    }),/explicitly enabled/);
    assert.equal(requests,0);
    assert.throws(()=>validatePrivateAdminRace('http://example.com:45123/',env));
  }finally{rmSync(root,{recursive:true,force:true})}
});
