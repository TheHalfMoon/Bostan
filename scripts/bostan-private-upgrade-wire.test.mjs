import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { isPrivateUpgradeRequestAllowed } from '../server/src/middleware/private-hostname-guard.ts';

// No third-party dependencies. These are real HTTP/1.1 Upgrade requests sent
// through Node's parser to the exact checked-in Bostan TypeScript admission
// function. The 101 responder is a stub, NOT an authenticated Bostan WS server.
const privateOpts = { enabled: true, bindHost: '0.0.0.0', allowedHostnames: [] };

async function rawUpgrade(headers, { target = '/api/events/ws', opts = privateOpts, method = 'GET', httpVersion = '1.1', connectionHeader = 'Connection: Upgrade' } = {}) {
  let admitted = 0;
  let rejected = 0;
  const server = createServer((_req, res) => { res.statusCode = 400; res.end(); });
  server.on('upgrade', (req, socket) => {
    if (!isPrivateUpgradeRequestAllowed(req, opts)) {
      rejected += 1;
      socket.destroy();
      return;
    }
    admitted += 1;
    socket.end('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
      const socket = connect(port, '127.0.0.1');
      let received = '';
      socket.setTimeout(3000, () => socket.destroy(new Error('upgrade wire test timed out')));
      socket.on('connect', () => {
        socket.write(
          method + ' ' + target + ' HTTP/' + httpVersion + '\r\n' + headers.join('\r\n') +
          '\r\n' + connectionHeader + '\r\nUpgrade: websocket\r\n' +
          'Sec-WebSocket-Version: 13\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n',
          'latin1',
        );
      });
      socket.on('data', (chunk) => { received += chunk.toString('latin1'); });
      socket.once('end', () => resolve(received));
      socket.once('error', reject);
      socket.once('close', (hadError) => { if (!hadError) resolve(received); });
    });
    return {
      admitted,
      rejected,
      status: /^HTTP\/1\.1 (\d{3})/.exec(response)?.[1] ?? null,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const cases = [
  ['valid private Host without Origin', ['Host: localhost:3100'], true],
  ['valid matching browser Origin', ['Host: localhost:3100', 'Origin: http://localhost:3100'], true],
  ['valid loopback alias browser Origin', ['Host: localhost:3100', 'Origin: http://127.0.0.1:3100'], true],
  ['foreign Host with forged localhost Origin', ['Host: blocked.invalid:3100', 'Origin: http://localhost:3100'], false],
  ['localhost Host with foreign Origin', ['Host: localhost:3100', 'Origin: https://evil.invalid'], false],
  ['opaque Origin', ['Host: localhost:3100', 'Origin: null'], false],
  ['legacy numeric IPv4 Origin', ['Host: localhost:3100', 'Origin: http://127.1:3100'], false],
  ['duplicate Origin', ['Host: localhost:3100', 'Origin: http://localhost:3100', 'oRiGiN: http://localhost:3100'], false],
  ['duplicate Host', ['Host: localhost:3100', 'HOST: blocked.invalid:3100'], false],
  ['Host userinfo', ['Host: attacker@localhost:3100'], false],
  ['forged forwarded Host', ['Host: blocked.invalid:3100', 'X-Forwarded-Host: localhost:3100'], false],
  ['Origin with path', ['Host: localhost:3100', 'Origin: http://localhost:3100/'], false],
  ['Latin-1 obs-text Host', ['Host: \u00a0localhost:3100'], false],
];

for (const [label, headers, allow] of cases) {
  test('native upgrade wire: ' + label, async () => {
    const actual = await rawUpgrade(headers);
    assert.equal(actual.admitted, allow ? 1 : 0, JSON.stringify(actual));
    if (allow) assert.equal(actual.status, '101');
    else assert.notEqual(actual.status, '101');
  });
}

test('native upgrade wire: wildcard IPv6 bind does not admit unspecified address', async () => {
  const actual = await rawUpgrade(['Host: [::]:3100'], {
    opts: { ...privateOpts, bindHost: '::' },
  });
  assert.equal(actual.admitted, 0);
  assert.notEqual(actual.status, '101');
});

test('native upgrade wire: explicit allowed Host and matching Origin', async () => {
  const actual = await rawUpgrade(
    ['Host: approved.internal:3100', 'Origin: https://approved.internal:3100'],
    { opts: { ...privateOpts, allowedHostnames: ['approved.internal'] } },
  );
  assert.equal(actual.admitted, 1);
  assert.equal(actual.status, '101');
});

// Node's HTTP parser can dispatch all of these to 'upgrade' (verified on
// Linux Node 22). The Bostan private gate must not treat a valid Host as
// permission to pass a non-GET, body-framed or ambiguous Upgrade request.
for (const [label, method, extraHeaders] of [
  ['POST request', 'POST', []],
  ['Content-Length framing', 'GET', ['Content-Length: 0']],
  ['Transfer-Encoding framing', 'GET', ['Transfer-Encoding: chunked']],
  ['duplicate Upgrade fields', 'GET', ['Upgrade: h2c']],
]) {
  test('native upgrade wire: rejects ' + label, async () => {
    const actual = await rawUpgrade(['Host: localhost:3100', ...extraHeaders], { method });
    assert.equal(actual.admitted, 0, JSON.stringify(actual));
    // Newer Node parsers may refuse the wire framing before upgrade dispatch;
    // both a native HTTP 400 and a Bostan guard rejection are fail-closed.
    assert.ok(actual.rejected === 1 || actual.status === '400', JSON.stringify(actual));
  });
}


// Node can dispatch duplicate Connection fields and contradictory comma tokens
// to the upgrade event. The private gate must reject ambiguity and still admit
// one valid comma-separated keep-alive + Upgrade field.
for (const [label, extraHeaders, connectionHeader, allowed] of [
  ['single multi-token Connection', [], 'Connection: keep-alive, Upgrade', true],
  ['duplicate Connection fields', ['Connection: keep-alive'], 'Connection: Upgrade', false],
  ['contradictory Connection fields', ['Connection: close'], 'Connection: Upgrade', false],
  ['repeated Upgrade token in Connection', [], 'Connection: Upgrade, Upgrade', false],
  ['conflicting close token in Connection', [], 'Connection: Upgrade, close', false],
  ['empty Connection token', [], 'Connection: Upgrade,', false],
  ['duplicate keep-alive Connection token', [], 'Connection: Upgrade, keep-alive, keep-alive', false],
  ['Latin-1 NBSP before keep-alive token', [], 'Connection: Upgrade,\u00a0keep-alive', false],
  ['ASCII tab OWS before keep-alive token', [], 'Connection: Upgrade,\tkeep-alive', true],
  ['unknown Connection token', [], 'Connection: Upgrade, h2c', false],
]) {
  test('native upgrade wire: ' + label, async () => {
    const actual = await rawUpgrade(['Host: localhost:3100', ...extraHeaders], { connectionHeader });
    assert.equal(actual.admitted, allowed ? 1 : 0, JSON.stringify(actual));
    if (allowed) assert.equal(actual.status, '101');
    else assert.ok(actual.rejected === 1 || actual.status === '400', JSON.stringify(actual));
  });
}

test('native upgrade wire: public mode preserves duplicate Connection compatibility', async () => {
  const actual = await rawUpgrade(['Host: blocked.invalid:3100', 'Connection: keep-alive'], {
    opts: { ...privateOpts, enabled: false },
  });
  assert.equal(actual.admitted, 1);
  assert.equal(actual.status, '101');
});


// Native Node 22 actually emits 'upgrade' for request lines advertising
// HTTP/1.0 and HTTP/2.0, even with otherwise canonical WebSocket headers.
// The private boundary must fail closed before downstream WS listeners.
for (const httpVersion of ['1.0', '2.0']) {
  test('native upgrade wire: refuses HTTP/' + httpVersion + ' request version', async () => {
    const actual = await rawUpgrade(['Host: localhost:3100'], { httpVersion });
    assert.equal(actual.admitted, 0, JSON.stringify(actual));
    // A future Node parser may reject before reaching Bostan's listener.
    assert.ok(actual.rejected === 1 || actual.status === '400', JSON.stringify(actual));
  });
}

test('native upgrade wire: public mode preserves legacy version semantics', async () => {
  const actual = await rawUpgrade(['Host: localhost:3100'], {
    httpVersion: '1.0',
    opts: { ...privateOpts, enabled: false },
  });
  assert.equal(actual.admitted, 1);
  assert.equal(actual.status, '101');
});

test('native upgrade wire: public-mode framing policy remains unchanged', async () => {
  const actual = await rawUpgrade(['Host: blocked.invalid:3100'], {
    method: 'POST',
    opts: { ...privateOpts, enabled: false },
  });
  assert.equal(actual.admitted, 1);
  assert.equal(actual.status, '101');
});

test('native upgrade wire: public mode remains unchanged', async () => {
  const actual = await rawUpgrade(
    ['Host: blocked.invalid:3100', 'Origin: https://evil.invalid'],
    { opts: { ...privateOpts, enabled: false } },
  );
  assert.equal(actual.admitted, 1);
  assert.equal(actual.status, '101');
});
