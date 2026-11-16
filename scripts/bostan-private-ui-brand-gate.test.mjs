import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { auditBostanUiBrandSnapshot, auditBostanUiBrandCheckout } from "./bostan-private-ui-brand-gate.mjs";

function fixture() {
  const icon = '<svg aria-label="Bostan"><style>@media (prefers-reduced-motion: reduce) { .b { opacity: 1 } }</style><path d="M7 3"/></svg>';
  return {
    "ui/src/pages/BoardChat.tsx": '<img src="/bostan-thinking.svg" alt="" />',
    "ui/public/bostan-thinking.svg": icon,
    "ui/public/paperclip-thinking.svg": icon,
    "ui/README.md": "# @bostan/ui\nBostan is not release-qualified.",
    "ui/index.html": '<title>Bostan</title><meta name="apple-mobile-web-app-title" content="Bostan">',
    "ui/public/site.webmanifest": '{"name":"Bostan","short_name":"Bostan"}',
  };
}

test("accepts the canonical Bostan UI-only identity", () => {
  assert.deepEqual(auditBostanUiBrandSnapshot(fixture()), []);
});
test("rejects source references to the inherited donor thinking icon", () => {
  const source = fixture(); source["ui/src/pages/BoardChat.tsx"] = '<img src="/paperclip-thinking.svg"/>';
  assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("Board chat")));
});
test("refuses donor artwork at the old compatibility URL", () => {
  const source = fixture(); source["ui/public/paperclip-thinking.svg"] = "<svg><path /></svg>";
  assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("Legacy thinking")));
});
test("rejects a status mark without reduced-motion handling", () => {
  const source = fixture(); source["ui/public/bostan-thinking.svg"] = '<svg aria-label="Bostan"><path /></svg>';
  assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("reduced motion")));
});
test("refuses a donor-branded publishable UI README", () => {
  const source = fixture(); source["ui/README.md"] = "Published Paperclip UI package";
  assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("UI README")));
});
test("refuses mismatched index title and manifest brand", () => {
  const source = fixture();
  source["ui/index.html"] = "<title>Paperclip</title>";
  source["ui/public/site.webmanifest"] = '{"name":"Paperclip"}';
  const issues = auditBostanUiBrandSnapshot(source);
  assert.ok(issues.some(s => s.includes("HTML document")));
  assert.ok(issues.some(s => s.includes("manifest")));
});
test("refuses absent canonical status assets and malformed manifest", () => {
  const source = fixture();
  delete source["ui/public/bostan-thinking.svg"];
  source["ui/public/site.webmanifest"] = "{ bad json";
  const issues = auditBostanUiBrandSnapshot(source);
  assert.ok(issues.some(s => s.includes("Missing Bostan UI brand file")));
  assert.ok(issues.some(s => s.includes("not valid JSON")));
});
test("verifies the exact checked-out UI files in an authorized private checkout", () => {
  assert.deepEqual(auditBostanUiBrandCheckout(fileURLToPath(new URL("..", import.meta.url))), []);
});

test("refuses remote scripts, styles and font preloads in the offline-first HTML shell", () => {
  for (const tag of [
    '<script src="https://cdn.example.invalid/app.js"></script>',
    '<link rel="stylesheet" href="//fonts.example.invalid/main.css">',
    '<link rel="preload" href=http://cdn.example.invalid/font.woff2 as="font">',
    '<SCRIPT SRC = \' HTTPS://cdn.example.invalid/upper.js\'></SCRIPT>',
    '<link rel="icon" href="  https://cdn.example.invalid/icon.svg">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("remote script or link")), tag);
  }
});
test("allows local HTML shell assets and ignores commented-out remote examples", () => {
  const source = fixture();
  source["ui/index.html"] += '<script src="/src/main.tsx"></script><link rel="icon" href="/favicon.svg">';
  source["ui/index.html"] += '<!-- <script src="https://example.invalid/old.js"></script> -->';
  source["ui/index.html"] += '<!-- multiline\\n<link href="//example.invalid/old.css">\\n-->';
  assert.deepEqual(auditBostanUiBrandSnapshot(source), []);
});

test("refuses HTML-entity-obfuscated remote asset URLs", () => {
  for (const tag of [
    '<script src="https:&#47;&#47;cdn.example.invalid/app.js"></script>',
    '<link href="https&colon;&sol;&sol;cdn.example.invalid/font.css">',
    '<script src="&#x68;ttps://cdn.example.invalid/app.js"></script>',
    '<link href="&#32;//cdn.example.invalid/icon.svg">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("remote script or link")), tag);
  }
});


test("refuses base href overrides that redirect relative offline assets", () => {
  for (const tag of [
    '<base href="https://cdn.example.invalid/">',
    '<BASE HREF = "//cdn.example.invalid/">',
    '<base href="/another-path/">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag + '<script src="./main.js"></script>';
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("asset base URL")), tag);
  }
});

test("ignores commented base elements and permits ordinary relative assets", () => {
  const source = fixture();
  source["ui/index.html"] += '<!-- <base href="https://cdn.example.invalid/"> -->';
  source["ui/index.html"] += '<script src="./main.js"></script>';
  assert.deepEqual(auditBostanUiBrandSnapshot(source), []);
});

test("refuses nonlocal URL schemes and browser-normalized backslash asset URLs", () => {
  for (const tag of [
    '<script src="ftp://example.invalid/app.js"></script>',
    '<script src="https:\\example.invalid/app.js"></script>',
    '<script src="data:text/javascript,alert(1)"></script>',
    '<link rel="stylesheet" href="blob:https://example.invalid/id">',
    '<script src="https:\\\\example.invalid/app.js"></script>',
    '<link rel="stylesheet" href="\\\\example.invalid/style.css">',
    '<link rel="stylesheet" href="&#x68;ttps:&#92;&#92;example.invalid/style.css">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("remote script or link")), tag);
  }
});

test("refuses meta refresh navigation in the offline shell", () => {
  for (const tag of [
    '<meta http-equiv="refresh" content="0;url=https://example.invalid/">',
    "<META HTTP-EQUIV='REFRESH' content='1;url=//example.invalid/'>",
    '<meta http-equiv=refresh content="0;url=/local">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("meta refresh")), tag);
  }
});

test("ignores commented refresh markup and ordinary metadata", () => {
  const source = fixture();
  source["ui/index.html"] += '<!-- <meta http-equiv="refresh" content="0;url=https://example.invalid/"> -->';
  source["ui/index.html"] += '<meta name="description" content="Bostan offline shell">';
  assert.deepEqual(auditBostanUiBrandSnapshot(source), []);
});

test("refuses entity-encoded meta refresh values in offline HTML", () => {
  for (const tag of [
    '<meta http-equiv="ref&#114;esh" content="0;url=https://example.invalid/">',
    '<meta http-equiv="&#x72;efresh" content="0;url=/local">',
    "<META HTTP-EQUIV='refr&#101;sh' content='0;url=//example.invalid/'>",
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("meta refresh")), tag);
  }
});

test("refuses browser-normalized ASCII control characters in remote asset URLs", () => {
  for (const tag of [
    '<script src="ht\\ttps://cdn.example.invalid/a.js"></script>',
    '<link href="https:\\n//cdn.example.invalid/a.css">',
    '<script src="h&#x9;ttps://cdn.example.invalid/a.js"></script>',
    '<link href="https:&#10;//cdn.example.invalid/a.css">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("remote script or link")), tag);
  }
});

test("refuses actual tab, LF and CR characters stripped by browser URL parsing", () => {
  for (const [control, url] of [
    [9, "ht" + String.fromCharCode(9) + "tps://cdn.example.invalid/a.js"],
    [10, "https:" + String.fromCharCode(10) + "//cdn.example.invalid/a.js"],
    [13, "https:" + String.fromCharCode(13) + "//cdn.example.invalid/a.js"],
  ]) {
    assert.ok(url.includes(String.fromCharCode(control)), "fixture must contain the literal control character");
    const source = fixture();
    source["ui/index.html"] += '<script src="' + url + '"></script>';
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("remote script or link")), JSON.stringify(url));
  }
});


test("refuses responsive image preload URLs that bypass href checks", () => {
  for (const tag of [
    '<link rel="preload" as="image" imagesrcset="https://cdn.example.invalid/a.png 1x, /b.png 2x">',
    '<LINK REL="preload" AS="image" IMAGESRCSET="/a.png 1x, //cdn.example.invalid/b.png 2x">',
    '<link rel="preload" as="image" imagesrcset="/local.png 1x">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(s => s.includes("remote script or link")), tag);
  }
});


test("refuses external assets and navigation when quoted attributes contain angle brackets", () => {
  for (const [tag, expected] of [
    ['<script data-note=">" src="https://cdn.example.invalid/a.js"></script>', "remote script or link"],
    ['<link data-note=">" href="https://cdn.example.invalid/a.css">', "remote script or link"],
    ['<meta data-note=">" http-equiv="refresh" content="0;url=https://example.invalid/">', "meta refresh"],
    ['<base data-note=">" href="https://example.invalid/">', "asset base URL"],
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(issue => issue.includes(expected)), tag);
  }
});

test("does not confuse inert data-src and data-href with browser resource attributes", () => {
  const source = fixture();
  source["ui/index.html"] += '<script data-src="https://example.invalid/inert.js"></script>';
  source["ui/index.html"] += '<link data-href="https://example.invalid/inert.css">';
  assert.deepEqual(auditBostanUiBrandSnapshot(source), []);
});

test("still rejects remote src and href after inert data attributes", () => {
  for (const tag of [
    '<script data-src="/local.js" src="https://example.invalid/active.js"></script>',
    '<link data-href="/local.css" href="https://example.invalid/active.css">',
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(issue => issue.includes("remote script or link")), tag);
  }
});

test("does not confuse inert data-prefixed navigation and preload attributes", () => {
  const source = fixture();
  source["ui/index.html"] += '<base data-href="https://example.invalid/">';
  source["ui/index.html"] += '<meta data-http-equiv="refresh" content="0;url=https://example.invalid/">';
  source["ui/index.html"] += '<link data-imagesrcset="https://example.invalid/a.png 1x">';
  assert.deepEqual(auditBostanUiBrandSnapshot(source), []);
});

test("rejects active base, refresh and image preload attributes after inert data attributes", () => {
  for (const [tag, expected] of [
    ['<base data-href="/inert" href="https://example.invalid/">', "asset base URL"],
    ['<meta data-http-equiv="none" http-equiv=" refresh " content="0;url=https://example.invalid/">', "meta refresh"],
    ['<link data-imagesrcset="/inert.png 1x" imagesrcset="https://example.invalid/a.png 1x">', "remote script or link"],
  ]) {
    const source = fixture();
    source["ui/index.html"] += tag;
    assert.ok(auditBostanUiBrandSnapshot(source).some(issue => issue.includes(expected)), tag);
  }
});
