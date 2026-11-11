import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runnerStressEvalModuleUrl } from "./runner-stress-eval-module-url.mjs";

test("runner stress eval entry is a valid file URL on every OS", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b136-esm-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist", "eval"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "dist", "eval", "index.js"), 'export const proof = "BOSTAN_PORTABLE_ESM";\n');
  const url = runnerStressEvalModuleUrl(root);
  assert.equal(new URL(url).protocol, "file:");
  assert.equal((await import(url)).proof, "BOSTAN_PORTABLE_ESM");
});

test("runner ESM URL safely resolves directories with spaces", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b136-space-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pkg = join(root, "owned fixture directory");
  await mkdir(join(pkg, "dist", "eval"), { recursive: true });
  await writeFile(join(pkg, "package.json"), '{"type":"module"}\n');
  await writeFile(join(pkg, "dist", "eval", "index.js"), 'export default 136;\n');
  const url = runnerStressEvalModuleUrl(pkg);
  assert.ok(url.includes("owned%20fixture%20directory"));
  assert.equal((await import(url)).default, 136);
});
