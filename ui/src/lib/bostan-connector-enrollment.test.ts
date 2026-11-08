import { describe, expect, it } from "vitest";
import type { CloudConnectorEnrollmentStatus } from "@/api/tools";
import { bostanConnectorEnrollmentUrl, hasBostanConnectorBroker } from "./bostan-connector-enrollment";

const broker = "https://broker.bostan.example";
const pending: CloudConnectorEnrollmentStatus = {
  configured: false, status: "pending", brokerBaseUrl: broker,
  instanceId: "fixture", environment: "development", origins: [],
  verificationUrl: broker + "/connections/enroll?id=token_123",
};

describe("Bostan B6-02 local connector enrollment boundary", () => {
  it("hides enrollment when no explicit broker has been selected", () => {
    expect(hasBostanConnectorBroker(undefined)).toBe(false);
    expect(hasBostanConnectorBroker({ ...pending, status: "not_configured", brokerBaseUrl: "" })).toBe(false);
  });

  it("accepts only a configured non-upstream HTTPS origin and its enrollment path", () => {
    expect(hasBostanConnectorBroker(pending)).toBe(true);
    expect(bostanConnectorEnrollmentUrl(pending)).toBe(broker + "/connections/enroll?id=token_123");
    expect(bostanConnectorEnrollmentUrl({ ...pending, status: "active" })).toBeNull();
    expect(bostanConnectorEnrollmentUrl({ ...pending, verificationUrl: undefined })).toBeNull();
  });

  it.each([
    "https://my.paperclip.app/",
    "https://paperclip.ing/",
    "https://other.paperclip.app/",
    "http://broker.bostan.example/",
    "https://127.0.0.1/",
    "https://localhost/",
    "https://broker.bostan.example/other",
    "https://user:pass@broker.bostan.example/",
    "https://broker.bostan.example/?tracking=1",
    "https://broker.bostan.example:8080/",
    "javascript:alert(1)",
    "",
  ])("rejects invalid/unapproved broker configuration: %s", (value) => {
    expect(hasBostanConnectorBroker({ ...pending, brokerBaseUrl: value })).toBe(false);
    expect(bostanConnectorEnrollmentUrl({ ...pending, brokerBaseUrl: value })).toBeNull();
  });

  it.each([
    "https://evil.example/connections/enroll?id=token_123",
    "//evil.example/connections/enroll?id=token_123",
    "javascript:alert(1)",
    "https://broker.bostan.example@evil.example/connections/enroll?id=token_123",
    "https://broker.bostan.example/connections/enroll?id=ok#fragment",
    "https://broker.bostan.example/connections/enroll?id=ok&next=https://evil.example",
    "https://broker.bostan.example/connections/enroll?id=ok&id=other",
    "https://broker.bostan.example/connections/not-enroll?id=ok",
    "https://broker.bostan.example/connections/enroll?id=",
    "https://broker.bostan.example/connections/enroll?id=has%20space",
    "http://broker.bostan.example/connections/enroll?id=token_123",
  ])("blocks a forged redirect: %s", (value) => {
    expect(bostanConnectorEnrollmentUrl({ ...pending, verificationUrl: value })).toBeNull();
  });
});
