import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  }),true);
  assert.equal(intervalMs,30000);
  assert.equal(unrefCalled,1);
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
