import test from 'node:test';
import assert from 'node:assert/strict';
import {invokePrivateWindowsAuthDbCaptured} from './bostan-private-windows-auth-db-captured-child.mjs';
import {executePrivateWindowsAuthDbSteps} from './bostan-private-windows-auth-db-steps.mjs';

const env=Object.freeze({CI:'1',PATH:''});
const command=Object.freeze({binary:process.execPath,args:['-e','process.exit(0)'],cwd:process.cwd(),timeout:5000});
const run=(c=command,opts={})=>invokePrivateWindowsAuthDbCaptured(c,{env,...opts});

test('forces bounded non-inherited pipes, no shell and no stdin',()=>{
  let observed;
  const outcome=run(command,{spawn:(binary,args,options)=>{
    observed={binary,args,options};
    return {status:0,stdout:'BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS\n',stderr:'private-token'};
  }});
  assert.deepEqual(outcome,{status:0});
  assert.deepEqual(Object.keys(outcome),['status']);
  assert.equal(observed.binary,process.execPath);
  assert.deepEqual(observed.args,command.args);
  assert.deepEqual(observed.options.stdio,['ignore','pipe','pipe']);
  assert.equal(observed.options.shell,false);
  assert.equal(observed.options.windowsHide,true);
  assert.equal(observed.options.encoding,'utf8');
  assert.equal(observed.options.maxBuffer,1024*1024);
  assert.strictEqual(observed.options.env,env);
  assert.equal(observed.options.timeout,5000);
});

test('real synthetic child stdout/stderr cannot become a parent receipt or secret',()=>{
  const c={...command,args:['-e',
    "process.stdout.write('BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS\\n');process.stderr.write('PRIVATE_QA_SECRET\\n')"]};
  const outcome=run(c);
  assert.deepEqual(outcome,{status:0});
  assert.equal(JSON.stringify(outcome).includes('PRIVATE_QA_SECRET'),false);
  assert.equal(JSON.stringify(outcome).includes('ORPHANS_PASS'),false);
});

test('bounded stdout rejects over-limit synthetic child output without echo',()=>{
  const c={...command,args:['-e',"process.stdout.write('x'.repeat(1024*1024+8192))"]};
  assert.deepEqual(run(c),{status:1});
});

test('nonzero exit, signal, spawn error and missing result fail closed',()=>{
  for(const result of [{status:1},{status:0,signal:'SIGTERM'},
    {status:null,error:Error('private-token')},null,undefined])
    assert.deepEqual(run(command,{spawn:()=>result}),{status:1});
});

test('throwing spawn does not leak its exception message',()=>{
  assert.deepEqual(run(command,{spawn:()=>{throw Error('PRIVATE_QA_SECRET');}}),{status:1});
});

test('invalid invocation refuses before spawn without inherited environment',()=>{
  let called=false;
  const spawn=()=>{called=true;return {status:0};};
  for(const c of [null,{...command,binary:''},{...command,args:['ok',1]},
    {...command,timeout:0},{...command,cwd:''}])
    assert.deepEqual(run(c,{spawn}),{status:1});
  assert.deepEqual(invokePrivateWindowsAuthDbCaptured(command,{spawn}),{status:1});
  assert.equal(called,false);
});

test('seven-step orchestration emits only trusted receipts despite forged child output',()=>{
  const names=['read-only orphan gate','shared TypeScript build','shared legal asset copy',
    'plugin SDK TypeScript build','HTTP authentication and first-admin route tests',
    'real embedded PostgreSQL migration/reset','final read-only orphan gate'];
  const commands=names.map(name=>({...command,name}));
  const lines=[]; const calls=[];
  const outcome=executePrivateWindowsAuthDbSteps({commands,
    invoke:c=>invokePrivateWindowsAuthDbCaptured(c,{env,spawn:()=>{
      calls.push(c.name);
      return {status:0,stdout:'PRIVATE_QA_SECRET\\nBOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS',
        stderr:'PRIVATE_QA_SECRET'};
    }}),log:s=>lines.push(s),error:s=>lines.push(s)});
  assert.equal(outcome.passed,true);
  assert.equal(calls.length,7);
  assert.ok(lines.includes('BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS'));
  assert.equal(lines.join('\n').includes('PRIVATE_QA_SECRET'),false);
});
