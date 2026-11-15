import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeInstallPayloadManifest } from "./install-payload-manifest.mjs";

test("serializes all verified file hashes and contained relative links", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-install-manifest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = path.join(root, "runtime.tsv");
  const rows = [
    { path: "package.json", kind: "file", sha256: "a".repeat(64) },
    { path: "node_modules/server", kind: "link", target: "../dist/server" },
  ];
  const receipt = writeInstallPayloadManifest(rows, manifest);
  assert.equal(receipt.entries, 2);
  assert.equal(fs.readFileSync(manifest, "utf8"), `BOSTAN_RUNTIME_PAYLOAD_V1\nF\t${"a".repeat(64)}\tpackage.json\nL\t../dist/server\tnode_modules/server\n`);
});

for (const [name, entries] of [
  ["empty manifest", []],
  ["unsafe absolute path", [{ path: "C:/rooted", kind: "file", sha256: "a".repeat(64) }]],
  ["unsafe parent path", [{ path: "../outside", kind: "file", sha256: "a".repeat(64) }]],
  ["bad digest", [{ path: "ok", kind: "file", sha256: "not-a-hash" }]],
  ["escaping link", [{ path: "links/out", kind: "link", target: "../../../outside" }]],
  ["duplicate windows path", [
    { path: "node/A", kind: "file", sha256: "a".repeat(64) },
    { path: "node/a", kind: "file", sha256: "b".repeat(64) },
  ]],
]) test(`rejects ${name}`, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-install-manifest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => writeInstallPayloadManifest(entries, path.join(root, "runtime.tsv")));
});
