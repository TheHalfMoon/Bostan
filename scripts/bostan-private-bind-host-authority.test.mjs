import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import {
  isPrivateUpgradeHostAllowed,
  privateHostnameGuard,
  resolvePrivateHostnameAllowSet,
} from '../server/src/middleware/private-hostname-guard.ts';

const privateOpts = { enabled: true, bindHost: '::', allowedHostnames: [] };
const upgrade = (host, opts = privateOpts) => isPrivateUpgradeHostAllowed(
  { rawHeaders: ['Host', host], url: '/api/events/ws' }, opts,
);

function invokeHttp(host, opts = privateOpts) {
  let nextCalled = false;
  let status = null;
  const req = {
    rawHeaders: ['Host', host],
    originalUrl: '/api/health',
    url: '/api/health',
    path: '/api/health',
    accepts: () => 'json',
  };
  const res = {
    status(value) { status = value; return this; },
    json() { return this; },
    type() { return this; },
    send() { return this; },
  };
  privateHostnameGuard(opts)(req, res, () => { nextCalled = true; });
  return { nextCalled, status };
}

test('IPv6 wildcard bind address is never automatically authorized as Host', () => {
  assert.equal(resolvePrivateHostnameAllowSet(privateOpts).has('::'), false);
});

test('IPv4 wildcard bind address remains excluded', () => {
  assert.equal(resolvePrivateHostnameAllowSet({ bindHost: '0.0.0.0', allowedHostnames: [] }).has('0.0.0.0'), false);
});

test('IPv6 wildcard bind does not admit [::] WebSocket Host', () => {
  assert.equal(upgrade('[::]:3100'), false);
});

test('IPv6 wildcard bind does not admit [::] HTTP Host', () => {
  assert.deepEqual(invokeHttp('[::]:3100'), { nextCalled: false, status: 403 });
});

test('IPv6 loopback remains admitted for HTTP and WebSocket', () => {
  assert.deepEqual(invokeHttp('[::1]:3100'), { nextCalled: true, status: null });
  assert.equal(upgrade('[::1]:3100'), true);
});

test('IPv4 loopback and localhost remain admitted under IPv6 wildcard bind', () => {
  assert.equal(upgrade('127.0.0.1:3100'), true);
  assert.equal(upgrade('localhost:3100'), true);
});

test('non-wildcard configured bind hostname remains authorized', () => {
  const opts = { enabled: true, bindHost: 'approved.internal', allowedHostnames: [] };
  assert.equal(upgrade('approved.internal:3100', opts), true);
});

test('public exposure retains existing upgrade behavior', () => {
  assert.equal(upgrade('[::]:3100', { ...privateOpts, enabled: false }), true);
});

async function nativeHttpStatus(hostHeader) {
  const middleware = privateHostnameGuard(privateOpts);
  const server = createServer((req, res) => {
    // Minimal Express response adapter: middleware under test is the actual
    // imported Bostan TypeScript module, not a reimplemented parser.
    req.path = '/api/health';
    req.accepts = () => 'json';
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (value) => { res.end(JSON.stringify(value)); return res; };
    res.type = () => res;
    res.send = (value) => { res.end(value); return res; };
    middleware(req, res, () => { res.statusCode = 200; res.end('ok'); });
  });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    return await new Promise((resolve, reject) => {
      const client = request({
        hostname: '127.0.0.1', port: address.port,
        path: '/api/health', headers: { Host: hostHeader },
      }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      client.on('error', reject);
      client.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('native Node HTTP request with [::] Host is refused by exact middleware', async () => {
  assert.equal(await nativeHttpStatus('[::]:3100'), 403);
});

test('native Node HTTP request with [::1] Host still works', async () => {
  assert.equal(await nativeHttpStatus('[::1]:3100'), 200);
});
