import { describe, expect, it, vi } from "vitest";
import { bostanCloudBrokerOrigin, requireBostanCloudBrokerOrigin } from "./bostan-cloud-broker-policy.js";
import { paperclipCloudConnectorConfigFromEnv } from "./paperclip-cloud-connector.js";
import {
  paperclipCloudConnectorEnrollmentStatus,
  startPaperclipCloudConnectorEnrollment,
  completePaperclipCloudConnectorEnrollment,
} from "./paperclip-cloud-connector-enrollment.js";

const legacy = {
  PAPERCLIP_CLOUD_CONNECTOR_INSTANCE_ID: "inst_old",
  PAPERCLIP_CLOUD_CONNECTOR_SIGN_PRIVATE_KEY: "legacy-sign-key",
  PAPERCLIP_CLOUD_CONNECTOR_SEAL_PRIVATE_KEY: "legacy-seal-key",
  PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "production",
  PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://my.paperclip.app",
};

const approved = {
  BOSTAN_CLOUD_CONNECTOR_ENABLED: "1",
  BOSTAN_CLOUD_CONNECTOR_BASE_URL: "https://operator.bostan.example",
};

describe("Bostan private cloud connector broker admission", () => {
  it("refuses inherited upstream credentials and endpoints with no Bostan opt-in", async () => {
    const request = vi.fn();
    expect(paperclipCloudConnectorConfigFromEnv(legacy)).toBeNull();
    expect(paperclipCloudConnectorEnrollmentStatus(legacy)).toMatchObject({
      configured: false, status: "not_configured", brokerBaseUrl: "",
    });
    await expect(startPaperclipCloudConnectorEnrollment({
      origin: "https://example.test", env: legacy, request: request as typeof fetch,
    })).rejects.toThrow(/Bostan Cloud broker is disabled/);
    await expect(completePaperclipCloudConnectorEnrollment({
      enrollmentId: "old", approvalCode: "old", state: "old", env: legacy, request: request as typeof fetch,
    })).rejects.toThrow(/Bostan Cloud broker is disabled/);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    "https://my.paperclip.app", "https://test.paperclip.app",
    "https://my-staging.paperclip.app", "https://telemetry.paperclip.ing",
    "https://user:pass@operator.bostan.example", "http://operator.bostan.example",
    "https://operator.bostan.example:8080", "https://operator.bostan.example/?secret=x",
    "https://localhost", "https://127.0.0.1",
  ])("refuses unsafe broker even when explicitly enabled: %s", host => {
    expect(bostanCloudBrokerOrigin({ ...approved, BOSTAN_CLOUD_CONNECTOR_BASE_URL: host })).toBeNull();
  });

  it("requires an exact opt-in and distinct valid HTTPS broker", () => {
    expect(bostanCloudBrokerOrigin({ BOSTAN_CLOUD_CONNECTOR_BASE_URL: approved.BOSTAN_CLOUD_CONNECTOR_BASE_URL })).toBeNull();
    expect(bostanCloudBrokerOrigin(approved)).toBe(approved.BOSTAN_CLOUD_CONNECTOR_BASE_URL);
    expect(requireBostanCloudBrokerOrigin(approved)).toBe(approved.BOSTAN_CLOUD_CONNECTOR_BASE_URL);
  });

  it("does not admit legacy identities just by adding a Bostan broker override", () => {
    expect(paperclipCloudConnectorConfigFromEnv({ ...legacy, ...approved })).toBeNull();
  });
});
