import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-create-bostan-plugin-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("create-bostan-plugin entrypoints", () => {
  it("keeps src/index.ts import-safe when process.argv points at another bundled CLI", async () => {
    const originalArgv = process.argv;
    const outputRoot = makeTempDir();

    try {
      process.argv = [process.execPath, path.resolve("cli/dist/index.js"), "demo-plugin", "--output", outputRoot];
      const library = await import("./index.js");

      expect(library.scaffoldPluginProject).toBeTypeOf("function");
      expect(fs.existsSync(path.join(outputRoot, "demo-plugin"))).toBe(false);
    } finally {
      process.argv = originalArgv;
    }
  });

  it("creates a private Bostan source-linked scaffold outside workspace without packing", async () => {
    const { scaffoldPluginProject } = await import("./index.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-private-plugin-"));
    tempDirs.push(dir);
    const target = path.join(dir, "external-bostan-plugin");
    const sdkPath = path.resolve("packages/plugins/sdk");
    expect(scaffoldPluginProject({ pluginName: "external-bostan-plugin", outputDir: target,
      sdkPath })).toBe(target);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    expect(manifest).toMatchObject({ name: "external-bostan-plugin", private: true,
      description: "A Bostan plugin", paperclipPlugin: { manifest: "./dist/manifest.js" } });
    expect(manifest.devDependencies["@bostan/plugin-sdk"]).toBe(
      "link:" + path.relative(target, sdkPath).split(path.sep).join("/"));
    expect(manifest.devDependencies["@bostan/shared"]).toBeUndefined();
    expect(fs.existsSync(path.join(target, ".paperclip-sdk"))).toBe(false);
    const readme = fs.readFileSync(path.join(target, "README.md"), "utf8");
    expect(readme).toContain("bostan plugin install ");
    expect(readme).not.toContain("paperclipai plugin install");
    expect(readme).not.toContain("published package versions");
  });

  it("rejects an unrelated SDK before touching the destination", async () => {
    const { scaffoldPluginProject } = await import("./index.js");
    const root = makeTempDir();
    const imposter = path.join(root, "imposter");
    fs.mkdirSync(imposter);
    fs.writeFileSync(path.join(imposter, "package.json"), JSON.stringify({
      name: "@paperclipai/plugin-sdk", private: true }));
    const outputDir = path.join(root, "should-not-exist");
    expect(() => scaffoldPluginProject({pluginName:"demo-plugin",outputDir,sdkPath:imposter}))
      .toThrow(/private @bostan\/plugin-sdk/);
    expect(fs.existsSync(outputDir)).toBe(false);
  });

  it("runs scaffolding from src/bin.ts", async () => {
    const { runCli } = await import("./bin.js");
    const outputRoot = makeTempDir();
    const stdout: string[] = [];
    const outputDir = path.join(outputRoot, "demo-plugin");

    const result = runCli(
      [
        process.execPath,
        "create-bostan-plugin",
        "demo-plugin",
        "--output",
        outputRoot,
        "--sdk-path",
        path.resolve("packages/plugins/sdk"),
      ],
      {
        stdout: (message) => stdout.push(message),
        stderr: (message) => {
          throw new Error(message);
        },
        exit: (code) => {
          throw new Error(`unexpected exit ${code}`);
        },
      },
    );

    expect(result).toBe(outputDir);
    expect(stdout).toEqual([`Created plugin scaffold at ${outputDir}`]);
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, "package.json"), "utf8"))).toMatchObject({
      name: "demo-plugin",
      paperclipPlugin: {
        manifest: "./dist/manifest.js",
        worker: "./dist/worker.js",
        ui: "./dist/ui/",
      },
    });
  });
});
