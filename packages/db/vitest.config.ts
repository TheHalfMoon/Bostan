import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Matches server/vitest.config.ts: cleanup hooks stop an embedded
    // PostgreSQL cluster. On native Windows a graceful pg_ctl stop plus the
    // owned-process proof measured 12.6 s, past Vitest's 10 s default.
    hookTimeout: 30_000,
  },
});
