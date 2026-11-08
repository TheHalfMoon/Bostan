import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isPrivateNodeQaDestination, assertPrivateNodeQaDestination,
  activateDisposableNodeEgressGuard,
  assertPrivateNodeQaConnectionOptions,
} from "./bostan-disposable-node-egress-preload.mjs";

test("guard opt-in is off by default", () => {
  assert.equal(activateDisposableNodeEgressGuard({}), false);
  assert.equal(activateDisposableNodeEgressGuard({
    BOSTAN_TEST_ONLY_NODE_EGRESS_GUARD: "false",
  }), false);
});
test("loopback-only Node QA classifier refuses remote and ambiguous addresses", () => {
  for (const allowed of ["127.0.0.1", "localhost", "::1", "[::1]"]) {
    assert.equal(isPrivateNodeQaDestination(allowed), true, allowed);
  }
  for (const denied of [
    "localhost.evil.invalid", "127.0.0.1.evil.invalid", "0.0.0.0",
    "10.1.2.3", "8.8.8.8", "synthetic.invalid", "", "[2001:db8::3]", "127.0.0.1 ",
  ]) assert.equal(isPrivateNodeQaDestination(denied), false, denied);
  for (const args of [
    ["http://127.0.0.1:31881/api/health"],
    [new URL("https://localhost:8443/p")],
    [{hostname: "127.0.0.1", port: 5432}],
    [5432, "localhost"], [{path: "/tmp/bostan-private-postgres.sock"}],
  ]) assert.equal(assertPrivateNodeQaDestination(args, "test"), true);
  const receipts = [];
  for (const args of [
    ["https://synthetic.invalid/?token=PRIVATE"], ["http://u:p@127.0.0.1:80/"],
    [new URL("https://10.1.1.1")], [{hostname: "synthetic.invalid", port: 443}],
    [80, "synthetic.invalid"], [{path: "relative/socket"}],
  ]) assert.throws(() => assertPrivateNodeQaDestination(args, "http", label => receipts.push(label)),
    /non-loopback/);
  assert.equal(receipts.length, 6);
});
test("local URL cannot override final HTTP destination or attach custom DNS/socket transports", () => {
  const received = [];
  const fail = args => assertPrivateNodeQaConnectionOptions(args, "http", label => received.push(label));
  for (const [url, options] of [
    ["http://127.0.0.1:8888/", { hostname: "synthetic.invalid" }],
    ["http://127.0.0.1:8888/", { host: "synthetic.invalid" }],
    [new URL("https://localhost:443/"), { hostname: "10.0.0.5" }],
    ["http://127.0.0.1:8888/", { lookup: () => "10.0.0.5" }],
    ["http://127.0.0.1:8888/", { createConnection: () => {} }],
    ["http://127.0.0.1:8888/", { agent: { createConnection() {} } }],
  ]) {
    assert.throws(() => fail([url, options]), /override of its private network destination/);
  }
  for (const options of [
    { host: "127.0.0.1", lookup() { return "evil"; } },
    { host: "localhost", createConnection() {} },
  ]) assert.throws(() => fail([options]), /override of its private network destination/);
  assert.equal(received.length, 8);
  for (const allowed of [
    ["http://127.0.0.1:8888/", { hostname: "localhost" }],
    ["http://127.0.0.1:8888/", { hostname: "127.0.0.1", timeout: 5000 }],
    [{hostname: "localhost", port: 5432}],
  ]) assert.doesNotThrow(() => fail(allowed));
});

test("real Node preload refuses known external APIs and writes secret-free audit categories", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "bostan-egress-qa-"));
  try {
    const preload = fileURLToPath(new URL("./bostan-disposable-node-egress-preload.mjs", import.meta.url));
    const code = [
      'import http from "node:http"; import https from "node:https";',
      'import http2 from "node:http2"; import net from "node:net";',
      'import tls from "node:tls";',
      'const attempt = fn => { try { fn(); return false; } catch (e) { return e.message.includes("Bostan disposable Node QA blocked"); } };',
      'const results = [',
      'attempt(() => http.request("http://synthetic.invalid/secret")),',
      'attempt(() => https.get("https://synthetic.invalid/secret")),',
      'attempt(() => http2.connect("https://synthetic.invalid/secret")),',
      'attempt(() => net.connect({port:443,host:"synthetic.invalid"})),',
      'attempt(() => tls.connect({port:443,host:"synthetic.invalid"})),',
      'attempt(() => http.request("http://127.0.0.1:8888/", {hostname:"synthetic.invalid"})),',
      'attempt(() => https.get("https://127.0.0.1:8888/", {host:"synthetic.invalid"})),',
      'attempt(() => http.request("http://127.0.0.1:8888/", {agent:{createConnection() {}}})),',
      'attempt(() => net.connect({port:443,host:"localhost",lookup() {}})),',
      'attempt(() => http2.connect("http://127.0.0.1:8888/", {createConnection() {}})),',
      '];',
      'const deniedFetch = await fetch("https://synthetic.invalid/secret").then(() => false, e => e.message.includes("Bostan disposable Node QA blocked"));',
      'results.push(deniedFetch);',
      'const deniedDispatcher = await fetch("http://127.0.0.1:8888/", {dispatcher:{dispatch() {}}}).then(() => false, e => e.message.includes("blocked an override"));',
      'results.push(deniedDispatcher);',
      // Both endpoints are loopback, so this is a safe, real redirect-chain
      // probe on Windows and Mac. Automatic follow would hit the sink.
      'let sinkHits=0;',
      'const sink = http.createServer((req,res)=>{sinkHits++;res.end("forbidden redirect sink");});',
      'await new Promise(ok=>sink.listen(0,"127.0.0.1",ok));',
      'const source = http.createServer((req,res)=>{if(req.url==="/safe"){res.end("safe-local-response");return;}res.writeHead(302,{Location:"http://127.0.0.1:"+sink.address().port+"/redirected"});res.end();});',
      'await new Promise(ok=>source.listen(0,"127.0.0.1",ok));',
      'const blockedRedirect = await fetch("http://127.0.0.1:"+source.address().port+"/start").then(()=>false,e=>e.message.includes("blocked a redirect"));',
      'results.push(blockedRedirect);',
      'const allowedLocal = await fetch("http://127.0.0.1:"+source.address().port+"/safe").then(async r=>r.status===200 && await r.text()==="safe-local-response",()=>false);',
      'results.push(allowedLocal);',
      'source.close(); sink.close();',
      'if (sinkHits !== 0) throw Error("Redirect reached forbidden sink");',
      'if (results.some(v => v !== true)) throw Error("Unblocked remote primitive");',
      'const r = http.request("http://127.0.0.1:12345/api/health"); r.on("error", () => {}); r.destroy();',
      'process.stdout.write("QA_NODE_EGRESS_DENIED\\n");',
    ].join("\n");
    const run = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, "--input-type=module", "-e", code], {
      env: { ...process.env, HOME: home, BOSTAN_TEST_ONLY_NODE_EGRESS_GUARD: "1" },
      encoding: "utf8", timeout: 12_000,
    });
    assert.equal(run.status, 0, "Disposable guard failed: " + run.stderr?.slice(-750));
    assert.match(run.stdout, /QA_NODE_EGRESS_DENIED/);
    const audit = path.join(home, "bostan-node-egress-attempts.log");
    assert.equal(existsSync(audit), true);
    const events = readFileSync(audit, "utf8").trim().split("\n");
    assert.equal(events.length >= 12, true);
    assert.ok(events.includes("fetch"));
    assert.ok(events.includes("fetch-redirect"));
    assert.ok(events.includes("tcp"));
    assert.ok(events.includes("armed"));
    assert.equal(events.some(event => event.includes("synthetic.invalid") || event.includes("/secret")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
