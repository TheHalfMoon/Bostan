import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// This test pins the subpath surface of `package.json`.
//
// The compiled private Bostan server imports
// `@bostan/adapter-utils/duplex-observability` through the package `exports`
// (resolving `dist/` under the `bostan-compiled` condition, `src/` otherwise).
// An earlier upstream revision denied the subpath with an explicit `null`
// entry, which broke module resolution for the server. The subpath must keep
// falling through to the wildcard entry, the same as every other file.
//
// The package is private while Bostan packaging is locked down, so it carries
// no `publishConfig`; publishing is not part of this contract.

interface PackageManifest {
  private?: boolean;
  exports: Record<string, unknown>;
  publishConfig?: unknown;
}

const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

describe("adapter-utils exports keep the duplex observability subpath resolvable", () => {
  it("does not deny the subpath", () => {
    expect(manifest.exports).not.toHaveProperty("./duplex-observability");
  });

  it("resolves the subpath through the wildcard for compiled and source consumers", () => {
    expect(manifest.exports["./*"]).toEqual({
      "bostan-compiled": "./dist/*.js",
      default: "./src/*.ts",
    });
  });

  it("stays private with no publish configuration under the release lockdown", () => {
    expect(manifest.private).toBe(true);
    expect(manifest.publishConfig).toBeUndefined();
  });
});
