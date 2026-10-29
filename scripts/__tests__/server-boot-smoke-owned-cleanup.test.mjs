import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This runner executes a Bash script; native Windows qualifies it through WSL.
const shellTest = process.platform === 'win32' ? test.skip : test;
const script = process.env.BOSTAN_SMOKE_TEST_SCRIPT ||
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'server-boot-smoke.sh');
const fake = `
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
const [mode, pidFile] = process.argv.slice(2);
if (mode === 'exit') process.exit(23);
writeFileSync(pidFile, String(process.pid));
const server = createServer((_req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(mode === 'hang' ? '{"status":"waiting"}' : '{"status":"ok"}');
});
server.listen(Number(process.env.PORT), '127.0.0.1', () =>
  console.log('listener bound on 127.0.0.1:' + process.env.PORT));
if (mode === 'hang') process.on('SIGTERM', () => {});
else process.on('SIGTERM', () => process.exit(0));
`;
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bostan-boot-owned-test-'));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fakeFile = join(root, 'mock-server.mjs');
  const envFile = join(root, 'bash-env');
  const kills = join(root, 'kill-log.txt');
  await writeFile(fakeFile, fake);
  await writeFile(join(root, 'DO_NOT_DELETE.txt'), 'KEEP');
  // Observe whether cleanup sends a KILL *after* its own server was already
  // reaped; this function passes each signal through to the Bash builtin.
  await writeFile(envFile,
    `kill() { if [[ "$1" == '-KILL' ]]; then printf 'KILL\\n' >> "$BOSTAN_KILL_LOG"; fi; builtin kill "$@"; }\n`);
  return { root, fakeFile, envFile, kills };
}
async function run(t, mode) {
  const f = await fixture(t);
  const marker = join(f.root, `${mode}-pid.txt`);
  const result = spawnSync('bash', [script, process.execPath, f.fakeFile, mode, marker], {
    encoding: 'utf8', timeout: 26000,
    env: { ...process.env, SMOKE_TIMEOUT_SECONDS: mode === 'hang' ? '2' : '5',
      BASH_ENV: f.envFile, BOSTAN_KILL_LOG: f.kills, TMPDIR: f.root },
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(await readFile(join(f.root, 'DO_NOT_DELETE.txt'), 'utf8'), 'KEEP');
  assert.ok(!(await readdir(f.root)).some(name=>/^(bostan|paperclip)-boot-smoke\./.test(name)));
  const kills = await readFile(f.kills, 'utf8').catch(err => err.code === 'ENOENT' ? '' : Promise.reject(err));
  return { result, kills };
}
shellTest('ready server succeeds without sending unnecessary SIGKILL', async t=>{
  const {result, kills} = await run(t, 'ok');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /boot smoke ok:/);
  assert.equal(kills, '', 'must not signal a PID already reaped after graceful TERM');
});
shellTest('early-exit server fails cleanly, never signals an unrelated PID', async t=>{
  const {result, kills} = await run(t, 'exit');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /server exited before becoming ready/);
  assert.equal(kills, '');
});
shellTest('unresponsive owned server is forcibly stopped after bounded grace period', async t=>{
  const {result, kills} = await run(t, 'hang');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /did not report ok within/);
  assert.equal(kills, 'KILL\n', 'only a still-active owned child may receive SIGKILL');
});
