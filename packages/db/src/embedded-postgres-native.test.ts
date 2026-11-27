import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDarwinSharedLibraryAliases, ensureLinuxSharedLibraryAliases, prepareEmbeddedPostgresNativeRuntime, prepareWindowsPostgresExtensionRuntime, resolveEmbeddedPostgresNativePackageRoot, resolvePackagedEmbeddedPostgresEntry } from "./embedded-postgres-native.js";

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

  it("resolves embedded-postgres from the installed runtime instead of the bundled source module location", async () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-packaged-pg-resolution-"));
    tempDirs.push(root);
    const runtimeRoot = path.join(root, "installed-runtime");
    const serverPackageRoot = path.join(runtimeRoot, "node_modules", "@bostan", "server");
    const embedded = path.join(serverPackageRoot, "node_modules", "embedded-postgres");
    const sourceDecoy = path.join(root, "workspace", "packages", "db", "node_modules", "embedded-postgres");
    fs.mkdirSync(path.join(serverPackageRoot, "dist"), { recursive: true });
    fs.mkdirSync(path.join(embedded, "dist"), { recursive: true });
    fs.mkdirSync(path.join(sourceDecoy, "dist"), { recursive: true });
    fs.writeFileSync(path.join(serverPackageRoot, "package.json"), JSON.stringify({ name: "@bostan/server", version: "0.3.1" }));
    fs.writeFileSync(path.join(embedded, "package.json"), JSON.stringify({ name: "embedded-postgres", exports: "./dist/index.js" }));
    fs.writeFileSync(path.join(embedded, "dist", "index.js"), "export default class InstalledPostgres {}\n");
    fs.writeFileSync(path.join(sourceDecoy, "package.json"), JSON.stringify({ name: "embedded-postgres", exports: "./dist/index.js" }));
    fs.writeFileSync(path.join(sourceDecoy, "dist", "index.js"), "export default class WorkspaceDecoy {}\n");

    const resolved = await resolvePackagedEmbeddedPostgresEntry(runtimeRoot);

    expect(resolved).toBe(fs.realpathSync(path.join(embedded, "dist", "index.js")));
    expect(resolved).not.toBe(fs.realpathSync(path.join(sourceDecoy, "dist", "index.js")));
  });

  it("refuses an installed server package that resolves outside the runtime", async () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-packaged-pg-escape-"));
    tempDirs.push(root);
    const runtimeRoot = path.join(root, "installed-runtime");
    const serverLink = path.join(runtimeRoot, "node_modules", "@bostan", "server");
    const outside = path.join(root, "outside-server");
    fs.mkdirSync(path.dirname(serverLink), { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, serverLink, process.platform === "win32" ? "junction" : "dir");

    await expect(resolvePackagedEmbeddedPostgresEntry(runtimeRoot)).rejects.toMatchObject({
      code: "POSTGRES_RUNTIME_PACKAGE_UNSAFE",
    });
  });

  it("rejects a native package resolved outside the installed runtime", () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-native-package-escape-"));
    tempDirs.push(root);
    const runtimeRoot = path.join(root, "runtime");
    const embedded = path.join(runtimeRoot, "node_modules", "embedded-postgres", "dist", "index.js");
    const outside = path.join(root, "outside-native");
    fs.mkdirSync(path.dirname(embedded), { recursive: true });
    fs.mkdirSync(path.join(outside, "dist"), { recursive: true });
    fs.writeFileSync(embedded, "");
    fs.writeFileSync(path.join(outside, "package.json"), JSON.stringify({ name: "@embedded-postgres/darwin-arm64", exports: "./dist/index.js" }));
    fs.writeFileSync(path.join(outside, "dist", "index.js"), "");
    const link = path.join(runtimeRoot, "node_modules", "@embedded-postgres", "darwin-arm64");
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
    expect(resolveEmbeddedPostgresNativePackageRoot(embedded, "darwin-arm64", runtimeRoot)).toBeNull();
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

  it.runIf(process.platform === "darwin")("creates only matching macOS major-soname aliases without touching other files", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-postgres-libs-"));
    const native = path.join(root, "native");
    const dir = path.join(native, "lib");
    fs.mkdirSync(dir, { recursive: true });
    tempDirs.push(root);
    fs.writeFileSync(path.join(dir, "libicudata.77.1.dylib"), "synthetic-ICU");
    fs.writeFileSync(path.join(dir, "libicuuc.77.1.dylib"), "synthetic-UC");
    fs.writeFileSync(path.join(dir, "libz.1.3.1.dylib"), "synthetic-zlib");
    fs.writeFileSync(path.join(dir, "libzstd.1.5.7.dylib"), "synthetic-zstd");
    fs.writeFileSync(path.join(dir, "libssl.3.dylib"), "unmodified");
    fs.writeFileSync(path.join(native, "pg-symlinks.json"), JSON.stringify([
      { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/libicudata.77.dylib" },
      { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/libicudata.dylib" },
      { source: "native/lib/libicuuc.77.1.dylib", target: "native/lib/libicuuc.77.dylib" },
      { source: "native/lib/libicuuc.77.1.dylib", target: "native/lib/libicuuc.dylib" },
      { source: "native/lib/libz.1.3.1.dylib", target: "native/lib/libz.1.dylib" },
      { source: "native/lib/libz.1.3.1.dylib", target: "native/lib/libz.dylib" },
      { source: "native/lib/libzstd.1.5.7.dylib", target: "native/lib/libzstd.1.dylib" },
    ]));
    const created = await ensureDarwinSharedLibraryAliases(dir);
    expect(created.map(value => path.basename(value)).sort()).toEqual([
      "libicudata.77.dylib", "libicudata.dylib",
      "libicuuc.77.dylib", "libicuuc.dylib",
      "libz.1.dylib", "libz.dylib", "libzstd.1.dylib",
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

  it.runIf(process.platform === "darwin")("preserves an existing alias file rather than overwriting dependency content", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-existing-alias-"));
    const native = path.join(root, "native");
    const dir = path.join(native, "lib");
    fs.mkdirSync(dir, { recursive: true });
    tempDirs.push(root);
    fs.writeFileSync(path.join(dir, "libicudata.77.1.dylib"), "versioned");
    fs.writeFileSync(path.join(dir, "libicudata.77.dylib"), "existing");
    fs.writeFileSync(path.join(native, "pg-symlinks.json"), JSON.stringify([
      { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/libicudata.77.dylib" },
      { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/libicudata.dylib" },
    ]));
    await expect(ensureDarwinSharedLibraryAliases(dir)).rejects.toMatchObject({
      code: "POSTGRES_DARWIN_ALIAS_DESTINATION_OCCUPIED",
    });
    expect(fs.readFileSync(path.join(dir, "libicudata.77.dylib"), "utf8")).toBe("existing");
    expect(fs.existsSync(path.join(dir, "libicudata.dylib"))).toBe(false);
  });

  it.runIf(process.platform === "darwin")("rejects a native alias manifest that escapes its package lib directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-alias-traversal-"));
    const native = path.join(root, "native");
    const dir = path.join(native, "lib");
    fs.mkdirSync(dir, { recursive: true });
    tempDirs.push(root);
    fs.writeFileSync(path.join(native, "pg-symlinks.json"), JSON.stringify([
      { source: "native/lib/libicuuc.77.1.dylib", target: "native/lib/../../../outside.dylib" },
    ]));
    await expect(ensureDarwinSharedLibraryAliases(dir)).rejects.toThrow(/manifest path is invalid/);
    expect(fs.existsSync(path.join(root, "outside.dylib"))).toBe(false);
  });

  it("keeps the child process API untouched while preparing the runtime", async () => {
    const originalSpawn = childProcess.spawn;

    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-embedded-pg-runtime-"));
    tempDirs.push(root);
    await prepareEmbeddedPostgresNativeRuntime(root);

    expect(childProcess.spawn).toBe(originalSpawn);
  });

  it("stages only required Windows extension assets into a short immutable runtime path", async () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-windows-pg-extensions-"));
    tempDirs.push(root);
    const nativeRoot = path.join(root, "native-package");
    const extensionSource = path.join(nativeRoot, "native/share/extension");
    const librarySource = path.join(nativeRoot, "native/lib");
    fs.mkdirSync(extensionSource, { recursive: true });
    fs.mkdirSync(librarySource, { recursive: true });
    fs.writeFileSync(path.join(nativeRoot, "package.json"), JSON.stringify({ version: "18.1.0-beta.16" }));
    for (const extension of ["fuzzystrmatch", "pg_trgm"]) {
      fs.writeFileSync(path.join(extensionSource, `${extension}.control`), `${extension}-control`);
      fs.writeFileSync(path.join(extensionSource, `${extension}--1.0.sql`), `${extension}-sql`);
      fs.writeFileSync(path.join(librarySource, `${extension}.dll`), `${extension}-dll`);
    }
    fs.writeFileSync(path.join(extensionSource, "unrelated.control"), "leave out");

    const dataDirectory = path.join(root, "data");
    const flags = await prepareWindowsPostgresExtensionRuntime(nativeRoot, dataDirectory);
    const runtimeRoot = path.join(root, "bostan-postgres-runtime-18.1.0-beta.16");
    const extensionDirectory = path.join(runtimeRoot, "extension");
    const libraryDirectory = path.join(runtimeRoot, "lib");
    expect(flags).toEqual([
      "-c", "shared_buffers=32MB",
      "-c", `extension_control_path=${runtimeRoot};$system`,
      "-c", `dynamic_library_path=${libraryDirectory};$libdir`,
    ]);
    expect(fs.readdirSync(extensionDirectory).sort()).toEqual([
      "fuzzystrmatch--1.0.sql", "fuzzystrmatch.control",
      "pg_trgm--1.0.sql", "pg_trgm.control",
    ]);
    expect(fs.readdirSync(libraryDirectory).sort()).toEqual(["fuzzystrmatch.dll", "pg_trgm.dll"]);
    expect(fs.readdirSync(dataDirectory)).toEqual([]);
    expect(await prepareWindowsPostgresExtensionRuntime(nativeRoot, dataDirectory)).toEqual(flags);

    fs.writeFileSync(path.join(extensionDirectory, "fuzzystrmatch--1.0.sql"), "tampered");
    await expect(prepareWindowsPostgresExtensionRuntime(nativeRoot, dataDirectory))
      .rejects.toThrow(/does not match the packaged files/);
  });

  it("uses the dependency-scoped portable locale patch", () => {
    const source = fs.readFileSync(require.resolve("embedded-postgres"), "utf8");

    expect(source).toContain("const LC_MESSAGES_LOCALE = 'C';");
    expect(source).toContain("globalThis.process.env");
  });
});
