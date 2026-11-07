import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./bostan-local-postgres-migration-qualification.mjs',import.meta.url),'utf8');
test('actual runner admits cloud before picking physical PG tools or creating scratch',()=>{
  const run=source.indexOf('async function run() {');
  const cloud=source.indexOf('validatePrivateLocalCloudIsolation(process.env);',run);
  const pin=source.indexOf('const pinnedPgTools = captureLocalPostgresToolchain(process.env.BOSTAN_PG_BIN_DIR);',cloud);
  const scratch=source.indexOf('const ephemeral = mkdtempSync(',pin);
  const version=source.indexOf('qaExec(bin, [\'--version\']',scratch);
  assert(run>=0 && cloud>run && pin>cloud && scratch>pin && version>scratch);
});
test('every named PostgreSQL binary is pinned immediately before its subprocess invocation',()=>{
  const start=source.indexOf('  const qaExec = (command, args, options = {}) => {');
  const end=source.indexOf('  };\n  try {',start);
  const segment=source.slice(start,end);
  assert(start>=0 && end>start);
  assert(segment.includes("LOCAL_PG_TOOLS.includes(command) ? pinnedPgTools.pathFor(command) : command"));
  assert(segment.includes('return exec(executable, args, {...options,diagnosticTool:command});'));
  for(const cmd of ['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore'])
    assert(!source.includes("exec('"+cmd+"'"),cmd);
});
test('real qaExec fragment passes pinned absolute path and refuses after ownership loss',()=>{
  const start=source.indexOf('  const qaExec = (command, args, options = {}) => {');
  const end=source.indexOf('  };\n  try {',start);
  const block=source.slice(start,end+4);
  const make=vm.runInNewContext('(function(profileOwned,pinnedPgTools,LOCAL_PG_TOOLS,exec){'+block+'\nreturn qaExec;})',{Error});
  let allowed=true;let calls=[];
  const runner=make(()=>allowed,{pathFor:name=>'/private/pg/bin/'+name},['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore'],(command,args,opts)=>{calls.push({command,args,opts});return 'ok';});
  assert.equal(runner('initdb',['--version'],{timeout:100}), 'ok');
  assert.equal(calls[0].command,'/private/pg/bin/initdb');
  assert.equal(calls[0].opts.diagnosticTool,'initdb');
  assert.equal(runner('pnpm',[],{}),'ok');assert.equal(calls[1].command,'pnpm');
  allowed=false;assert.throws(()=>runner('pg_ctl',[],{}),/retaining fixture/);
  assert.equal(calls.length,2);
});
test('real exec wrapper still emits bounded command type rather than pinned path',()=>{
  assert(source.includes('command: options.diagnosticTool ?? command,error'));
  assert(source.includes('command:options.diagnosticTool ?? command,status:result.status'));
});
test('CLI help discloses explicit PG binary-directory requirement',()=>{
  assert(source.includes('Requires BOSTAN_PG_BIN_DIR set to the absolute physical PostgreSQL bin directory'));
});
