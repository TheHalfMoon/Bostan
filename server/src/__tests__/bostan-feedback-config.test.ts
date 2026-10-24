import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";

const keys = [
  "BOSTAN_FEEDBACK_EXPORT_ENABLED",
  "BOSTAN_FEEDBACK_EXPORT_BACKEND_URL",
  "BOSTAN_FEEDBACK_EXPORT_BACKEND_TOKEN",
  "PAPERCLIP_FEEDBACK_EXPORT_BACKEND_URL",
  "PAPERCLIP_FEEDBACK_EXPORT_BACKEND_TOKEN",
  "PAPERCLIP_TELEMETRY_BACKEND_URL",
  "PAPERCLIP_TELEMETRY_BACKEND_TOKEN",
];

afterEach(() => vi.unstubAllEnvs());

describe("Bostan feedback export operator admission", () => {
  it("ignores inherited Paperclip telemetry configuration when not explicitly enabled", () => {
    for (const key of keys) vi.stubEnv(key, "");
    vi.stubEnv("PAPERCLIP_TELEMETRY_BACKEND_URL", "https://telemetry.paperclip.ing");
    vi.stubEnv("PAPERCLIP_FEEDBACK_EXPORT_BACKEND_URL", "https://someone-else.example");
    vi.stubEnv("PAPERCLIP_FEEDBACK_EXPORT_BACKEND_TOKEN", "inherited-token");
    const config = loadConfig();
    expect(config.feedbackExportBackendUrl).toBeUndefined();
    expect(config.feedbackExportBackendToken).toBeUndefined();
  });

  it("does not enable exports with Bostan URL and token alone", () => {
    for (const key of keys) vi.stubEnv(key, "");
    vi.stubEnv("BOSTAN_FEEDBACK_EXPORT_BACKEND_URL", "https://feedback.bostan.example");
    vi.stubEnv("BOSTAN_FEEDBACK_EXPORT_BACKEND_TOKEN", "explicit-token");
    const config = loadConfig();
    expect(config.feedbackExportBackendUrl).toBeUndefined();
    expect(config.feedbackExportBackendToken).toBeUndefined();
  });

  it("accepts Bostan-only fields only with an exact enabled flag", () => {
    for (const key of keys) vi.stubEnv(key, "");
    vi.stubEnv("BOSTAN_FEEDBACK_EXPORT_ENABLED", "1");
    vi.stubEnv("BOSTAN_FEEDBACK_EXPORT_BACKEND_URL", "https://feedback.bostan.example");
    vi.stubEnv("BOSTAN_FEEDBACK_EXPORT_BACKEND_TOKEN", "explicit-token");
    vi.stubEnv("PAPERCLIP_TELEMETRY_BACKEND_URL", "https://telemetry.paperclip.ing");
    const config = loadConfig();
    expect(config.feedbackExportBackendUrl).toBe("https://feedback.bostan.example");
    expect(config.feedbackExportBackendToken).toBe("explicit-token");
  });
});
