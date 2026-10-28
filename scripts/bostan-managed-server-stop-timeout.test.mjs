import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { superviseManagedServer } from './bostan-managed-server-child.mjs';

function fakeIpc() {
  const ipc = new EventEmitter();
  ipc.messages = [];
  ipc.exits = [];
  ipc.send = message => ipc.messages.push(message);
  ipc.exit = code => ipc.exits.push(code);
  return ipc;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a never-settling shutdown fails closed within the managed stop deadline', async () => {
  const ipc = fakeIpc();
  await superviseManagedServer(async () => ({shutdown: () => new Promise(() => {})}), ipc, {stopTimeoutMs: 40});
  ipc.emit('message', {type:'bostan:managed:stop'});
  await sleep(120);
  assert.deepEqual(ipc.exits, [1]);
  assert.deepEqual(ipc.messages, [{type:'bostan:managed:stop-failed'}]);
});

test('a never-settling startup cannot outlive a disconnected parent', async () => {
  const ipc = fakeIpc();
  void superviseManagedServer(() => new Promise(() => {}), ipc, {stopTimeoutMs: 40});
  ipc.connected = false;
  ipc.emit('disconnect');
  await sleep(120);
  assert.deepEqual(ipc.exits, [1]);
  assert.deepEqual(ipc.messages, []);
});

test('a late shutdown completion cannot overwrite a timed-out failure', async () => {
  const ipc = fakeIpc();
  let finish;
  await superviseManagedServer(async () => ({shutdown: () => new Promise(resolve => { finish = resolve; })}), ipc, {stopTimeoutMs: 40});
  ipc.emit('message', {type:'bostan:managed:stop'});
  await sleep(120);
  finish();
  await sleep(20);
  assert.deepEqual(ipc.exits, [1]);
  assert.deepEqual(ipc.messages, [{type:'bostan:managed:stop-failed'}]);
});

test('a real Node child with hung shutdown exits nonzero while IPC remains connected', {timeout: 8000}, async () => {
  const uri = new URL('./bostan-managed-server-child.mjs', import.meta.url).href;
  const source = `import { superviseManagedServer } from ${JSON.stringify(uri)};
await superviseManagedServer(async () => {
  process.send({type:'synthetic:ready'});
  return {shutdown: () => new Promise(() => {})};
}, process, {stopTimeoutMs: 120});`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-512); });
  const closed = once(child, 'close');
  const watchdog = setTimeout(() => child.kill(), 2500);
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        child.on('message', msg => { if(msg?.type==='synthetic:ready') resolve(); });
        child.once('error', reject);
      }),
      sleep(1800).then(() => {throw Error('owned child did not become ready');}),
    ]);
    child.send({type:'bostan:managed:stop'});
    const [code, signal] = await closed;
    assert.equal(code, 1, 'hung shutdown must exit nonzero: ' + stderr);
    assert.equal(signal, null);
  } finally {
    clearTimeout(watchdog);
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
});

test('clean shutdown cancels the deadline and emits only a successful acknowledgement', async () => {
  const ipc = fakeIpc();
  await superviseManagedServer(async () => ({shutdown: async () => {}}), ipc, {stopTimeoutMs: 40});
  ipc.emit('message', {type:'bostan:managed:stop'});
  await sleep(120);
  assert.deepEqual(ipc.exits, [0]);
  assert.deepEqual(ipc.messages, [{type:'bostan:managed:stopped'}]);
});

test('failed shutdown exits nonzero without waiting for the stop deadline', async () => {
  const ipc = fakeIpc();
  await superviseManagedServer(async () => ({shutdown: async () => {throw Error('synthetic private detail');}}), ipc, {stopTimeoutMs: 80});
  ipc.emit('disconnect');
  await sleep(130);
  assert.deepEqual(ipc.exits, [1]);
  assert.deepEqual(ipc.messages, [{type:'bostan:managed:stop-failed'}]);
});
