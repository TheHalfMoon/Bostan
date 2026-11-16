import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { auditBostanUiBrandSnapshot, auditBostanUiBrandCheckout, auditBostanStatusSvgSource } from "./bostan-private-ui-brand-gate.mjs";

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

test("refuses active linked and embedded content in canonical status SVG", () => {
  for (const fragment of [
    '<script>alert(1)</script>',
    '<foreignObject><div>remote</div></foreignObject>',
    '<image href="https://example.invalid/pixel.png"/>',
    '<use xlink:href="//example.invalid/icon.svg#mark"/>',
    '<style>@import "https://example.invalid/a.css";</style>',
    '<style>.x { fill: url(https://example.invalid/a.svg) }</style>',
    '<image href="https&#58;//example.invalid/a.png"/>',
  ]) {
    const source = fixture();
    source["ui/public/bostan-thinking.svg"] = source["ui/public/bostan-thinking.svg"].replace("</svg>", fragment + "</svg>");
    assert.ok(auditBostanUiBrandSnapshot(source).length > 0, fragment);
  }
});

test("refuses even local CSS URL references in the minimal status artwork", () => {
  assert.ok(auditBostanStatusSvgSource('<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:url(#local)}</style><path d="M0 0"/></svg>').length > 0);
});

test("rejects SVG elements that can fetch through animation, fonts or nested documents", () => {
  for (const fragment of [
    '<animate attributeName="href" to="https://example.invalid/pixel"/>',
    '<a href="https://example.invalid/"><path d="M0 0"/></a>',
    '<filter id="f"><feGaussianBlur stdDeviation="2"/></filter>',
    '<text>unreviewed text</text>',
    '<!DOCTYPE svg [<!ENTITY ext SYSTEM "https://example.invalid/a">]>',
    '<style>@font-face { src: url(https://example.invalid/font.woff) }</style>',
    '<style>.x{fill:u\\72l(https://example.invalid/pixel)}</style>',
  ]) {
    assert.ok(auditBostanStatusSvgSource('<svg>' + fragment + '</svg>').length > 0, fragment);
  }
});

test("accepts shipped status artwork elements and reduced-motion CSS", () => {
  assert.deepEqual(auditBostanStatusSvgSource(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><title>Bostan</title>' +
    '<style>@media (prefers-reduced-motion: reduce) { .b { animation: none } }</style>' +
    '<path d="M0 0" stroke="#fff"/></svg>'
  ), []);
});

test("refuses event handlers and linked attributes even on allowed SVG elements", () => {
  for (const fragment of [
    '<svg onload="fetch(\'https://example.invalid/pixel\')"><path d="M0 0"/></svg>',
    '<svg><path onclick="alert(1)" d="M0 0"/></svg>',
    '<svg><path href="#local" d="M0 0"/></svg>',
    '<svg xml:base="https://example.invalid/"><path d="M0 0"/></svg>',
    '<svg><path xlink:href="#local" d="M0 0"/></svg>',
    '<svg><path src="https://example.invalid/x" d="M0 0"/></svg>',
  ]) {
    assert.ok(auditBostanStatusSvgSource(fragment).some(issue =>
      issue.includes("executable, linked or base URI")), fragment);
  }
});
