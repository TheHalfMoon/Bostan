import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { archiveDeclarationMaps, verifyDeclarationMapArchive } from "./declaration-map-archive.mjs";

const map = JSON.stringify({ version: 3, file: "index.d.ts", sources: ["../src/index.ts"], names: [], mappings: "AAAA" });
function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-map-archive-test-"));
  const stage = path.join(root, "stage"); fs.mkdirSync(stage);
  return { root, stage, remove() { fs.rmSync(root, { recursive: true }); } };
}
function put(stage, name, bytes) {
  const filename = path.join(stage, ...name.split("/")); fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, bytes); return filename;
}
function candidate(stage, name = "package/index.d.ts.map", bytes = map) {
  put(stage, name.slice(0, -4), "export declare const proof: string;\n"); return put(stage, name, bytes);
}
test("archives declaration maps byte-for-byte in portable tar while preserving runtime, types and notices", () => {
  const f = fixture();
  try {
    const longName = "node_modules/" + "long-segment/".repeat(12) + "with spaces/index.d.ts.map";
    candidate(f.stage); candidate(f.stage, longName);
    const unchanged = new Map([["package/index.js", "export const proof = 'runtime';"], ["package/index.js.map", map], ["package/LICENSE", "Retained copyright and license"]]);
    for (const [name, bytes] of unchanged) put(f.stage, name, bytes);
    assert.deepEqual(archiveDeclarationMaps(f.stage), { archived: 2, bytes: 2 * Buffer.byteLength(map) });
    const manifest = JSON.parse(fs.readFileSync(path.join(f.stage, "bostan-declaration-maps.json")));
    const archive = path.join(f.stage, manifest.archive);
    verifyDeclarationMapArchive(archive, manifest.entries);
    for (const item of manifest.entries) {
      assert.equal(fs.existsSync(path.join(f.stage, item.path)), false);
      assert.equal(fs.readFileSync(path.join(f.stage, item.path.slice(0, -4)), "utf8"), "export declare const proof: string;\n");
      const read = spawnSync("tar", ["-xOf", archive, item.path], { encoding: "utf8", windowsHide: true, timeout: 5000 });
      assert.equal(read.error, undefined); assert.equal(read.status, 0, read.stderr); assert.equal(read.stdout, map);
    }
    for (const [name, bytes] of unchanged) assert.equal(fs.readFileSync(path.join(f.stage, name), "utf8"), bytes);
  } finally { f.remove(); }
});
test("leaves invalid, ambiguous, linked and unrepresentable maps loose", () => {
  const f = fixture();
  try {
    const names = ["invalid.d.ts.map", "old.d.ts.map", "missing.d.ts.map", "indexed.d.ts.map",
      "segment/".repeat(40) + "long.d.ts.map", "unicode/café/index.d.ts.map"];
    candidate(f.stage, names[0], "invalid JSON"); candidate(f.stage, names[1], "{\"version\":2}");
    put(f.stage, names[2], map); candidate(f.stage, names[3], JSON.stringify({ version: 3, sections: [] }));
    candidate(f.stage, names[4]);
    candidate(f.stage, names[5]);
    const original = put(f.root, "outside.d.ts.map", map), linked = candidate(f.stage, "linked.d.ts.map");
    fs.unlinkSync(linked); fs.linkSync(original, linked);
    assert.deepEqual(archiveDeclarationMaps(f.stage), { archived: 0, bytes: 0 });
    for (const name of names) assert.ok(fs.existsSync(path.join(f.stage, name)));
    assert.equal(fs.readFileSync(original, "utf8"), map); assert.equal(fs.readFileSync(linked, "utf8"), map);
  } finally { f.remove(); }
});
test("detects archive content substitution, truncation, extra bytes and invalid inventory paths", () => {
  const f = fixture();
  try {
    candidate(f.stage); archiveDeclarationMaps(f.stage);
    const inventory = JSON.parse(fs.readFileSync(path.join(f.stage, "bostan-declaration-maps.json"))).entries;
    const archive = path.join(f.stage, "bostan-declaration-maps.tar"), original = fs.readFileSync(archive);
    const changed = Buffer.from(original); changed[512] ^= 1; fs.writeFileSync(archive, changed);
    assert.throws(() => verifyDeclarationMapArchive(archive, inventory));
    fs.writeFileSync(archive, original.subarray(0, -1)); assert.throws(() => verifyDeclarationMapArchive(archive, inventory));
    fs.writeFileSync(archive, Buffer.concat([original, Buffer.alloc(512)])); assert.throws(() => verifyDeclarationMapArchive(archive, inventory));
    fs.writeFileSync(archive, original);
    assert.throws(() => verifyDeclarationMapArchive(archive, [...inventory, ...inventory]), /Duplicate/);
    for (const name of ["../escape.d.ts.map", "/absolute.d.ts.map", "C:/foreign.d.ts.map", "aux.d.ts.map"]) {
      assert.throws(() => verifyDeclarationMapArchive(archive, [{ ...inventory[0], path: name }]));
    }
  } finally { f.remove(); }
});
test("refuses occupied archive output before modifying a loose map or linked external file", () => {
  const f = fixture();
  try {
    const loose = candidate(f.stage), outside = put(f.root, "external", "preserve");
    fs.linkSync(outside, path.join(f.stage, "bostan-declaration-maps.tar"));
    assert.throws(() => archiveDeclarationMaps(f.stage), /Occupied/);
    assert.equal(fs.readFileSync(loose, "utf8"), map); assert.equal(fs.readFileSync(outside, "utf8"), "preserve");
  } finally { f.remove(); }
});
