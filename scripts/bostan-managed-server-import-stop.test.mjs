import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

function bounded(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function spawnOwnedSyntheticBackend() {
  const root = mkdtempSync(path.join(tmpdir(), "bostan-owned-import-stop-"));
  const childScript = path.join(root, "scripts", "bostan-managed-server-child.mjs");
  mkdirSync(path.dirname(childScript), {recursive:true});
  mkdirSync(path.join(root, "server", "src"), {recursive:true});
  copyFileSync(fileURLToPath(new URL("./bostan-managed-server-child.mjs", import.meta.url)), childScript);
  writeFileSync(path.join(root, "server", "src", "index.ts"), [
    'process.send?.({type:"synthetic:import-started"});',
    'await new Promise(resolve => setTimeout(resolve, 500));',
    'export async function startServer(){',
    '  process.send?.({type:"synthetic:server-started"});',
    '  return {shutdown:async()=>{}};',
    '}',
    '',
  ].join("\n"));
  const child = spawn(process.execPath, ["--experimental-strip-types", childScript], {
    stdio:["ignore","pipe","pipe","ipc"], windowsHide:true,
  });
  const messages=[];
  let stderr="";
  child.on("message", m=>messages.push(m));
  child.stderr.on("data", b=>{stderr=(stderr+b.toString()).slice(-2000)});
  const cleanup=()=>{
    if(child.exitCode===null && child.signalCode===null)child.kill();
    rmSync(root,{recursive:true,force:true});
  };
  const waitForMessage=async(type)=>{
    if(messages.some(m=>m?.type===type))return;
    await bounded(new Promise(resolve=>child.on("message",m=>m?.type===type&&resolve())),2500,"synthetic IPC message absent: "+type);
  };
  return {child,messages,cleanup,waitForMessage,getStderr:()=>stderr};
}

test("IPC stop during pending module import prevents service startup", {timeout:8000}, async()=>{
  const f=spawnOwnedSyntheticBackend();
  try {
    await f.waitForMessage("synthetic:import-started");
    f.child.send({type:"bostan:managed:stop"});
    const [code,signal]=await bounded(once(f.child,"close"),3500,"owned child did not stop after parent request");
    assert.equal(code,1,"canceled import must fail closed, not report clean shutdown");
    assert.equal(signal,null);
    assert.ok(!f.messages.some(m=>m?.type==="synthetic:server-started"),"service must not start after parent stop");
    assert.match(f.getStderr(),/private details suppressed/);
  } finally { f.cleanup(); }
});

test("normal import then parent stop still completes graceful shutdown", {timeout:8000}, async()=>{
  const f=spawnOwnedSyntheticBackend();
  try {
    await f.waitForMessage("synthetic:server-started");
    f.child.send({type:"bostan:managed:stop"});
    const [code,signal]=await bounded(once(f.child,"close"),3500,"normal managed shutdown did not finish");
    assert.equal(code,0,f.getStderr());
    assert.equal(signal,null);
    assert.ok(f.messages.some(m=>m?.type==="bostan:managed:stopped"));
  } finally { f.cleanup(); }
});
