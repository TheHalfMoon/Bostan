import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createZipArchive } from "../../../ui/src/lib/zip.ts";
import {
  inspectBostanCompanyExportArchive, inspectLocalBostanCompanyExport,
} from "../bostan-company-export-inspect.mjs";

const makeZip = (entries = { "README.md": "# Synthetic company", "agents/a/AGENT.md": "# Agent" }) =>
  Buffer.from(createZipArchive(entries, "bostan-synthetic"));
const temporary = () => mkdtempSync(join(tmpdir(), "bostan-export-qa-"));

test("accepts real ZIP produced by Bostan browser exporter and counts only metadata", () => {
  const zip = makeZip({
    "README.md": "# Private sensitive company synthetic-token",
    "agents/a/AGENT.md": "Synthetic credential value",
    "projects/x/PROJECT.md": "Project",
    "tasks/t/TASK.md": "Task",
    "skills/s/SKILL.md": "Skill",
    "images/diagram.png": { encoding: "base64", data: "AAEC", contentType: "image/png" },
  });
  const report = inspectBostanCompanyExportArchive(zip);
  assert.equal(report.archiveValid, true);
  assert.equal(report.files, 6);
  assert.equal(report.hasReadme, true);
  assert.equal(report.supportedForImport, false);
  assert.equal(report.categories.agents, 1);
  assert.equal(report.categories.projects, 1);
  assert.equal(report.categories.images, 1);
  assert.doesNotMatch(JSON.stringify(report), /synthetic-token|credential|PROJECT.md|bostan-synthetic/);
});

test("reads only local ZIP, never downloads or alters archive", () => {
  const root = temporary();
  try {
    const zip = makeZip();
    const archive = join(root, "export.zip");
    writeFileSync(archive, zip);
    assert.equal(inspectLocalBostanCompanyExport(archive).files, 2);
    assert.deepEqual(Buffer.from(zip), Buffer.from(makeZip()));
    assert.throws(() => inspectLocalBostanCompanyExport("https://example.org/private.zip"), /network URLs are unsupported/);
    assert.throws(() => inspectLocalBostanCompanyExport("file:///tmp/private.zip"), /network URLs are unsupported/);
    assert.throws(() => inspectLocalBostanCompanyExport(join(root, "missing.zip")), /unavailable or unsafe/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects symlinked export ZIPs where the host permits test symlink creation", (t) => {
  const root = temporary();
  try {
    const archive = join(root, "export.zip");
    const alias = join(root, "alias.zip");
    writeFileSync(archive, makeZip());
    try {
      symlinkSync(archive, alias);
    } catch (error) {
      // Native Windows without Developer Mode may deny symlink creation.
      // That prevents constructing this fixture; it is not evidence that
      // the actual ZIP inspector accepts symlinks.
      if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error?.code)) {
        t.skip("Native Windows symlink privilege unavailable; inspector behavior not qualified by this case");
        return;
      }
      throw error;
    }
    assert.throws(() => inspectLocalBostanCompanyExport(alias), /unavailable or unsafe/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("rejects truncation, payload corruption and unknown compression", () => {
  const original = makeZip();
  assert.throws(() => inspectBostanCompanyExportArchive(original.subarray(0, original.length-1)));
  const corrupt = Buffer.from(original);
  corrupt[35] ^= 1;
  assert.throws(() => inspectBostanCompanyExportArchive(corrupt), /Invalid or unsupported/);
  const compressed = Buffer.from(original);
  const central = compressed.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central > 0);
  compressed.writeUInt16LE(8, central+10);
  assert.throws(() => inspectBostanCompanyExportArchive(compressed), /Invalid or unsupported/);
});

test("rejects ZIP64, encrypted flags, invalid EOCD counts, and huge input", () => {
  const original = makeZip();
  const end = original.length - 22;
  for (const changed of [
    data => data.writeUInt16LE(0xffff, end+10),
    data => data.writeUInt16LE(0x0801, 6),
    data => data.writeUInt32LE(0xffffffff, end+16),
  ]) {
    const archive = Buffer.from(original);
    changed(archive);
    assert.throws(() => inspectBostanCompanyExportArchive(archive), /Invalid or unsupported/);
  }
  assert.throws(() => inspectBostanCompanyExportArchive(Buffer.alloc(64*1024*1024+1)));
});

test("rejects path traversal, backslashes, duplicate paths and inconsistent roots", () => {
  const original = makeZip({
    "README.md": "r", "agents/a/AGENT.md": "a", "agents/b/AGENT.md": "b",
  });
  const mutateName = (from, to) => {
    assert.equal(from.length,to.length);
    const bytes = Buffer.from(original);
    let count = 0, at = 0;
    while ((at = bytes.indexOf(from, at, "utf8")) >= 0) {
      bytes.write(to, at, "utf8");
      at += from.length; count++;
    }
    assert.equal(count, 2);
    return bytes;
  };
  assert.throws(() => inspectBostanCompanyExportArchive(mutateName("agents/b/AGENT.md","agents/a/AGENT.md")));
  assert.throws(() => inspectBostanCompanyExportArchive(mutateName("agents/b/AGENT.md","agents/../AGENT.md")));
  assert.throws(() => inspectBostanCompanyExportArchive(mutateName("agents/b/AGENT.md","agents\\b\\AGENT.md")));
  assert.throws(() => inspectBostanCompanyExportArchive(mutateName("bostan-synthetic/agents/b/AGENT.md","bastan-synthetic/agents/b/AGENT.md")));
});

test("actual isolated Bostan CLI inspects valid local ZIP but cannot import it", () => {
  const root=temporary();
  try {
    const archive=join(root,"company.zip");
    writeFileSync(archive,makeZip());
    const entry = new URL("../bostan-preview.mjs",import.meta.url);
    const run = (...args) => spawnSync(process.execPath,[fileURLToPath(entry),...args],{
      encoding:"utf8",env:{HOME:root,PATH:"/usr/bin:/bin"},timeout:3000,
    });
    const report=run("company","inspect",archive);
    assert.equal(report.status,0,report.stderr);
    const parsed=JSON.parse(report.stdout);
    assert.equal(parsed.files,2);
    assert.equal(parsed.supportedForImport,false);
    assert.doesNotMatch(report.stdout,/AGENT.md|Synthetic/);
    const forbidden=run("company","import",archive,"--dry-run");
    assert.equal(forbidden.status,2);
    assert.match(forbidden.stderr,/No operation was performed/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
