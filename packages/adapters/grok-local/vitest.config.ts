import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // scripts/*.test.mjs are node:test suites; CI runs them with `node --test`.
    exclude: [...configDefaults.exclude, "scripts/**/*.test.mjs"],
  },
});
