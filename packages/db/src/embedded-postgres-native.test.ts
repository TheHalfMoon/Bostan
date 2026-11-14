import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDarwinSharedLibraryAliases, ensureLinuxSharedLibraryAliases, prepareEmbeddedPostgresNativeRuntime, resolveEmbeddedPostgresNativePackageRoot } from "./embedded-postgres-native.js";

const require = createRequire(import.meta.url);

describe("embedded Postgres native runtime", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("resolves a hoisted native package from the deployed nested dependency instead of guessing a sibling", () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-deployed-pg-resolution-"));
    tempDirs.push(root);
    const embedded = path.join(root, "node_modules/.pnpm/@bostan+db_fixture/node_modules/@bostan/db/node_modules/embedded-postgres");
    const native = path.join(root, "native-package");
    const hoisted = path.join(root, "node_modules/.pnpm/node_modules/@embedded-postgres/darwin-arm64");
    fs.mkdirSync(path.join(embedded, "dist"), { recursive: true });
    fs.mkdirSync(path.join(native, "dist"), { recursive: true });
    fs.mkdirSync(path.join(native, "native/lib"), { recursive: true });
    fs.writeFileSync(path.join(embedded, "dist/index.js"), "");
    fs.writeFileSync(path.join(native, "package.json"), JSON.stringify({ name: "@embedded-postgres/darwin-arm64", exports: "./dist/index.js" }));
    fs.writeFileSync(path.join(native, "dist/index.js"), "");
    fs.mkdirSync(path.dirname(hoisted), { recursive: true });
    fs.symlinkSync(native, hoisted, process.platform === "win32" ? "junction" : "dir");
    fs.writeFileSync(path.join(native, "native/lib/libicudata.77.1.dylib"), "synthetic");
    expect(fs.existsSync(path.join(embedded, "../@embedded-postgres/darwin-arm64/native/lib"))).toBe(false);
    const resolved = resolveEmbeddedPostgresNativePackageRoot(path.join(embedded, "dist/index.js"), "darwin-arm64");
    expect(resolved).toBe(native);
    expect(fs.readFileSync(path.join(resolved!, "native/lib/libicudata.77.1.dylib"), "utf8")).toBe("synthetic");
    expect(resolveEmbeddedPostgresNativePackageRoot(path.join(embedded, "dist/index.js"), "missing-native-fixture")).toBeNull();
  });

  it.runIf(process.platform !== "win32")("creates soname aliases for bundled patch-level shared libraries", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-embedded-pg-libs-"));
    tempDirs.push(tempDir);
    fs.writeFileSync(path.join(tempDir, "libicuuc.so.60.2"), "");
    fs.writeFileSync(path.join(tempDir, "libicui18n.so.60.2"), "");
    fs.writeFileSync(path.join(tempDir, "README.md"), "");

    const created = await ensureLinuxSharedLibraryAliases(tempDir);

    expect(created.map((file) => path.basename(file)).sort()).toEqual([
      "libicui18n.so.60",
      "libicuuc.so.60",
    ]);
    expect(fs.readlinkSync(path.join(tempDir, "libicuuc.so.60"))).toBe("libicuuc.so.60.2");
  });

  it.runIf(process.platform !== "win32")("is idempotent when aliases already exist", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-embedded-pg-libs-"));
    tempDirs.push(tempDir);
    fs.writeFileSync(path.join(tempDir, "libicuuc.so.60.2"), "");

    await ensureLinuxSharedLibraryAliases(tempDir);
    const second = await ensureLinuxSharedLibraryAliases(tempDir);

    expect(second).toEqual([]);
    expect(fs.readlinkSync(path.join(tempDir, "libicuuc.so.60"))).toBe("libicuuc.so.60.2");
  });

  it("creates only matching macOS major-soname aliases without touching other files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-postgres-libs-"));
    tempDirs.push(dir);
    fs.writeFileSync(path.join(dir, "libicudata.77.1.dylib"), "synthetic-ICU");
    fs.writeFileSync(path.join(dir, "libicuuc.77.1.dylib"), "synthetic-UC");
    fs.writeFileSync(path.join(dir, "libz.1.3.1.dylib"), "synthetic-zlib");
    fs.writeFileSync(path.join(dir, "libzstd.1.5.7.dylib"), "synthetic-zstd");
    fs.writeFileSync(path.join(dir, "libssl.3.dylib"), "unmodified");
    const created = await ensureDarwinSharedLibraryAliases(dir);
    expect(created.map(value => path.basename(value)).sort()).toEqual([
      "libicudata.77.dylib", "libicudata.dylib",
      "libicuuc.77.dylib", "libicuuc.dylib",
      "libz.1.dylib", "libzstd.1.dylib",
    ]);
    expect(fs.readlinkSync(path.join(dir, "libicudata.77.dylib")))
      .toBe("libicudata.77.1.dylib");
    expect(fs.readlinkSync(path.join(dir, "libicuuc.dylib")))
      .toBe("libicuuc.77.1.dylib");
    expect(fs.readFileSync(path.join(dir, "libssl.3.dylib"), "utf8")).toBe("unmodified");
    expect(fs.readlinkSync(path.join(dir, "libzstd.1.dylib")))
      .toBe("libzstd.1.5.7.dylib");
    expect(await ensureDarwinSharedLibraryAliases(dir)).toEqual([]);
  });

  it("preserves an existing alias file rather than overwriting dependency content", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-existing-alias-"));
    tempDirs.push(dir);
    fs.writeFileSync(path.join(dir, "libicudata.77.1.dylib"), "versioned");
    fs.writeFileSync(path.join(dir, "libicudata.77.dylib"), "existing");
    expect((await ensureDarwinSharedLibraryAliases(dir)).map(file => path.basename(file)))
      .toEqual(["libicudata.dylib"]);
    expect(fs.readFileSync(path.join(dir, "libicudata.77.dylib"), "utf8")).toBe("existing");
    expect(fs.readlinkSync(path.join(dir, "libicudata.dylib")))
      .toBe("libicudata.77.1.dylib");
  });

  it("keeps the child process API untouched while preparing the runtime", async () => {
    const originalSpawn = childProcess.spawn;

    await prepareEmbeddedPostgresNativeRuntime();

    expect(childProcess.spawn).toBe(originalSpawn);
  });

  it("uses the dependency-scoped portable locale patch", () => {
    const source = fs.readFileSync(require.resolve("embedded-postgres"), "utf8");

    expect(source).toContain("const LC_MESSAGES_LOCALE = 'C';");
    expect(source).toContain("globalThis.process.env");
  });
});
