import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildIsolatedLocalPostgresEnv as buildEnv } from './bostan-local-postgres-isolated-env.mjs';
const input={port:34567,identity:'bostan_verify',database:'bostan_qualification',configPath:'/tmp/qa/absent.json'};
const build=env=>buildEnv(env,input);
const secrets={OPENAI_API_KEY:'synthetic-secret',GITHUB_TOKEN:'synthetic-gh',AWS_SECRET_ACCESS_KEY:'synthetic-aws',NPM_TOKEN:'synthetic-npm',PAPERCLIP_API_KEY:'synthetic-paperclip',DATABASE_URL:'postgres://foreign',BOSTAN_CLOUD_SESSION:'synthetic-cloud',NODE_OPTIONS:'--require /tmp/evil.js',LD_PRELOAD:'/tmp/evil.so',DYLD_INSERT_LIBRARIES:'/tmp/evil.dylib',PGPASSWORD:'synthetic-pg',PGHOSTADDR:'192.0.2.31'};
test('ambient API tokens, cloud config, native preload, Node hooks and PG secrets are excluded',()=>{
  const env=build({...secrets,PATH:'/usr/bin',HOME:'/home/qa'});
  for (const name of Object.keys(secrets)) {
    if(name==='DATABASE_URL'||name==='PGHOSTADDR')continue;
    assert.equal(Object.hasOwn(env,name),false,name);
  }
  assert.equal(env.PGHOSTADDR,'127.0.0.1');
  assert.equal(env.DATABASE_URL,'postgres://bostan_verify@127.0.0.1:34567/bostan_qualification');
});
test('actual child process cannot see inherited credential names',()=>{
  const env=build({...secrets,PATH:process.env.PATH||'/usr/bin',HOME:'/tmp/qa',TERM:'xterm'});
  const child=spawnSync(process.execPath,['-e',`process.stdout.write(JSON.stringify(['OPENAI_API_KEY','GITHUB_TOKEN','AWS_SECRET_ACCESS_KEY','NPM_TOKEN','NODE_OPTIONS','LD_PRELOAD','PGPASSWORD'].filter(k=>Object.hasOwn(process.env,k))))`],{env,encoding:'utf8',timeout:5000});
  assert.equal(child.status,0,child.error?.code);
  assert.deepEqual(JSON.parse(child.stdout),[]);
});
test('preserves only minimum platform runtime keys and both Path variants individually',()=>{
  const env=build({Path:'C:\\Node',SystemRoot:'C:\\Windows',TEMP:'D:\\qa',APPDATA:'D:\\app',LOCALAPPDATA:'D:\\local',HOMEDRIVE:'D:',PNPM_HOME:'D:\\pnpm',LANG:'en_US.UTF-8',AWS_PROFILE:'private',GIT_CONFIG_GLOBAL:'/private/config',PAPERCLIP_MANAGED_CONFIG:'remote'});
  for(const name of ['Path','SystemRoot','TEMP','APPDATA','LOCALAPPDATA','HOMEDRIVE','PNPM_HOME','LANG'])assert(Object.hasOwn(env,name),name);
  for(const name of ['AWS_PROFILE','GIT_CONFIG_GLOBAL','PAPERCLIP_MANAGED_CONFIG'])assert(!Object.hasOwn(env,name),name);
});
test('duplicate case-folded PATH and Path are refused before child spawn',()=>{
  assert.throws(()=>build({PATH:'/usr/bin',Path:'/wrong'}),e=>e.message==='invalid_local_postgres_env');
});
test('inherited PG aliases and app configuration never override synthetic local proof',()=>{
  const env=build({pghostaddr:'other',PGSERVICE:'other',database_url:'foreign',paperclip_config:'foreign',PGUSER:'root'});
  assert.equal(env.PGHOST,'127.0.0.1');assert.equal(env.PGHOSTADDR,'127.0.0.1');assert.equal(env.PGUSER,'bostan_verify');assert.equal(env.PAPERCLIP_CONFIG,input.configPath);
});
test('special character and unsupported types do not enter child env',()=>{
  const env=build({PATH:'/usr/bin\0bad',HOME:{secret:'x'},APPDATA:null,COMSPEC:'/safe/cmd.exe'});
  assert(!Object.hasOwn(env,'PATH'));assert(!Object.hasOwn(env,'HOME'));assert(!Object.hasOwn(env,'APPDATA'));assert.equal(env.COMSPEC,'/safe/cmd.exe');
});
test('source environment is not mutated',()=>{
  const ambient={PATH:'/bin',OPENAI_API_KEY:'synthetic'};const before={...ambient};build(ambient);assert.deepEqual(ambient,before);
});
