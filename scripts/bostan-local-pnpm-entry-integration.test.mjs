import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./bostan-local-postgres-migration-qualification.mjs',import.meta.url),'utf8');
test('cloud, pinned PostgreSQL, repository pnpm pin and pnpm package all predate scratch creation',()=>{
  const run=source.indexOf('async function run() {');
  const cloud=source.indexOf('validatePrivateLocalCloudIsolation(process.env);',run);
  const pg=source.indexOf('const pinnedPgTools = captureLocalPostgresToolchain(process.env.BOSTAN_PG_BIN_DIR);',cloud);
  const rootPin=source.indexOf("const rootPin = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).packageManager;",pg);
  const version=source.indexOf("if (rootPin !== 'pnpm@9.15.4')",rootPin);
  const pnpm=source.indexOf('const pinnedPnpm = captureLocalPinnedPnpm(process.env.BOSTAN_PNPM_PACKAGE_DIR);',version);
  const scratch=source.indexOf('const ephemeral = mkdtempSync(',pnpm);
  assert(run>=0&&cloud>run&&pg>cloud&&rootPin>pg&&version>rootPin&&pnpm>version&&scratch>pnpm);
});
test('migration runner never invokes cmd.exe, pnpm.cmd, Corepack, or bare pnpm',()=>{
  assert(!source.includes('process.env.ComSpec'));
  assert(!source.includes("'cmd.exe'"));
  assert(!source.includes("'pnpm.cmd'"));
  assert(!source.includes("exec('pnpm'"));
  assert(source.includes("const executable = isPg ? pinnedPgTools.pathFor(command) : process.execPath;"));
  assert(source.includes("command === 'pnpm' ? [pinnedPnpm.pathForNode(), ...args] : args"));
});
test('real migrateDatabase function delegates to pinned pnpm rather than shell',()=>{
  const start=source.indexOf('function migrateDatabase(env, timeout, qaExec) {');
  const end=source.indexOf('\n\nasync function run()',start);
  assert(start>=0 && end>start);
  const migration=vm.runInNewContext('('+source.slice(start,end)+')',{Error});
  const env={HOME:'/owned/qa',PGHOST:'127.0.0.1'};
  const calls=[];
  assert.equal(migration(env,12000,(name,args,opts)=>{calls.push({name,args,opts});return 'Migrations complete';}),'Migrations complete');
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,'pnpm');
  assert.deepEqual(Array.from(calls[0].args),['--filter','@bostan/db','migrate']);
  assert.equal(calls[0].opts.env,env);
  assert.equal(calls[0].opts.timeout,12000);
});
function actualQaExecContext(){
  const start=source.indexOf('  const qaExec = (command, args, options = {}) => {');
  const end=source.indexOf('  };\n  try {',start);
  assert(start>=0 && end>start);
  const expression=source.slice(start,end+4);
  const make=vm.runInNewContext('(function(profileOwned,LOCAL_PG_TOOLS,pinnedPgTools,pinnedPnpm,exec,isolatedEnv,process){'+expression+'\nreturn qaExec;})',{Error});
  let valid=true;let calls=[];
  const ownedEnv={HOME:'/owned/qa',PGHOST:'127.0.0.1'};
  const obj=make(()=>valid,['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore'],
    {pathFor:name=>'/physical/pg/'+name},{pathForNode:()=>'/physical/pnpm/bin/pnpm.cjs'},
    (name,args,options)=>{calls.push({name,args,options});return 'ok';},
    ownedEnv,{execPath:'/host/node'});
  return {qa:obj,calls,ownedEnv,setValid:x=>{valid=x;}};
}
test('qaExec sends pnpm to process.execPath and prepends physical pnpm.cjs',()=>{
  const f=actualQaExecContext();
  assert.equal(f.qa('pnpm',['--filter','@bostan/db','migrate'],{}),'ok');
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].name,'/host/node');
  assert.deepEqual(Array.from(f.calls[0].args),['/physical/pnpm/bin/pnpm.cjs','--filter','@bostan/db','migrate']);
  assert.equal(f.calls[0].options.env,f.ownedEnv);
  assert.equal(f.calls[0].options.diagnosticTool,'pnpm');
});
test('qaExec preserves physical PostgreSQL binary pinning, restored env and diagnostic tool label',()=>{
  const f=actualQaExecContext();const restore={...f.ownedEnv,PGDATABASE:'restored'};
  assert.equal(f.qa('psql',['--version'],{env:restore}),'ok');
  assert.equal(f.calls[0].name,'/physical/pg/psql');
  assert.equal(f.calls[0].options.env,restore);
  assert.equal(f.calls[0].options.diagnosticTool,'psql');
});
test('qaExec denies unverified private home before any Node or PostgreSQL child',()=>{
  const f=actualQaExecContext();f.setValid(false);
  assert.throws(()=>f.qa('pnpm',[],{}),/retaining fixture/);
  assert.throws(()=>f.qa('pg_ctl',[],{}),/retaining fixture/);
  assert.equal(f.calls.length,0);
});
test('qaExec denies arbitrary executable names before filesystem or process execution',()=>{
  const f=actualQaExecContext();
  for(const name of ['cmd.exe','bash','pnpm.cmd','/foreign/binary'])
    assert.throws(()=>f.qa(name,[],{}),/retaining fixture/);
  assert.equal(f.calls.length,0);
});
test('workspace packageManager remains exactly pnpm 9.15.4',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.packageManager,'pnpm@9.15.4');
  assert(source.includes("if (rootPin !== 'pnpm@9.15.4')"));
});
