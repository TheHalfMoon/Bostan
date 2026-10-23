import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTelemetryConfig } from "./config.js";

const CI_VARS = ["CI", "CONTINUOUS_INTEGRATION", "BUILD_NUMBER", "GITHUB_ACTIONS", "GITLAB_CI"];

function isolateEnvironment() {
  for (const key of [...CI_VARS, "DO_NOT_TRACK", "PAPERCLIP_TELEMETRY_DISABLED", "BOSTAN_TELEMETRY_OPT_IN", "BOSTAN_TELEMETRY_ENDPOINT", "PAPERCLIP_TELEMETRY_ENDPOINT"]) {
    vi.stubEnv(key, "");
  }
}

describe("Bostan telemetry privacy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("starts disabled without configuration and ignores an inherited enabled=true", () => {
    isolateEnvironment();
    vi.stubEnv("PAPERCLIP_TELEMETRY_ENDPOINT", "https://old.example.invalid/ingest");
    expect(resolveTelemetryConfig().enabled).toBe(false);
    expect(resolveTelemetryConfig({ enabled: true }).enabled).toBe(false);
    expect(resolveTelemetryConfig({ enabled: false }).enabled).toBe(false);
  });

  it("requires explicit Bostan opt-in, file consent and approved destination together", () => {
    isolateEnvironment();
    vi.stubEnv("BOSTAN_TELEMETRY_OPT_IN", "1");
    expect(resolveTelemetryConfig({ enabled: true }).enabled).toBe(false);
    vi.stubEnv("BOSTAN_TELEMETRY_ENDPOINT", "https://telemetry.example.invalid/ingest");
    expect(resolveTelemetryConfig().enabled).toBe(false);
    expect(resolveTelemetryConfig({ enabled: false }).enabled).toBe(false);
    const consented = resolveTelemetryConfig({ enabled: true });
    expect(consented).toMatchObject({ enabled: true, endpoint: "https://telemetry.example.invalid/ingest" });
  });

  it("rejects credentials, unsafe protocols, invalid URLs and nonlocal cleartext destinations", () => {
    isolateEnvironment();
    vi.stubEnv("BOSTAN_TELEMETRY_OPT_IN", "1");
    for (const endpoint of ["http://example.com", "ftp://example.com", "https://name:password@example.com", "not a URL"]) {
      vi.stubEnv("BOSTAN_TELEMETRY_ENDPOINT", endpoint);
      expect(resolveTelemetryConfig({ enabled: true }).enabled).toBe(false);
    }
    vi.stubEnv("BOSTAN_TELEMETRY_ENDPOINT", "http://localhost:3211/test");
    expect(resolveTelemetryConfig({ enabled: true }).enabled).toBe(true);
  });

  it("honors DO_NOT_TRACK, inherited explicit opt-out and CI even with Bostan consent", () => {
    isolateEnvironment();
    vi.stubEnv("BOSTAN_TELEMETRY_OPT_IN", "1");
    vi.stubEnv("BOSTAN_TELEMETRY_ENDPOINT", "https://telemetry.example.invalid/ingest");
    for (const [key, value] of [["DO_NOT_TRACK", "1"], ["PAPERCLIP_TELEMETRY_DISABLED", "1"], ["CI", "true"]]) {
      vi.stubEnv(key, value);
      expect(resolveTelemetryConfig({ enabled: true }).enabled).toBe(false);
      vi.stubEnv(key, "");
    }
  });
});
