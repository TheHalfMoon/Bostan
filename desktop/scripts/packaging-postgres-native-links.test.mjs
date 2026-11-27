import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareDarwinPostgresNativeLinks, resolveDbEmbeddedPostgresEntry } from "./postgres-native-links.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-native-stage-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = path.join(root, "runtime");
  const db = path.join(runtime, "node_modules", "@bostan", "db");
  const embedded = path.join(db, "node_modules", "embedded-postgres");
  const native = path.join(embedded, "node_modules", "@embedded-postgres", "darwin-arm64");
  const decoyEmbedded = path.join(runtime, "node_modules", "embedded-postgres");
  const decoyNative = path.join(decoyEmbedded, "node_modules", "@embedded-postgres", "darwin-arm64");
  fs.mkdirSync(path.join(runtime, "dist"), { recursive: true });
  fs.writeFileSync(path.join(runtime, "dist", "index.js"), "");
  fs.mkdirSync(path.join(db, "dist"), { recursive: true });
  fs.writeFileSync(path.join(db, "package.json"), JSON.stringify({
    name: "@bostan/db",
    exports: { ".": { "bostan-compiled": "./dist/index.js", default: "./src/index.ts" } },
  }));
  fs.writeFileSync(path.join(db, "dist", "index.js"), "");
  fs.mkdirSync(path.join(embedded, "dist"), { recursive: true });
  fs.writeFileSync(path.join(embedded, "package.json"), JSON.stringify({ exports: "./dist/index.js" }));
  fs.writeFileSync(path.join(embedded, "dist", "index.js"), "");
  fs.mkdirSync(path.join(native, "dist"), { recursive: true });
  fs.writeFileSync(path.join(native, "package.json"), JSON.stringify({ exports: "./dist/index.js" }));
  fs.writeFileSync(path.join(native, "dist", "index.js"), "");
  fs.mkdirSync(path.join(native, "native", "lib"), { recursive: true });
  fs.writeFileSync(path.join(native, "native", "lib", "libicudata.77.1.dylib"), "synthetic ICU data");
  fs.writeFileSync(path.join(native, "native", "pg-symlinks.json"), JSON.stringify([
    { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/libicudata.77.dylib" },
  ]));
  fs.mkdirSync(path.join(decoyEmbedded, "dist"), { recursive: true });
  fs.writeFileSync(path.join(decoyEmbedded, "package.json"), JSON.stringify({ exports: "./dist/index.js" }));
  fs.writeFileSync(path.join(decoyEmbedded, "dist", "index.js"), "");
  fs.mkdirSync(path.join(decoyNative, "dist"), { recursive: true });
  fs.writeFileSync(path.join(decoyNative, "package.json"), JSON.stringify({ exports: "./dist/index.js" }));
  fs.writeFileSync(path.join(decoyNative, "dist", "index.js"), "");
  fs.mkdirSync(path.join(decoyNative, "native", "lib"), { recursive: true });
  fs.writeFileSync(path.join(decoyNative, "native", "lib", "libicudata.77.1.dylib"), "decoy ICU data");
  fs.writeFileSync(path.join(decoyNative, "native", "pg-symlinks.json"), JSON.stringify([
    { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/libicudata.77.dylib" },
  ]));
  return { runtime, db, embedded, native, decoyNative };
}

test("resolves embedded-postgres from the staged DB manifest when its source export is absent", t => {
  const { runtime, embedded } = fixture(t);
  assert.throws(
    () => createRequire(path.join(runtime, "dist", "index.js")).resolve("@bostan/db"),
    error => /src[/\\]index\.ts/.test(error.message),
  );
  const { embeddedEntry } = resolveDbEmbeddedPostgresEntry(runtime);
  assert.equal(embeddedEntry, path.join(embedded, "dist", "index.js"));
  assert.equal(fs.existsSync(path.join(runtime, "node_modules", "@bostan", "db", "src", "index.ts")), false);
});

test("refuses a staged DB package link that resolves outside the runtime", { skip: process.platform === "win32" }, t => {
  const { runtime, db } = fixture(t);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-darwin-native-outside-"));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.rmSync(db, { recursive: true, force: true });
  fs.symlinkSync(external, db, "dir");
  assert.throws(() => resolveDbEmbeddedPostgresEntry(runtime), /escapes the packaged runtime/);
});

test("hydrates the pinned Darwin ICU alias before the staged runtime is packaged", { skip: process.platform === "win32" }, t => {
  const { runtime, native, decoyNative } = fixture(t);
  assert.deepEqual(prepareDarwinPostgresNativeLinks(runtime, "arm64"), ["libicudata.77.dylib"]);
  const alias = path.join(native, "native", "lib", "libicudata.77.dylib");
  assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(alias), "libicudata.77.1.dylib");
  assert.equal(fs.existsSync(path.join(decoyNative, "native", "lib", "libicudata.77.dylib")), false);
  assert.deepEqual(prepareDarwinPostgresNativeLinks(runtime, "arm64"), []);
});

test("does not overwrite a conflicting native alias or follow a manifest path escape", t => {
  const first = fixture(t);
  const alias = path.join(first.native, "native", "lib", "libicudata.77.dylib");
  fs.writeFileSync(alias, "preserve existing content");
  assert.throws(() => prepareDarwinPostgresNativeLinks(first.runtime, "arm64"), /destination is occupied/);
  assert.equal(fs.readFileSync(alias, "utf8"), "preserve existing content");

  const second = fixture(t);
  fs.writeFileSync(path.join(second.native, "native", "pg-symlinks.json"), JSON.stringify([
    { source: "native/lib/libicudata.77.1.dylib", target: "native/lib/../../outside.dylib" },
  ]));
  assert.throws(() => prepareDarwinPostgresNativeLinks(second.runtime, "arm64"), /Invalid Darwin PostgreSQL alias path/);
  assert.equal(fs.existsSync(path.join(second.runtime, "node_modules", "embedded-postgres", "node_modules", "@embedded-postgres", "outside.dylib")), false);
});

test("accepts only supported Darwin package architectures", t => {
  const { runtime } = fixture(t);
  assert.throws(() => prepareDarwinPostgresNativeLinks(runtime, "ia32"), /Unsupported packaged Darwin/);
});
