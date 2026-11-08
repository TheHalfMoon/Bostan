import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCodexLocalBuildAssets } from "./copy-build-assets.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "bostan-b137-codex-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src", "server"), { recursive: true });
  await mkdir(join(root, "dist", "server"), { recursive: true });
  for (const [name, text] of [
    ["codex-auth-merge-decision.cjs", "module.exports={ok:true};\n"],
    ["codex-auth-merge-extract.sh", "#!/bin/sh\nexit 0\n"],
  ]) await writeFile(join(root, "src", "server", name), text);
  return root;
}

test("Windows and macOS copy exact Codex auth-merge assets, preserving unrelated files", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "dist", "server", "DO_NOT_DELETE"), "KEEP");
  await copyCodexLocalBuildAssets(root);
  for (const name of ["codex-auth-merge-decision.cjs", "codex-auth-merge-extract.sh"]) {
    assert.deepEqual(await readFile(join(root, "dist", "server", name)),
      await readFile(join(root, "src", "server", name)));
  }
  assert.equal(await readFile(join(root, "dist", "server", "DO_NOT_DELETE"), "utf8"), "KEEP");
});

test("missing input fails without deleting other generated files", async t => {
  const root = await fixture(t);
  await rm(join(root, "src", "server", "codex-auth-merge-extract.sh"));
  const keep = join(root, "dist", "server", "DO_NOT_DELETE");
  await writeFile(keep, "KEEP");
  await assert.rejects(copyCodexLocalBuildAssets(root), { code: "ENOENT" });
  assert.equal(await readFile(keep, "utf8"), "KEEP");
});

test("linked build output is never overwritten", async t => {
  const root = await fixture(t);
  const keep = join(root, "DO_NOT_TOUCH");
  await writeFile(keep, "KEEP");
  try {
    await symlink(keep, join(root, "dist", "server", "codex-auth-merge-decision.cjs"), "file");
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error?.code)) {
      t.skip("OS disallows unprivileged file symlinks");
      return;
    }
    throw error;
  }
  await assert.rejects(copyCodexLocalBuildAssets(root), /regular file/);
  assert.equal(await readFile(keep, "utf8"), "KEEP");
});
