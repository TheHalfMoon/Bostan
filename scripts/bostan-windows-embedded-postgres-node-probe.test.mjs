import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { isOwnedProbeDirectory } from "./bostan-windows-embedded-postgres-node-probe.mjs";

test("PostgreSQL node probe cleanup is limited to its dedicated temp child", () => {
  const tempRoot = path.resolve("C:/runner/temp");
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "bostan-postgres-node-probe-abcd-"), tempRoot), true);
  assert.equal(isOwnedProbeDirectory(tempRoot, tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "other-data"), tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "bostan-postgres-node-probe-abcd-", "nested"), tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.resolve(tempRoot, "..", "outside", "bostan-postgres-node-probe-abcd-"), tempRoot), false);
});

test("Windows native workflow propagates a failed Node PostgreSQL probe", async () => {
  const workflowPath = new URL("../.github/workflows/bostan-native-windows-qualification.yml", import.meta.url);
  const workflow = await readFile(workflowPath, "utf8");
  const probeStep = workflow.match(/- name: Probe embedded PostgreSQL before packaging or model setup([\s\S]*?)(?=\n      - name:|\n      - run:|\n      - uses:|$)/)?.[1];

  assert.ok(probeStep, "expected the PostgreSQL preflight step");
  assert.match(probeStep, /shell:\s*pwsh/);
  assert.match(probeStep, /if \(\$LASTEXITCODE -ne 0\) \{ throw "Embedded PostgreSQL probe failed \(exit code \$LASTEXITCODE\)" \}/);
});

test("PowerShell dot-sourced workflow script propagates native Node exit codes", { skip: process.platform !== "win32" }, async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bostan-pwsh-exit-test-"));
  const scriptPath = path.join(tempRoot, "exit-check.ps1");
  try {
    await writeFile(scriptPath, [
      'node -e "process.exit(7)"',
      'if ($LASTEXITCODE -ne 0) { throw "native command failed" }',
      "",
    ].join("\n"), "utf8");
    const result = spawnSync("pwsh", ["-NoProfile", "-Command", `. '${scriptPath.replaceAll("'", "''")}'`], { encoding: "utf8" });

    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0, result.stderr);
  } finally {
    await rm(tempRoot, { recursive: true, force: false });
  }
});
