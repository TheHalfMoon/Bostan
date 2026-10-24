import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const source = (relative) => fs.readFileSync(path.join(repo, relative), "utf8");
const publicEntrypoints = [
  "ui/src/components/AppErrorBoundary.tsx",
  "ui/src/components/CloudAccessGate.tsx",
  "ui/src/pages/BootstrapSetupUxLab.tsx",
  "ui/src/pages/CliAuth.tsx",
  "ui/src/pages/InviteUxLab.tsx",
  "ui/src/api/response.ts",
  "ui/src/pages/McpConnect.tsx",
  "ui/src/pages/apps/AssistantConnection.tsx",
  "ui/src/lib/announcement-preview.ts",
];

test("first-run, identity and assistant-consent entrypoints use Bostan human copy", () => {
  for (const file of publicEntrypoints) {
    const text = source(file);
    assert.match(text, /Bostan/, `${file} must use the Bostan product identity`);
    assert.doesNotMatch(text, /\bPaperclip\b|paperclip\.ing|paperclip\.local/,
      `${file} still sends users to the inherited product`);
  }
});

test("API and MCP compatibility identifiers are not silently migrated", () => {
  assert.match(source("ui/src/pages/McpConnect.tsx"), /scopes\.includes\("paperclip:agent"\)/);
  assert.match(source("ui/src/pages/McpConnect.tsx"), /scopes\.includes\("paperclip:configure"\)/);
  assert.match(source("ui/src/pages/apps/AssistantConnection.tsx"), /scopes\.includes\("paperclip:write"\)/);
  assert.match(source("ui/src/pages/McpConnect.tsx"), /@paperclipai\/shared/);
});

test("offline page is native Bostan copy without the inherited illustration or remote assets", async () => {
  const sourceCode = source("ui/public/sw.js");
  assert.match(sourceCode, /__PAPERCLIP_BUILD_ID__/);
  assert.match(sourceCode, /__PAPERCLIP_OFFLINE_STYLES__/);
  assert.match(sourceCode, /bostan-public-assets-/);
  assert.doesNotMatch(sourceCode, /paperclip-offline|paperclip-public-assets|<svg/i);
  const styles = source("ui/src/index.css");
  assert.match(styles, /\/\* offline-recovery:start \*\/[\s\S]*\.bostan-offline-mark/);
  assert.match(styles, /\/\* offline-recovery:end \*\//);
  assert.doesNotMatch(styles.split("/* offline-recovery:end */")[0], /paperclip-offline/);
  const listeners = new Map();
  const isolation = {
    self: {
      location: { origin: "http://127.0.0.1:41414" },
      addEventListener: (name, handler) => listeners.set(name, handler),
      clients: { claim() {} }, skipWaiting() {},
    },
    caches: { keys: async () => [], open: async () => ({ match: async () => undefined }) },
    Response, URL, fetch: async () => { throw new Error("synthetic network down"); },
  };
  const executable = sourceCode.replace('"__PAPERCLIP_BUILD_ID__"', '"fixture-build"')
    .replace('"__PAPERCLIP_OFFLINE_STYLES__"', '"body{color:white}"');
  vm.runInNewContext(executable, isolation, { filename: "bostan-sw.js", timeout: 2_000 });
  const handler = listeners.get("fetch");
  assert.equal(typeof handler, "function");
  let responsePromise;
  handler({
    request: { method: "GET", url: "http://127.0.0.1:41414/settings/instance",
      mode: "navigate", cache: "default" },
    respondWith(value) { responsePromise = value; },
    waitUntil() {},
  });
  assert.ok(responsePromise, "offline navigation must receive a response");
  const response = await responsePromise;
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.match(body, /<title>Bostan is offline<\/title>/);
  assert.match(body, /class="bostan-offline-mark"/);
  assert.match(body, /Reload page/);
  assert.doesNotMatch(body, /Paperclip|paperclip\.ing|<svg|<img|<script|<link|\bsrc=/i);
  assert.doesNotMatch(body, /__PAPERCLIP_/);
  // Never intercept API responses or turn sensitive JSON into an HTML fallback.
  let intercepted = false;
  handler({
    request: { method: "GET", url: "http://127.0.0.1:41414/api/companies",
      mode: "cors", cache: "default" },
    respondWith() { intercepted = true; }, waitUntil() {},
  });
  assert.equal(intercepted, false);
});

test("demo announcement does not direct real users to the source project's site", () => {
  const preview = source("ui/src/lib/announcement-preview.ts");
  assert.doesNotMatch(preview, /https?:\/\//, "demo announcement should have no external default link");
  assert.match(preview, /New in Bostan/);
});
