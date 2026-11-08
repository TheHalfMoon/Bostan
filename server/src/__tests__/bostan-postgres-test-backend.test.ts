import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBostanFeedbackPostgresTestSupport,
  isBostanSystemPostgresTestMode,
} from "./helpers/bostan-postgres-test-backend.js";

afterEach(() => vi.unstubAllEnvs());

describe("Bostan isolated PostgreSQL admission", () => {
  it("does not enable local system postgres merely because it is installed", () => {
    expect(isBostanSystemPostgresTestMode({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isBostanSystemPostgresTestMode({ BOSTAN_TEST_POSTGRES_BACKEND: "1" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isBostanSystemPostgresTestMode({ BOSTAN_TEST_POSTGRES_BACKEND: "system" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("refuses opt-in with a missing binary path without starting a database", async () => {
    vi.stubEnv("BOSTAN_TEST_POSTGRES_BACKEND", "system");
    vi.stubEnv("BOSTAN_TEST_POSTGRES_BIN_DIR", "/nonexistent/bostan-test-pg-bin");
    await expect(getBostanFeedbackPostgresTestSupport()).resolves.toMatchObject({
      supported: false,
      reason: expect.stringContaining("binaries unavailable"),
    });
  });

  it("requires an absolute executable directory in explicit system mode", async () => {
    vi.stubEnv("BOSTAN_TEST_POSTGRES_BACKEND", "system");
    vi.stubEnv("BOSTAN_TEST_POSTGRES_BIN_DIR", "relative/pg-bin");
    await expect(getBostanFeedbackPostgresTestSupport()).resolves.toMatchObject({
      supported: false,
      reason: expect.stringContaining("must be absolute"),
    });
  });
});
