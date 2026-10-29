import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundleRuntime } from "./bundle-runtime.mjs";

test("bundled node_modules dependency must not embed its private source file URL", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b124-module-location-"));
  try {
    const server = join(root, "server");
    const pkg = join(server, "node_modules", "bostan-fixture-location");
    await mkdir(pkg, { recursive: true });
    await writeFile(join(pkg, "package.json"),
      JSON.stringify({ name: "bostan-fixture-location", type: "module", exports: "./index.mjs" }));
    const dependency = join(pkg, "index.mjs");
    await writeFile(dependency, "export const location = import.meta.url;\n");
    const entry = join(server, "entry.mjs");
    await writeFile(entry,
      "import { location } from 'bostan-fixture-location'; console.log('LOCATION=' + location);\n");
    const result = await bundleRuntime({
      entry, outdir: join(server, "runtime"), isBundled: () => true,
    });
    const bundled = await readFile(result.serverModule, "utf8");
    const privateSourceUrl = pathToFileURL(dependency).href;
    assert.equal(bundled.includes(privateSourceUrl), false,
      "compiled bundle must not embed the private node_modules source URL");
    const child = spawnSync(process.execPath, [result.serverModule], {
      cwd: server, encoding: "utf8", timeout: 10000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /LOCATION=file:/);
    assert.equal(child.stdout.includes(privateSourceUrl), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("first-party module location remains pinned for source-relative asset compatibility", async () => {
  const root = await mkdtemp(join(tmpdir(), "bostan-b124-first-party-location-"));
  try {
    const server = join(root, "server");
    await mkdir(server, { recursive: true });
    const modulePath = join(server, "location.mjs");
    await writeFile(modulePath, "export const location = import.meta.url;\n");
    const entry = join(server, "entry.mjs");
    await writeFile(entry,
      "import { location } from './location.mjs'; console.log('LOCATION=' + location);\n");
    const result = await bundleRuntime({ entry, outdir: join(server, "runtime") });
    const bundled = await readFile(result.serverModule, "utf8");
    const expectedSourceUrl = pathToFileURL(modulePath).href;
    assert.equal(bundled.includes(expectedSourceUrl), true);
    const child = spawnSync(process.execPath, [result.serverModule], {
      cwd: server, encoding: "utf8", timeout: 10000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), "LOCATION=" + expectedSourceUrl);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
