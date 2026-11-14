import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "node:test";
import { writeCandidateChecksums, verifyCandidateArtifact, verifyCandidateInstall } from "./artifact-checksums.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-artifact-hash-"));
  const out = path.join(root, "out"); fs.mkdirSync(out);
  for (const name of ["Bostan.exe", "bostan-sbom.cdx.json", "bostan-license-inventory.json"]) fs.writeFileSync(path.join(out, name), "abc");
  return { root, out };
}

test("candidate checksums cover installers, SBOM and licenses, excluding undistributed blockmaps", async () => {
  const { root, out } = fixture();
  try {
    const blockmap = path.join(out, "Bostan.exe.blockmap"); fs.writeFileSync(blockmap, "unused");
    const alias = path.join(root, "alias");
    fs.symlinkSync(out, alias, process.platform === "win32" ? "junction" : "dir");
    await writeCandidateChecksums(out, [path.join(alias, "Bostan.exe"), blockmap]);
    const lines = fs.readFileSync(path.join(out, "SHA256SUMS"), "utf8").trim().split("\n");
    assert.equal(lines.length, 3);
    for (const name of ["Bostan.exe", "bostan-sbom.cdx.json", "bostan-license-inventory.json"]) {
      assert.ok(lines.includes("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  " + name));
      await verifyCandidateArtifact(out, name);
    }
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});

test("installed QA rejects substituted bytes and ambiguous checksum entries", async () => {
  const { root, out } = fixture();
  try {
    await writeCandidateChecksums(out, [path.join(out, "Bostan.exe")]);
    fs.writeFileSync(path.join(out, "Bostan.exe"), "substituted");
    await assert.rejects(verifyCandidateArtifact(out, "Bostan.exe"), /checksum mismatch/);
    const manifest = path.join(out, "SHA256SUMS");
    const content = fs.readFileSync(manifest, "utf8");
    fs.appendFileSync(manifest, content.split("\n")[0] + "\n");
    await assert.rejects(verifyCandidateArtifact(out, "Bostan.exe"), /missing or ambiguous/);
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});

test("manifest verification handles short descriptor reads without missing later duplicate entries", async (t) => {
  const { root, out } = fixture();
  try {
    await writeCandidateChecksums(out, [path.join(out, "Bostan.exe")]);
    const read = fs.readSync;
    t.mock.method(fs, "readSync", (fd, bytes, offset, length, position) => read(fd, bytes, offset, Math.min(length, 13), position));
    await verifyCandidateArtifact(out, "Bostan.exe");
    const manifest = path.join(out, "SHA256SUMS");
    fs.appendFileSync(manifest, fs.readFileSync(manifest, "utf8").split("\n")[0] + "\n");
    await assert.rejects(verifyCandidateArtifact(out, "Bostan.exe"), /missing or ambiguous/);
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});

test("native installation requires unchanged SBOM and license metadata as well as installer bytes", async () => {
  const { root, out } = fixture();
  try {
    await writeCandidateChecksums(out, [path.join(out, "Bostan.exe")]);
    await verifyCandidateInstall(out, "Bostan.exe");
    fs.writeFileSync(path.join(out, "bostan-sbom.cdx.json"), "changed");
    await assert.rejects(verifyCandidateInstall(out, "Bostan.exe"), /checksum mismatch/);
    fs.writeFileSync(path.join(out, "bostan-sbom.cdx.json"), "abc");
    fs.unlinkSync(path.join(out, "bostan-license-inventory.json"));
    await assert.rejects(verifyCandidateInstall(out, "Bostan.exe"), /ENOENT/);
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});

test("candidate hashing refuses escaping or multiply linked files without writing a manifest", async () => {
  const { root, out } = fixture();
  try {
    const outside = path.join(root, "outside.exe"); fs.writeFileSync(outside, "retained");
    await assert.rejects(writeCandidateChecksums(out, [outside]), /artifact path/);
    fs.linkSync(outside, path.join(out, "linked.exe"));
    await assert.rejects(writeCandidateChecksums(out, [path.join(out, "linked.exe")]), /Unsafe candidate artifact/);
    assert.equal(fs.existsSync(path.join(out, "SHA256SUMS")), false);
    assert.equal(fs.readFileSync(outside, "utf8"), "retained");
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});

test("publishing a checksum manifest replaces its path without modifying a linked external file", async () => {
  const { root, out } = fixture();
  try {
    const outside = path.join(root, "retained-checksum"); fs.writeFileSync(outside, "retained");
    fs.linkSync(outside, path.join(out, "SHA256SUMS"));
    await writeCandidateChecksums(out, [path.join(out, "Bostan.exe")]);
    assert.equal(fs.readFileSync(outside, "utf8"), "retained");
    assert.equal(fs.lstatSync(path.join(out, "SHA256SUMS")).nlink, 1);
    assert.equal(fs.readdirSync(out).some(name => name.startsWith(".SHA256SUMS-")), false);
  } finally { fs.rmSync(root, { recursive: true, force: false }); }
});
