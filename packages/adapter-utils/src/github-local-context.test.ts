import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { prepareGitHubExecutionEnvironment } from "./execution-target.js";

it("local Git context supports workspaces beyond Windows MAX_PATH through an actual child", async () => {
  const parent = await realpath(os.tmpdir());
  const root = await mkdtemp(path.join(parent, "bostan-git-context-"));
  try {
    const cwd = path.join(root, ...Array.from({ length: 9 }, (_, n) => `segment-${n}-${"x".repeat(24)}`));
    await mkdir(cwd, { recursive: true });
    expect(cwd.length).toBeGreaterThan(260);
    const prepared = await prepareGitHubExecutionEnvironment({ target: null, cwd,
      env: { BOSTAN_CONTEXT_PROOF: "synthetic" }, hostCredentials: false, networkAccess: false });
    expect(prepared.BOSTAN_CONTEXT_PROOF).toBe("synthetic");
    expect(prepared.PAPERCLIP_GITHUB_AUTH_MODE).toBe("managed");
    expect(prepared.PAPERCLIP_RUNNER_NETWORK_ACCESS).toBe("disabled");
    expect(JSON.parse(prepared.PAPERCLIP_GIT_METADATA_ROOTS)).toEqual([]);
  } finally {
    if (path.dirname(root) !== parent || await realpath(root) !== root) throw new Error("Owned Git-context fixture changed");
    await rm(root, { recursive: true });
  }
}, 20_000);
