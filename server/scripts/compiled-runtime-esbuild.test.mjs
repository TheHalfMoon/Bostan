import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { bundleRuntime } from "./bundle-runtime.mjs";
import { nativeEsmFileUrl } from "./compiled-runtime-entry.mjs";

test("compiled esbuild runtime uses file URLs for native entry and private externals", async () => {
  const root = mkdtempSync(join(tmpdir(), "bostan-b118-esbuild-"));
  writeFileSync(join(root, "BOSTAN_QA_OWNED"), "BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
  const write = (file, source) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  };
  try {
    const server = join(root, "server");
    const fixture = join(root, "packages", "fixture");
    const privateDep = join(fixture, "node_modules", "package-private-dep", "index.js");
    write(join(server, "package.json"), '{"type":"module"}\n');
    write(join(fixture, "package.json"), '{"type":"module"}\n');
    write(join(dirname(privateDep), "package.json"),
      '{"name":"package-private-dep","type":"module","main":"index.js"}\n');
    write(privateDep, 'export const answer = 42;\n');
    write(join(fixture, "index.js"),
      'import {answer} from "package-private-dep"; export const result = answer;\n');
    const entry = join(server, "dist", "index.js");
    write(entry, 'import {result} from "../../packages/fixture/index.js"; console.log("B118_RUNTIME="+result);\n');
    const summary = await bundleRuntime({ entry, outdir: join(server, "dist-runtime") });
    const indexText = readFileSync(summary.outfile, "utf8");
    const serverText = readFileSync(summary.serverModule, "utf8");
    assert.ok(indexText.includes(nativeEsmFileUrl(entry)), "entry must use a file URL");
    assert.ok(serverText.includes(nativeEsmFileUrl(privateDep)),
      "package-private external must use a file URL");
    for (const target of [summary.outfile, summary.serverModule]) {
      const output = execFileSync(process.execPath, [target], {
        cwd: server, encoding: "utf8", timeout: 15_000, windowsHide: true,
      });
      assert.equal(output.trim(), "B118_RUNTIME=42");
    }
  } finally {
    // This fixture is created here and nowhere else. Never delete checkout
    // files or processes, even when a bundling assertion fails.
    assert.equal(readFileSync(join(root, "BOSTAN_QA_OWNED"), "utf8"),
      "BOSTAN_PRIVATE_SYNTHETIC_ONLY\n");
    rmSync(root, { recursive: true, force: true });
  }
});
