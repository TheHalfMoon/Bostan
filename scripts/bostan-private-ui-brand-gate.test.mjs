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
