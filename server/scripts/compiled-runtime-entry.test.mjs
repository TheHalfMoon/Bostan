import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compiledRuntimeEntrySource, nativeEsmFileUrl } from "./compiled-runtime-entry.mjs";

function withOwnedFixture(run) {
  const root = mkdtempSync(join(tmpdir(), "bostan-b118-compiled-entry-"));
  writeFileSync(join(root, "BOSTAN_QA_OWNED"), "BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("compiled runtime entry executes a native absolute module through file URL", () => withOwnedFixture(root => {
  const target = join(root, "source #1", "server.mjs");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'console.log("BOSTAN_B118_ENTRY_OK");\n');
  const entry = join(root, "index.mjs");
  const source = compiledRuntimeEntrySource(target);
  assert.match(source, /await import\("file:/);
  assert.ok(source.includes(nativeEsmFileUrl(target)));
  assert.ok(source.includes(JSON.stringify(target)));
  writeFileSync(entry, source);
  const output = execFileSync(process.execPath, [entry], { cwd: root, encoding: "utf8", timeout: 5000 });
  assert.equal(output.trim(), "BOSTAN_B118_ENTRY_OK");
}));

test("external absolute paths are file URLs with reserved characters encoded and importable", async () => {
  const root = mkdtempSync(join(tmpdir(), "bostan-b118-external-"));
  writeFileSync(join(root, "BOSTAN_QA_OWNED"), "BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
  try {
    const target = join(root, "modules #", "private%module.mjs");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'export const verified = "B118";\n');
    const url = nativeEsmFileUrl(target);
    assert.match(url, /^file:/);
    assert.ok(url.includes("%23"));
    assert.ok(url.includes("%25"));
    const imported = await import(url);
    assert.equal(imported.verified, "B118");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("relative, drive-relative and URL specifiers cannot masquerade as native files", () => {
  for (const value of ["relative.mjs", "../entry.mjs", "file:///tmp/x.mjs", "D:relative.mjs", "", null, undefined, "\0bad"]) {
    assert.throws(() => nativeEsmFileUrl(value), /absolute local file path/);
  }
});

test("legacy Windows drive-letter ESM imports fail before reaching the module", async () => {
  await assert.rejects(import("D:/Bostan-B118-temp/legacy-entry.mjs"), error =>
    error?.code === "ERR_UNSUPPORTED_ESM_URL_SCHEME");
});
