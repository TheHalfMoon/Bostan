import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleRuntime } from "./bundle-runtime.mjs";

test("compiled Bostan workspace dependency executes built JS without source fallback", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bostan-b121-compiled-workspace-"));
  try {
    const server = join(fixture, "server");
    const pkg = join(server, "node_modules", "@bostan", "db");
    await mkdir(join(pkg, "dist"), { recursive: true });
    await mkdir(join(pkg, "src"), { recursive: true });
    await writeFile(join(pkg, "package.json"), JSON.stringify({
      name: "@bostan/db", type: "module",
      exports: { ".": { "bostan-compiled": "./dist/index.js", default: "./src/index.js" } },
    }));
    await writeFile(join(pkg, "dist", "index.js"), "export const value = 42;\n");
    await writeFile(join(pkg, "src", "index.js"), "throw new Error('BOSTAN_SOURCE_EXECUTED');\n");
    const entry = join(server, "entry.mjs");
    await writeFile(entry, "import { value } from '@bostan/db'; if (value !== 42) throw new Error('BAD_VALUE'); console.log('B121_COMPILED=42');\n");
    const result = await bundleRuntime({ entry, outdir: join(server, "runtime") });
    await rename(pkg, `${pkg}.unavailable`);
    const child = spawnSync(process.execPath, [result.serverModule], {
      cwd: server, encoding: "utf8", timeout: 10000,
    });
    assert.equal(child.status, 0, `compiled server failed: ${child.stderr?.slice(0, 300)}`);
    assert.match(child.stdout, /B121_COMPILED=42/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("unrelated third-party package remains runtime-external", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bostan-b121-external-"));
  try {
    const server = join(fixture, "server");
    const pkg = join(server, "node_modules", "third-party");
    await mkdir(pkg, { recursive: true });
    await writeFile(join(pkg, "package.json"), JSON.stringify({
      name: "third-party", type: "module", exports: "./index.js",
    }));
    await writeFile(join(pkg, "index.js"), "export const value = 1;\n");
    const entry = join(server, "entry.mjs");
    await writeFile(entry, "import { value } from 'third-party'; console.log('B121_EXTERNAL=' + value);\n");
    const result = await bundleRuntime({ entry, outdir: join(server, "runtime") });
    await writeFile(join(pkg, "index.js"), "export const value = 77;\n");
    const child = spawnSync(process.execPath, [result.serverModule], {
      cwd: server, encoding: "utf8", timeout: 10000,
    });
    assert.equal(child.status, 0, `external runtime failed: ${child.stderr?.slice(0, 300)}`);
    assert.match(child.stdout, /B121_EXTERNAL=77/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
