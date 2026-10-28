import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./bostan-private-mac-live-http.mjs", import.meta.url));
const source = readFileSync(script, "utf8");
function run(args = [], extras = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8", timeout: 6000,
    env: {
      ...process.env,
      BOSTAN_MAC_HTTP_QA: "",
      BOSTAN_MAC_HTTP_QA_CHILD: "",
      BOSTAN_MAC_HTTP_QA_MARKER: "",
      ...extras,
    },
  });
}
test("inert default and plan never qualify release, Windows, browser or agents", () => {
  for (const args of [[], ["--plan"]]) {
    const p = run(args);
    assert.equal(p.status, 0);
    const result = JSON.parse(p.stdout);
    assert.equal(result.run, false);
    assert.equal(result.releaseQualified, false);
    assert.equal(result.macAuthenticatedHttpQualified, false);
    assert.equal(result.windowsQualified, false);
    assert.equal(result.browserQualified, false);
    assert.equal(result.agentQualified, false);
    assert.equal(result.publishes, false);
    assert.equal(result.paidModels, false);
  }
});
test("unknown and publication actions fail before starting a child", () => {
  for (const option of ["--publish", "--deploy", "--release", "--cleanup", "--install"]) {
    const p = run([option]);
    assert.equal(p.status, 2);
    assert.match(p.stderr, /Usage:/);
    assert.doesNotMatch(p.stdout, /POSTGRES_MIGRATED/);
  }
});
test("real run refuses absent opt-in", () => {
  const p = run(["--run"]);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /refuses unsafe or unowned fixture/);
});
test("direct child invocation refuses missing owned fixture", () => {
  const p = run(["--child"], { BOSTAN_MAC_HTTP_QA_CHILD: "SYNTHETIC_ONLY" });
  assert.equal(p.status, 2);
  assert.match(p.stderr, /refuses unsafe synthetic invocation/);
});
test("strict QA guard, local DB and HTTP, minimal environment, cleanup", () => {
  assert.match(source, /process\.platform !== "darwin"/);
  assert.match(source, /10n \* 1024n \*\* 3n/);
  assert.match(source, /BOSTAN_MAC_HTTP_QA !== "SYNTHETIC_ONLY"/);
  assert.match(source, /BOSTAN_MAC_HTTP_QA_MARKER: marker/);
  assert.match(source, /PAPERCLIP_HOME: home/);
  assert.match(source, /HOME: home, TMPDIR: home/);
  assert.match(source, /PAPERCLIP_DEPLOYMENT_EXPOSURE: "private"/);
  assert.match(source, /"http:\/\/127\.0\.0\.1:"/);
  assert.match(source, /await started\.shutdown\("SIGTERM"\)/);
  assert.match(source, /await db\.cleanup\(\)/);
  assert.doesNotMatch(source, /\.\.\.process\.env|console\.error\(error\)/);
});
test("timeout and process errors must not be interpreted as success", () => {
  assert.match(source, /child\.status === 0 && !child\.error && !child\.signal/);
  assert.match(source, /boundedLog && flags\.every\(Boolean\)/);
  assert.match(source, /timeout: child\.error\?\.code === "ETIMEDOUT"/);
  assert.match(source, /if \(!passed\) process\.exitCode = 1/);
  assert.match(source, /stdio: \["ignore", fd, fd\]/);
  assert.match(source, /process\.exit\(process\.exitCode \|\| 0\)/);
});
