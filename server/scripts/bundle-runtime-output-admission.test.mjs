import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { assertSafeRuntimeOutdir, recordRuntimeOutputOwnership } from "./bundle-runtime-output-admission.mjs";

test("admits only dedicated output adjacent to owned source", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b122-owned-"));
  try {
    const server = join(root, "server");
    const dist = join(server, "dist");
    await mkdir(dist, { recursive: true });
    const entry = join(dist, "index.js");
    await writeFile(entry, "export {};");
    assert.equal(await assertSafeRuntimeOutdir(entry, join(server, "dist-runtime")), join(server, "dist-runtime"));
    await mkdir(join(server, "dist-runtime"));
    assert.equal(await assertSafeRuntimeOutdir(entry, join(server, "dist-runtime")), join(server, "dist-runtime"));
    const adjacent = join(server, "entry.mjs");
    await writeFile(adjacent, "export {};");
    assert.equal(await assertSafeRuntimeOutdir(adjacent, join(server, "runtime")), join(server, "runtime"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rejects dangerous deletion destinations without modifying sentinel", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b122-owned-"));
  try {
    const server = join(root, "server");
    const dist = join(server, "dist");
    await mkdir(dist, { recursive: true });
    const entry = join(dist, "index.js");
    await writeFile(entry, "export {};");
    const sentinel = join(root, "KEEP_ME");
    await writeFile(sentinel, "safe");
    for (const out of [root, server, dist, parse(root).root, join(root, "runtime"), join(server, "user-data"), join(server, "runtime", "..", "..", "outside"), "runtime", "", join(server, "dist-runtime", "nested")]) {
      await assert.rejects(assertSafeRuntimeOutdir(entry, out), /not safely isolated/);
    }
    assert.equal(await readFile(sentinel, "utf8"), "safe");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rejects linked runtime output, including a symlinked ancestor", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b122-owned-"));
  try {
    const server = join(root, "server");
    await mkdir(server);
    const entry = join(server, "entry.mjs");
    await writeFile(entry, "export {};");
    const elsewhere = join(root, "elsewhere");
    await mkdir(elsewhere);
    const sentinel = join(elsewhere, "KEEP_ME");
    await writeFile(sentinel, "safe");
    try { await symlink(elsewhere, join(server, "runtime"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) { if (error?.code === "EPERM") { t.skip("symlink privilege unavailable"); return; } throw error; }
    await assert.rejects(assertSafeRuntimeOutdir(entry, join(server, "runtime")), /not safely isolated/);
    assert.equal(await readFile(sentinel, "utf8"), "safe");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("refuses a pre-existing nonempty runtime folder without Bostan ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b123-red-"));
  try {
    const server = join(root, "server");
    const dist = join(server, "dist");
    await mkdir(dist, { recursive: true });
    const entry = join(dist, "index.js");
    await writeFile(entry, "export {};");
    const output = join(server, "dist-runtime");
    await mkdir(output);
    const sentinel = join(output, "IMPORTANT_USER_DATA.txt");
    await writeFile(sentinel, "do-not-delete");
    await assert.rejects(assertSafeRuntimeOutdir(entry, output), /not safely isolated/);
    assert.equal(await readFile(sentinel, "utf8"), "do-not-delete");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("accepts a completely owned compiled runtime and rejects foreign or modified files", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b123-owned-"));
  try {
    const server = join(root, "server");
    const dist = join(server, "dist");
    await mkdir(dist, { recursive: true });
    const entry = join(dist, "index.js");
    await writeFile(entry, "export {};");
    const output = join(server, "dist-runtime");
    await mkdir(output);
    const index = join(output, "index.mjs");
    const serverEntry = join(output, "server.mjs");
    await writeFile(index, "import './server.mjs';\n");
    await writeFile(serverEntry, "console.log('Bostan');\n");
    await assert.rejects(assertSafeRuntimeOutdir(entry, output), /not safely isolated/);
    await recordRuntimeOutputOwnership(entry, output, [index, serverEntry]);
    assert.equal(await assertSafeRuntimeOutdir(entry, output), output);
    const foreign = join(output, "private-user-notes.txt");
    await writeFile(foreign, "keep me");
    await assert.rejects(assertSafeRuntimeOutdir(entry, output), /not safely isolated/);
    assert.equal(await readFile(foreign, "utf8"), "keep me");
    await rm(foreign);
    await writeFile(serverEntry, "modified by user\n");
    await assert.rejects(assertSafeRuntimeOutdir(entry, output), /not safely isolated/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("an ownership marker cannot be copied to a different entry or output", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b123-owned-"));
  try {
    const server = join(root, "server");
    const dist = join(server, "dist");
    await mkdir(dist, {recursive:true});
    const source = join(dist,"index.js");
    const otherSource = join(dist,"other.js");
    await writeFile(source,"export {};");
    await writeFile(otherSource,"export {};");
    const output = join(server,"dist-runtime");
    await mkdir(output);
    const files=[join(output,"index.mjs"),join(output,"server.mjs")];
    for (const f of files) await writeFile(f,"export {};");
    await recordRuntimeOutputOwnership(source,output,files);
    await assert.rejects(assertSafeRuntimeOutdir(otherSource,output), /not safely isolated/);
    assert.equal(await assertSafeRuntimeOutdir(source,output),output);
  } finally { await rm(root,{recursive:true,force:true}); }
});
