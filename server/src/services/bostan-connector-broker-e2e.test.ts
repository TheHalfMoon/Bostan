import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BROKER_ORIGIN, createTestBroker, INSTANCE_ORIGIN, OPERATOR_TOKEN } from "@bostan/connector-broker/testing";
import {
  completePaperclipCloudConnectorEnrollment,
  paperclipCloudConnectorEnrollmentStatus,
  startPaperclipCloudConnectorEnrollment,
} from "./paperclip-cloud-connector-enrollment.js";
import {
  createPaperclipCloudConnector,
  paperclipCloudConnectorConfigFromEnv,
  PaperclipCloudConnectorError,
} from "./paperclip-cloud-connector.js";

// The instance's real enrollment and connector client against the self-hosted
// Bostan broker (packages/connector-broker), with Google replaced by a fake.
const env: NodeJS.ProcessEnv = {
  BOSTAN_CLOUD_CONNECTOR_ENABLED: "1",
  BOSTAN_CLOUD_CONNECTOR_BASE_URL: BROKER_ORIGIN,
  PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "development",
};
const CALLBACK = `${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/callback`;

describe("Bostan connector broker end to end", () => {
  let root = "";
  let previousHome: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "bostan-connector-broker-"));
    previousHome = process.env.PAPERCLIP_HOME;
    process.env.PAPERCLIP_HOME = root;
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  });

  it("enrolls, authorizes Gmail, claims, refreshes and revokes through the real client", async () => {
    const harness = createTestBroker();
    const request: typeof fetch = async (input, init) =>
      harness.broker.handle(new Request(String(input), init), { remoteAddress: "198.51.100.7" });

    const pending = await startPaperclipCloudConnectorEnrollment({ origin: INSTANCE_ORIGIN, label: "E2E instance", env, request });
    expect(pending.status).toBe("pending");
    const enrollmentId = new URL(pending.verificationUrl!).searchParams.get("id")!;
    const approved = await harness.postForm("/connections/enroll", { id: enrollmentId, operator_token: OPERATOR_TOKEN, decision: "approve" });
    const returned = new URL(approved.headers.get("location")!);
    const enrolled = await completePaperclipCloudConnectorEnrollment({
      enrollmentId: returned.searchParams.get("enrollment_id")!,
      approvalCode: returned.searchParams.get("approval_code")!,
      state: returned.searchParams.get("state")!,
      env,
      request,
    });
    expect(enrolled).toMatchObject({ configured: true, status: "active", origins: [INSTANCE_ORIGIN] });
    expect(paperclipCloudConnectorEnrollmentStatus(env).configured).toBe(true);

    const config = paperclipCloudConnectorConfigFromEnv(env)!;
    expect(config.baseUrl).toBe(BROKER_ORIGIN);
    const connector = createPaperclipCloudConnector({ config, request });
    expect(await connector.getInstanceStatus()).toBe("active");
    expect(await connector.getCapabilities()).toEqual(expect.arrayContaining(["gmail.draft", "workspace.all"]));

    const returnState = "local-oauth-state-0123456789abcdef";
    const session = await connector.startAuthorization({ subject: "user-1", companyId: "company-1", profile: "gmail.draft", returnUri: CALLBACK, returnState });
    const confirmation = new URL(session.authorizationUrl);
    expect(`${confirmation.origin}${confirmation.pathname}`).toBe(`${BROKER_ORIGIN}/connections/confirm`);
    const toGoogle = await harness.postForm("/connections/confirm", { session: confirmation.searchParams.get("session")!, decision: "continue" });
    const authorizationUrl = toGoogle.headers.get("location")!;
    const code = harness.google.approve(authorizationUrl);
    const callback = await harness.call(`/oauth/google/callback?state=${encodeURIComponent(new URL(authorizationUrl).searchParams.get("state")!)}&code=${code}`);
    const back = new URL(callback.headers.get("location")!);
    expect(back.searchParams.get("state")).toBe(returnState);

    const credentials = await connector.claim({
      subject: "user-1", companyId: "company-1", profile: "gmail.draft", claimId: back.searchParams.get("claim_id")!, redemptionId: returnState,
    });
    expect(credentials).toMatchObject({ provider: "google", profile: "gmail.draft", subject: "user-1", companyId: "company-1", instanceId: config.instanceId });
    expect(credentials.accessToken).toMatch(/^google-access-/);
    expect(credentials.refreshToken).toMatch(/^brk_rt_/);

    const refreshed = await connector.refresh({ subject: "user-1", companyId: "company-1", profile: "gmail.draft", refreshToken: credentials.refreshToken! });
    expect(refreshed.accessToken).not.toBe(credentials.accessToken);

    await expect(connector.refresh({ subject: "user-1", companyId: "company-2", profile: "gmail.draft", refreshToken: credentials.refreshToken! }))
      .rejects.toBeInstanceOf(PaperclipCloudConnectorError);

    await connector.revoke({ subject: "user-1", companyId: "company-1", profile: "gmail.draft", token: credentials.refreshToken! });
    expect(harness.google.revoked).toHaveLength(1);
    await expect(connector.refresh({ subject: "user-1", companyId: "company-1", profile: "gmail.draft", refreshToken: credentials.refreshToken! }))
      .rejects.toMatchObject({ code: "REAUTHORIZATION_REQUIRED" });
  });
});
