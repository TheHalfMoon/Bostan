import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitCompiledRuntimeOutputs, buildAndCommitCompiledRuntime } from "./bundle-runtime-commit.mjs";

const response = (dir) => ({ outputFiles: [
  { path: join(dir, "index.mjs"), contents: Buffer.from('import "./server.mjs";') },
  { path: join(dir, "server.mjs"), contents: Buffer.from("console.log(42);") },
] });
function fakeAdmission(dir) {
  return {
    assertSafeRuntimeOutdir: async (_entry, outdir) => {
      assert.equal(outdir, dir);
      return outdir;
    },
    recordRuntimeOutputOwnership: async (_entry, _outdir, paths) => {
      assert.equal(paths.length, 2);
      for (const p of paths) assert.ok((await stat(p)).isFile());
    },
  };
}
test("prepared outputs replace old contents only after validating the complete batch", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b127-owned-"));
  const dir = join(root, "runtime");
  try {
    await mkdir(dir);
    await writeFile(join(dir, "old.mjs"), "old");
    const x = await commitCompiledRuntimeOutputs({
      entry: join(root, "entry.js"), outdir: dir, result: response(dir), ...fakeAdmission(dir),
    });
    assert.equal(x, dir);
    assert.deepEqual((await readdir(dir)).sort(), ["index.mjs", "server.mjs"]);
    assert.match(await readFile(join(dir, "server.mjs"), "utf8"), /42/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("failed compilation cannot delete the previously working bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b127-owned-"));
  const dir = join(root, "runtime");
  try {
    await mkdir(dir);
    await writeFile(join(dir, "server.mjs"), "WORKING");
    let called = false;
    await assert.rejects(buildAndCommitCompiledRuntime({
      entry: join(root, "entry.js"), outdir: dir, options: { write: true, outdir: root },
      buildRuntime: async (options) => {
        called = true;
        assert.equal(options.write, false);
        assert.equal(options.outdir, dir);
        throw Error("synthetic esbuild parse failure");
      }, ...fakeAdmission(dir),
    }), /parse failure/);
    assert.ok(called);
    assert.equal(await readFile(join(dir, "server.mjs"), "utf8"), "WORKING");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("malformed or escaping prepared outputs never trigger deletion", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b127-owned-"));
  const dir = join(root, "runtime");
  try {
    await mkdir(dir);
    await writeFile(join(dir, "server.mjs"), "WORKING");
    const good = response(dir).outputFiles;
    for (const invalid of [
      { outputFiles: [...good, { path: join(root, "private.mjs"), contents: Buffer.from("x") }] },
      { outputFiles: [...good, { path: join(dir, "..", "esc.mjs"), contents: Buffer.from("x") }] },
      { outputFiles: [...good, good[0]] },
      { outputFiles: [good[0]] },
      { outputFiles: [good[0], { path: join(dir, "server.mjs"), contents: "not bytes" }] },
    ]) {
      await assert.rejects(commitCompiledRuntimeOutputs({
        entry: join(root, "entry.js"), outdir: dir, result: invalid, ...fakeAdmission(dir),
      }), /not safely isolated/);
      assert.equal(await readFile(join(dir, "server.mjs"), "utf8"), "WORKING");
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("late output admission failure preserves the last bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b127-owned-"));
  const dir = join(root, "runtime");
  try {
    await mkdir(dir);
    await writeFile(join(dir, "server.mjs"), "WORKING");
    let count = 0;
    await assert.rejects(commitCompiledRuntimeOutputs({
      entry: join(root, "entry.js"), outdir: dir, result: response(dir),
      ...fakeAdmission(dir),
      assertSafeRuntimeOutdir: async () => {
        if (++count === 2) throw Error("synthetic source changed");
        return dir;
      },
    }), /source changed/);
    assert.equal(await readFile(join(dir, "server.mjs"), "utf8"), "WORKING");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("successful non-writing build commits its verified outputFiles", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b127-owned-"));
  const dir = join(root, "runtime");
  try {
    await mkdir(dir);
    await writeFile(join(dir, "server.mjs"), "OLD");
    const { result, admittedOutdir } = await buildAndCommitCompiledRuntime({
      entry: join(root, "entry.js"), outdir: dir, options: { write: true },
      buildRuntime: async (options) => {
        assert.equal(options.write, false);
        assert.equal(options.outdir, dir);
        return response(dir);
      },
      ...fakeAdmission(dir),
    });
    assert.equal(admittedOutdir, dir);
    assert.equal(result.outputFiles.length, 2);
    assert.equal(await readFile(join(dir, "server.mjs"), "utf8"), "console.log(42);");
  } finally { await rm(root, { recursive: true, force: true }); }
});
