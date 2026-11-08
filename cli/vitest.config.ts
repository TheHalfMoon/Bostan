import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

// src/__tests__/*.test.mjs suites written for node:test have no vitest suite;
// CI runs them with `node --test` instead (see .github/workflows/bostan-ci.yml).
const testsDir = fileURLToPath(new URL("./src/__tests__/", import.meta.url));
const nodeTestFiles = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => /from\s+["']node:test["']/.test(readFileSync(testsDir + name, "utf8")))
  .map((name) => `src/__tests__/${name}`);

export default defineConfig({
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, ...nodeTestFiles],
  },
});
