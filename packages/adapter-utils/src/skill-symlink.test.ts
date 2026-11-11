import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { ensurePaperclipSkillSymlink } from "./server-utils.js";

async function fixture() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bostan-skill-link-")));
  const identity = await fs.lstat(root);
  return { root, cleanup: async () => {
    const current = await fs.lstat(root);
    expect(current.isSymbolicLink()).toBe(false);
    expect(await fs.realpath(root)).toBe(root);
    expect([current.dev, current.ino]).toEqual([identity.dev, identity.ino]);
    await fs.rm(root, { recursive: true });
  } };
}

it("delivers a real runtime skill and repairs a dangling directory link without elevation", async () => {
  const { root, cleanup } = await fixture();
  try {
    const source = path.join(root, "source"); await fs.mkdir(source);
    await fs.writeFile(path.join(source, "SKILL.md"), "runtime skill");
    const target = path.join(root, "installed");
    expect(await ensurePaperclipSkillSymlink(source, target)).toBe("created");
    expect((await fs.lstat(target)).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(target)).toBe(source);
    expect(await fs.readFile(path.join(target, "SKILL.md"), "utf8")).toBe("runtime skill");
    expect(await ensurePaperclipSkillSymlink(source, target)).toBe("skipped");
    await fs.unlink(target);
    const oldSource = path.join(root, "removed-source"); await fs.mkdir(oldSource);
    await fs.symlink(oldSource, target, process.platform === "win32" ? "junction" : "dir");
    expect(path.dirname(oldSource)).toBe(root);
    await fs.rmdir(oldSource);
    expect(await ensurePaperclipSkillSymlink(source, target)).toBe("repaired");
    expect(await fs.realpath(target)).toBe(source);
  } finally { await cleanup(); }
});

it("preserves existing real skill directories and live links to another source", async () => {
  const { root, cleanup } = await fixture();
  try {
    const source = path.join(root, "source"), existing = path.join(root, "user-skill");
    await fs.mkdir(source); await fs.mkdir(existing);
    await fs.writeFile(path.join(existing, "SKILL.md"), "user-owned content");
    expect(await ensurePaperclipSkillSymlink(source, existing)).toBe("skipped");
    const target = path.join(root, "other-link");
    await fs.symlink(existing, target, process.platform === "win32" ? "junction" : "dir");
    expect(await ensurePaperclipSkillSymlink(source, target)).toBe("skipped");
    expect(await fs.realpath(target)).toBe(existing);
    expect(await fs.readFile(path.join(existing, "SKILL.md"), "utf8")).toBe("user-owned content");
  } finally { await cleanup(); }
});
