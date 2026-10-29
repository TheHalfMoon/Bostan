import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { assertSafeRuntimeOutdir } from "./bundle-runtime-output-admission.mjs";

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
