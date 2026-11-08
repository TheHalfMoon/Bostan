import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {validatePrivateLocalCloudIsolation} from './bostan-private-local-cloud-isolation.mjs';
const path=fileURLToPath(new URL('./bostan-private-local-cloud-isolation.mjs',import.meta.url));
const call=(args,extra={})=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>
    key!=='PAPERCLIP_MANAGED_CONFIG'&&key!=='PAPERCLIP_PRIMARY_HOST'&&
    !key.startsWith('PAPERCLIP_CLOUD_')&&!key.startsWith('BOSTAN_CLOUD_')));
  return spawnSync(process.execPath,[path,...args],{env:{...env,...extra},encoding:'utf8',timeout:5000});
};
test('inert default/plan and no publication or silent mutation modes',()=>{
  for(const args of [[],['--plan']]){
    const result=call(args);
    assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).run,false);
  }
  for(const args of [['--publish'],['--run'],['--check','--publish']]){
    assert.equal(call(args).status,2);
  }
});
test('empty isolated local environment admits synthetic QA without Cloud',()=>{
  const result=validatePrivateLocalCloudIsolation({
    PAPERCLIP_DEPLOYMENT_MODE:'authenticated',PAPERCLIP_DEPLOYMENT_EXPOSURE:'private',
    BOSTAN_FEEDBACK_EXPORT_ENABLED:'0',
  });
  assert.equal(result.qualified,true);
  assert.equal(result.releaseQualified,false);
  assert.equal(result.cloudEnvironmentSignals,0);
  assert.equal(call(['--check']).status,0);
});
test('all upstream managed/cloud env signals fail closed even when blank',()=>{
  for(const key of ['PAPERCLIP_CLOUD_TENANT_SERVER_TOKEN','PAPERCLIP_MANAGED_CONFIG',
    'PAPERCLIP_CLOUD_API_ORIGIN','PAPERCLIP_CLOUD_STACK_ID',
    'PAPERCLIP_CLOUD_UI_SNIPPET','PAPERCLIP_PRIMARY_HOST','BOSTAN_CLOUD_API_ORIGIN']){
    for(const value of ['','fixture-secret']){
      assert.throws(()=>validatePrivateLocalCloudIsolation({[key]:value}),/refuses managed\/Cloud environment keys/);
      const r=call(['--check'],{[key]:value});
      assert.equal(r.status,2,`Must refuse ${key}`);
      assert.ok(!r.stderr.includes('fixture-secret'),'Never print variable values');
      assert.ok(r.stderr.includes(key),'Report only offending key name');
    }
  }
});
