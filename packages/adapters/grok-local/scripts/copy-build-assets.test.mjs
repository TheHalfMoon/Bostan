import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyGrokLocalBuildAsset } from "./copy-build-assets.mjs";

const ASSET = "grok-auth-merge-decision.cjs";
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "bostan-b137-grok-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src", "server"), { recursive: true });
  await mkdir(join(root, "dist", "server"), { recursive: true });
  await writeFile(join(root, "src", "server", ASSET), 'module.exports={identity:"synthetic"};\n');
  return root;
}
test("portable Grok build copies byte-for-byte and preserves other files", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "dist", "server", "KEEP"), "FOREIGN");
  await copyGrokLocalBuildAsset(root);
  assert.deepEqual(await readFile(join(root, "dist", "server", ASSET)),
    await readFile(join(root, "src", "server", ASSET)));
  assert.equal(await readFile(join(root, "dist", "server", "KEEP"), "utf8"), "FOREIGN");
});
test("missing Grok input cannot modify existing output", async t => {
  const root = await fixture(t);
  await rm(join(root, "src", "server", ASSET));
  await assert.rejects(copyGrokLocalBuildAsset(root), { code: "ENOENT" });
});
test("Grok build never overwrites linked output", async t => {
  const root = await fixture(t);
  const sentinel = join(root, "EXTERNAL");
  await writeFile(sentinel, "KEEP");
  try { await symlink(sentinel, join(root, "dist", "server", ASSET), "file"); }
  catch (e) {
    if (["EPERM","EACCES"].includes(e?.code)) { t.skip("OS disallows file symlinks"); return; }
    throw e;
  }
  await assert.rejects(copyGrokLocalBuildAsset(root), /linked or non-file/);
  assert.equal(await readFile(sentinel, "utf8"), "KEEP");
});
