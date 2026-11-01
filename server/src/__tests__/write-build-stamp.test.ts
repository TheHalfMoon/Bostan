import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveBuildCommit } from "../../scripts/write-build-stamp.mjs";

it("packages a full source commit without a Docker build argument", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "paperclip-build-stamp-")));
  try {
    const scriptDir = join(root, "server", "scripts");
    mkdirSync(scriptDir, { recursive: true });
    const script = join(scriptDir, "write-build-stamp.mjs");
    copyFileSync(new URL("../../scripts/write-build-stamp.mjs", import.meta.url), script);
    const compiled = join(root, "server", "dist");
    mkdirSync(join(compiled, "vendor", "paperclip-runner"), {recursive:true});
    const compiledEntry = "compiled-fixture-entry";
    const runnerEntry = "runner-fixture-entry";
    writeFileSync(join(compiled, "index.js"), compiledEntry);
    writeFileSync(join(compiled, "vendor", "paperclip-runner", "index.js"), runnerEntry);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git("init", "--quiet");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "--no-gpg-sign", "-m", "fixture");
    const env = { ...process.env };
    delete env.PAPERCLIP_BUILD_COMMIT;
    execFileSync(process.execPath, [script], { cwd: root, env, stdio: "pipe" });
    const stamp = JSON.parse(readFileSync(join(root, "server", "dist", "build-info.json"), "utf8"));
    expect(stamp.commit).toBe(git("rev-parse", "HEAD"));
    expect(stamp.commit).toMatch(/^[0-9a-f]{40}$/);
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    expect(stamp.indexSha256).toBe(hash(compiledEntry));
    expect(stamp.vendorSha256).toBe(hash(runnerEntry));
    expect(Object.keys(stamp).sort()).toEqual(["commit","indexSha256","vendorSha256"].sort());
    // A build stamp must never overwrite a linked file outside dist.
    const stampPath = join(compiled, "build-info.json");
    const outsideStamp = join(root, "outside-stamp.json");
    writeFileSync(outsideStamp, "foreign-owned-sentinel");
    rmSync(stampPath);
    symlinkSync(outsideStamp, stampPath);
    expect(() => execFileSync(process.execPath, [script], {
      cwd: root, env, stdio: "pipe",
    })).toThrow();
    expect(readFileSync(outsideStamp, "utf8")).toBe("foreign-owned-sentinel");
    rmSync(stampPath);

    // A linked intermediate compiled directory is not an owned artifact.
    const vendorDir = join(compiled, "vendor", "paperclip-runner");
    const outsideRunner = join(root, "outside-runner");
    mkdirSync(outsideRunner);
    writeFileSync(join(outsideRunner, "index.js"), runnerEntry);
    rmSync(vendorDir, {recursive: true});
    symlinkSync(outsideRunner, vendorDir, "dir");
    expect(() => execFileSync(process.execPath, [script], {
      cwd: root, env, stdio: "pipe",
    })).toThrow();
    expect(readFileSync(join(outsideRunner, "index.js"), "utf8")).toBe(runnerEntry);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("resolveBuildCommit", () => {
  it("prefers the git commit over the supplied environment commit", () => {
    expect(resolveBuildCommit("aaaaaaa", "bbbbbbb")).toBe("aaaaaaa");
  });

  it("falls back to PAPERCLIP_BUILD_COMMIT when git gives no commit", () => {
    // A Docker image build excludes `.git`, so the git lookup returns null. The
    // image build passes the commit in the environment instead.
    expect(resolveBuildCommit(null, "bbbbbbb")).toBe("bbbbbbb");
  });

  it("trims the supplied commit", () => {
    expect(resolveBuildCommit(null, "  bbbbbbb\n")).toBe("bbbbbbb");
  });

  it("returns null when neither git nor the environment gives a commit", () => {
    expect(resolveBuildCommit(null, undefined)).toBe(null);
  });

  it("treats an empty supplied commit as absent", () => {
    expect(resolveBuildCommit(null, "")).toBe(null);
    expect(resolveBuildCommit(null, "   ")).toBe(null);
  });
});
