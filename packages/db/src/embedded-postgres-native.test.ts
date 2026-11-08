import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDarwinSharedLibraryAliases, ensureLinuxSharedLibraryAliases, prepareEmbeddedPostgresNativeRuntime } from "./embedded-postgres-native.js";

const require = createRequire(import.meta.url);

describe("embedded Postgres native runtime", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
