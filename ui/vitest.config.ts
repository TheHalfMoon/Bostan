import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      lexical: path.resolve(import.meta.dirname, "./node_modules/lexical/dist/Lexical.mjs"),
    },
  },
  test: {
    environment: "node",
    css: { include: [/motion-tokens\.css/] },
    setupFiles: ["./vitest.setup.ts"],
    // scripts/*.test.mjs are node:test suites; CI runs them with `node --test`.
    exclude: [...configDefaults.exclude, "scripts/**/*.test.mjs"],
  },
});
