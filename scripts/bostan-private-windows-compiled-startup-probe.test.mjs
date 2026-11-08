import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  COMPILED_IMPORT_START, COMPILED_IMPORT_PENDING,
  startCompiledStartupProbe,
} from "./bostan-private-windows-compiled-startup-probe.mjs";

test("startup probe refuses non-Windows and missing/wrong synthetic authorization", () => {
  let called = 0;
  const opts = {
    emit: () => called++,
    schedule: () => { throw Error("timer must not be scheduled"); },
  };
  assert.equal(startCompiledStartupProbe({...opts, platform:"linux",
    environment:{BOSTAN_PRIVATE_QA_ENTRY:"B087_TEST_ONLY"}}), false);
  assert.equal(startCompiledStartupProbe({...opts, platform:"win32",environment:{}}), false);
  assert.equal(startCompiledStartupProbe({...opts, platform:"win32",
    environment:{BOSTAN_PRIVATE_QA_ENTRY:"wrong"}}), false);
  assert.equal(called,0);
});

test("authorized Windows startup probe emits exact bounded constant strings", () => {
  const received=[];
  let intervalMs;
  let unrefCalled=0;
  let scheduled;
  assert.equal(startCompiledStartupProbe({
    platform:"win32",
    environment:{BOSTAN_PRIVATE_QA_ENTRY:"B087_TEST_ONLY",DATABASE_URL:"NOT_LOGGED",
      OPENAI_API_KEY:"NOT_LOGGED",HOME:"NOT_LOGGED"},
    emit: x => received.push(x),
    schedule: (callback,ms) => {
      scheduled=callback;intervalMs=ms;
      return {unref:() => unrefCalled++};
    },
    spawnWorker:()=>({on(){},unref:()=>unrefCalled++}),
  }),true);
  assert.equal(intervalMs,30000);
  assert.equal(unrefCalled,2);
  assert.deepEqual(received,[COMPILED_IMPORT_START]);
  scheduled();
  assert.deepEqual(received,[COMPILED_IMPORT_START,COMPILED_IMPORT_PENDING]);
  assert.deepEqual(received,[
    "BOSTAN_WIN_SERVER_STAGE=static_import_start",
    "BOSTAN_WIN_SERVER_STAGE=static_import_pending",
  ]);
  assert.ok(received.every(message => !message.includes("NOT_LOGGED")));
});

test("real import on a non-Windows host does not log stages or start timers", () => {
  if(process.platform === "win32") return;
  const child=spawnSync(process.execPath,[
    "--import",pathToFileURL(join(import.meta.dirname,
      "bostan-private-windows-compiled-startup-probe.mjs")).href,
    "--input-type=module","--eval","console.log('FIXTURE_EXECUTED')",
  ],{encoding:"utf8",timeout:3000});
  assert.equal(child.status,0,child.stderr);
  assert.equal(child.stdout.trim(),"FIXTURE_EXECUTED");
  assert.doesNotMatch(child.stderr,/BOSTAN_WIN_SERVER_STAGE=/);
});

test("genuine guarded Windows child emits stage only after synthetic QA admission", async t => {
  if (process.platform !== "win32") {
    t.skip("native Windows-only entry guard proof");
    return;
  }
  const home=await mkdtemp(join(tmpdir(),"bostan-b139-probe-"));
  t.after(() => rm(home,{recursive:true,force:true}));
  const marker=join(home,"BOSTAN_QA_OWNED");
  await writeFile(marker,"BOSTAN_PRIVATE_SYNTHETIC_ONLY\n",{mode:0o600});
  const entry=pathToFileURL(join(import.meta.dirname,
    "bostan-private-windows-compiled-entry-guard.mjs")).href;
  const probe=pathToFileURL(join(import.meta.dirname,
    "bostan-private-windows-compiled-startup-probe.mjs")).href;
  const env={
    SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,
    BOSTAN_PRIVATE_QA_ENTRY:"B087_TEST_ONLY",
    BOSTAN_PRIVATE_QA_MARKER:marker,
    PAPERCLIP_DEPLOYMENT_MODE:"authenticated",
    PAPERCLIP_DEPLOYMENT_EXPOSURE:"private",
    DATABASE_URL:"postgres://synthetic@127.0.0.1:65432/synthetic_test_only",
  };
  const run=()=>spawnSync(process.execPath,[
    "--import",entry,"--import",probe,
    "--input-type=module","--eval","console.log('BOSTAN_FIXTURE_NO_SERVER')",
  ],{cwd:join(import.meta.dirname,".."),env,encoding:"utf8",timeout:7000});
  const good=run();
  assert.equal(good.status,0,good.stderr?.slice(0,500));
  assert.match(good.stdout,/BOSTAN_FIXTURE_NO_SERVER/);
  assert.match(good.stderr,/BOSTAN_WIN_SERVER_STAGE=static_import_start/);
  // Synchronously block only the main JS event loop. The independent worker
  // must still be able to write its fixed OS-fd2 heartbeat. This regression
  // would stay RED with the old same-event-loop setInterval-only design.
  const blocked=spawnSync(process.execPath,[
    "--import",entry,"--import",probe,
    "--input-type=module","--eval",
    "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1600);"+
      "console.log('BOSTAN_SYNTHETIC_MAIN_BLOCK_RELEASED')",
  ],{cwd:join(import.meta.dirname,".."),env,encoding:"utf8",timeout:7000});
  assert.equal(blocked.status,0);
  assert.match(blocked.stdout,/BOSTAN_SYNTHETIC_MAIN_BLOCK_RELEASED/);
  assert.match(blocked.stderr,/BOSTAN_WIN_SERVER_STAGE=static_import_start/);
  assert.match(blocked.stderr,/BOSTAN_WIN_SERVER_STAGE=static_import_worker_alive/);
  assert.doesNotMatch(blocked.stderr,/PRIVATE_PATH|DATABASE_URL|OPENAI_API_KEY/);
  await writeFile(marker,"INVALID_FIXTURE\n");
  const denied=run();
  assert.equal(denied.status,2,denied.stderr?.slice(0,500));
  assert.doesNotMatch(denied.stdout,/BOSTAN_FIXTURE_NO_SERVER/);
  assert.doesNotMatch(denied.stderr,/BOSTAN_WIN_SERVER_STAGE=/);
});


test('synthetic worker emits only fixed literal tokens and has no inherited sensitive environment',async()=>{
  const {startPrivateCompiledImportWorker,IMPORT_WORKER_ALIVE,
    IMPORT_WORKER_PENDING,IMPORT_WORKER_TOKEN}=await import(
      './bostan-private-windows-compiled-import-worker.mjs');
  const received=[];let scheduled=null;
  const env={OPENAI_API_KEY:'DONT_PRINT_THIS',DATABASE_URL:'PRIVATE_URL'};
  assert.equal(startPrivateCompiledImportWorker({
    main:true,data:IMPORT_WORKER_TOKEN,platform:'win32',
    write:m=>received.push(m),schedule:f=>{scheduled=f},
  }),false);
  assert.equal(startPrivateCompiledImportWorker({
    main:false,data:'untrusted',platform:'win32',
    write:m=>received.push(m),schedule:f=>{scheduled=f},
  }),false);
  assert.equal(startPrivateCompiledImportWorker({
    main:false,data:IMPORT_WORKER_TOKEN,platform:'linux',
    write:m=>received.push(m),schedule:f=>{scheduled=f},
  }),false);
  assert.equal(received.length,0);
  assert.equal(startPrivateCompiledImportWorker({
    main:false,data:IMPORT_WORKER_TOKEN,platform:'win32',
    write:m=>received.push(m),schedule:f=>{scheduled=f},
    readCpu:(()=>{let usage=0;return ()=>({user:usage+=6_000_000,system:0})})(),
    nowMicroseconds:(()=>{let clock=0;return ()=>clock+=30_000_000})(),
  }),true);
  assert.deepEqual(received,[IMPORT_WORKER_ALIVE]);
  scheduled();
  assert.deepEqual(received,[IMPORT_WORKER_ALIVE,IMPORT_WORKER_PENDING,
    'BOSTAN_WIN_IMPORT_CPU_ACTIVITY=moderate']);
  assert.ok(received.every(x=>!x.includes(env.OPENAI_API_KEY)&&
    !x.includes(env.DATABASE_URL)));
});

test('spawn errors are fixed and do not disclose internal paths or app secrets',()=>{
  const received=[];
  startCompiledStartupProbe({platform:'win32',
    environment:{BOSTAN_PRIVATE_QA_ENTRY:'B087_TEST_ONLY'},
    emit:x=>received.push(x),schedule:()=>({unref(){}}),
    spawnWorker:()=>{throw Error('PRIVATE_PATH C: secret user');}});
  assert.deepEqual(received,[
    'BOSTAN_WIN_SERVER_STAGE=static_import_start',
    'BOSTAN_WIN_SERVER_STAGE=static_import_worker_failed']);
});


test('bounded no-PostgreSQL CPU import probe recognizes only the fixed worker stages',async()=>{
  const {readFileSync}=await import('node:fs');
  const file=new URL('./bostan-private-windows-packed-import-probe.mjs',import.meta.url);
  const source=readFileSync(file,'utf8');
  assert.ok(source.includes('static_import_worker_alive|static_import_worker_pending|static_import_worker_failed'));
  assert.ok(source.includes('BOSTAN_WIN_IMPORT_ONLY_REAL_POSTGRES_USED=false'));
  assert.ok(source.includes('BOSTAN_WIN_IMPORT_ONLY_OWNED_FIXTURE_CLEANED='));
});


test('Worker CPU classification uses only finite bounded ratios, never raw paths',async()=>{
  const {classifyPrivateWorkerCpuWindow:classify}=await import(
    './bostan-private-windows-compiled-import-worker.mjs');
  assert.equal(classify(21_000_000,30_000_000),'high');
  assert.equal(classify(6_000_000,30_000_000),'moderate');
  assert.equal(classify(1_000_000,30_000_000),'low');
  for(const input of [-1,NaN,Infinity,null])
    if(input!==null) assert.equal(classify(input,30_000_000),'unavailable');
  assert.equal(classify(1_000_000,0),'unavailable');
});
