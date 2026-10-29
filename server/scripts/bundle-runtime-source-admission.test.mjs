import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSafeRuntimeOutdir, recordRuntimeOutputOwnership } from "./bundle-runtime-output-admission.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "bostan-b125-owned-"));
  try {
    const server = join(root, "server");
    const dist = join(server, "dist");
    const outdir = join(server, "dist-runtime");
    await mkdir(dist, { recursive: true });
    await mkdir(outdir);
    const entry = join(dist, "index.js");
    const index = join(outdir, "index.mjs");
    const compiledServer = join(outdir, "server.mjs");
    await writeFile(entry, "export {};\n");
    await writeFile(index, "import './server.mjs';\n");
    await writeFile(compiledServer, "console.log('owned');\n");
    await recordRuntimeOutputOwnership(entry, outdir, [index, compiledServer]);
    await run({ root, entry, outdir, index, compiledServer });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("refuse owned output deletion admission if original compiled source disappeared", async () => {
  await fixture(async ({ entry, outdir, compiledServer }) => {
    await unlink(entry);
    await assert.rejects(assertSafeRuntimeOutdir(entry, outdir), /not safely isolated/);
    assert.equal(await readFile(compiledServer, "utf8"), "console.log('owned');\n");
  });
});

test("refuse owned output deletion admission if source becomes a directory", async () => {
  await fixture(async ({ entry, outdir, compiledServer }) => {
    await unlink(entry);
    await mkdir(entry);
    await assert.rejects(assertSafeRuntimeOutdir(entry, outdir), /not safely isolated/);
    assert.equal(await readFile(compiledServer, "utf8"), "console.log('owned');\n");
  });
});

test("refuse owned output deletion admission if source becomes a symlink", async (t) => {
  await fixture(async ({ entry, outdir, compiledServer, root }) => {
    const other = join(root, "unrelated.js");
    await writeFile(other, "export {};\n");
    await unlink(entry);
    try { await symlink(other, entry, "file"); }
    catch (e) { if (e.code === "EPERM") { t.skip("symlink privilege unavailable"); return; } throw e; }
    await assert.rejects(assertSafeRuntimeOutdir(entry, outdir), /not safely isolated/);
    assert.equal(await readFile(compiledServer, "utf8"), "console.log('owned');\n");
  });
});

test("unchanged regular entry and exact owned output remain admitted", async () => {
  await fixture(async ({ entry, outdir }) => {
    assert.equal(await assertSafeRuntimeOutdir(entry, outdir), outdir);
  });
});
