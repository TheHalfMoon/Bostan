import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { embeddedPostgresProcessHasExited, isOwnedProbeDirectory, shouldRemoveProbeDirectory, unhookEmbeddedPostgresExitEvents } from "./bostan-windows-embedded-postgres-node-probe.mjs";

test("PostgreSQL node probe cleanup is limited to its dedicated temp child", () => {
  const tempRoot = path.resolve("C:/runner/temp");
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "bostan-postgres-node-probe-abcd-"), tempRoot), true);
  assert.equal(isOwnedProbeDirectory(tempRoot, tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "other-data"), tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.join(tempRoot, "bostan-postgres-node-probe-abcd-", "nested"), tempRoot), false);
  assert.equal(isOwnedProbeDirectory(path.resolve(tempRoot, "..", "outside", "bostan-postgres-node-probe-abcd-"), tempRoot), false);
  const ownedChild = path.join(tempRoot, "bostan-postgres-node-probe-abcd-");
  assert.equal(shouldRemoveProbeDirectory(ownedChild, tempRoot, false), true);
  assert.equal(shouldRemoveProbeDirectory(ownedChild, tempRoot, true), false);
  assert.equal(shouldRemoveProbeDirectory(path.join(tempRoot, "unrelated"), tempRoot, false), false);
});

test("failed PostgreSQL startup does not await a child exit event that already fired", () => {
  assert.equal(embeddedPostgresProcessHasExited({ process: { exitCode: 1, signalCode: null } }), true);
  assert.equal(embeddedPostgresProcessHasExited({ process: { exitCode: null, signalCode: "SIGTERM" } }), true);
  assert.equal(embeddedPostgresProcessHasExited({ process: { exitCode: null, signalCode: null } }), false);
  assert.equal(embeddedPostgresProcessHasExited({}), false);
});

test("the PostgreSQL start diagnostic excludes successful initdb output", async () => {
  const probe = await readFile(new URL("./bostan-windows-embedded-postgres-node-probe.mjs", import.meta.url), "utf8");
  assert.match(probe, /phase = "start";\s*logBuffer\.clear\(\);\s*await instance\.start\(\)/);
});

test("the probe preserves its failure exit code after embedded-postgres cleanup", () => {
  const dbRequire = createRequire(path.resolve("packages/db/package.json"));
  const embeddedPostgresEntry = dbRequire.resolve("embedded-postgres");
  const embeddedPostgresUrl = pathToFileURL(embeddedPostgresEntry).href;
  const probeModuleUrl = new URL("./bostan-windows-embedded-postgres-node-probe.mjs", import.meta.url).href;
  const script = [
    `import ${JSON.stringify(embeddedPostgresUrl)};`,
    `import { createRequire } from "node:module";`,
    `import { unhookEmbeddedPostgresExitEvents } from ${JSON.stringify(probeModuleUrl)};`,
    `const exitHook = createRequire(${JSON.stringify(embeddedPostgresEntry)})("async-exit-hook");`,
    "if (!unhookEmbeddedPostgresExitEvents(exitHook)) process.exit(2);",
    "process.exitCode = 7;",
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 7, result.stderr);
});

test("Windows native workflow propagates a failed Node PostgreSQL probe", async () => {
  const workflowPath = new URL("../.github/workflows/bostan-native-windows-qualification.yml", import.meta.url);
  const workflow = await readFile(workflowPath, "utf8");
  const probeStep = workflow.match(/- name: Probe embedded PostgreSQL before packaging or model setup([\s\S]*?)(?=\n      - name:|\n      - run:|\n      - uses:|$)/)?.[1];

  assert.ok(probeStep, "expected the PostgreSQL preflight step");
  assert.match(probeStep, /shell:\s*pwsh/);
  assert.match(probeStep, /BOSTAN_POSTGRES_HOST_MEMORY/);
  assert.match(probeStep, /FreeVirtualMemory/);
  assert.match(probeStep, /\$probeExitCode = \$LASTEXITCODE/);
  assert.match(probeStep, /Write-Host "BOSTAN_NODE_POSTGRES_PROBE_SHELL_EXIT \$probeExitCode"/);
  assert.match(probeStep, /BOSTAN_POSTGRES_WINDOWS_EVENT/);
  assert.match(probeStep, /faultingModule = \$faultingModule; exceptionCode = \$exceptionCode/);
  assert.match(probeStep, /if \(\$probeExitCode -ne 0\) \{/);
  assert.match(probeStep, /throw "Embedded PostgreSQL probe failed \(exit code \$probeExitCode\)"/);
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
