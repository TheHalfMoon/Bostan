import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  completePaperclipCloudConnectorEnrollment as completeEnrollment,
  loadPaperclipCloudConnectorIdentity,
  paperclipCloudConnectorEnrollmentStatus as enrollmentStatus,
  paperclipCloudConnectorIdentityPath,
  startPaperclipCloudConnectorEnrollment as startEnrollment,
} from "./paperclip-cloud-connector-enrollment.js";
import { paperclipCloudConnectorConfigFromEnv as readConnectorConfig } from "./paperclip-cloud-connector.js";
import { reconcilePaperclipCloudConnectorEnrollmentStatus as reconcileEnrollmentStatus } from "./paperclip-cloud-connector-status.js";

// Source integration tests use a synthetic *authorized Bostan* broker.
// The imported default broker is deliberately never admitted in production.
const withBostanBroker = (env: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
  const base = env.PAPERCLIP_CLOUD_CONNECTOR_BASE_URL ?? "https://my.example.test";
  const environment = base === "https://primary.bostan.example" ? "production"
    : base === "https://staging.bostan.example" ? "staging"
    : base === "https://qa.bostan.example" ? "test" : "development";
  return {
    BOSTAN_CLOUD_CONNECTOR_ENABLED: "1",
    BOSTAN_CLOUD_CONNECTOR_BASE_URL: base,
    PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: environment,
    ...env,
  };
};
const startPaperclipCloudConnectorEnrollment: typeof startEnrollment = (input) =>
  startEnrollment({ ...input, env: withBostanBroker(input.env) });
const completePaperclipCloudConnectorEnrollment: typeof completeEnrollment = (input) =>
  completeEnrollment({ ...input, env: withBostanBroker(input.env) });
const paperclipCloudConnectorEnrollmentStatus: typeof enrollmentStatus = (env) =>
  enrollmentStatus(withBostanBroker(env));
const paperclipCloudConnectorConfigFromEnv: typeof readConnectorConfig = (env) =>
  readConnectorConfig(withBostanBroker(env));
const reconcilePaperclipCloudConnectorEnrollmentStatus: typeof reconcileEnrollmentStatus = (env, request) =>
  reconcileEnrollmentStatus(withBostanBroker(env), request);


describe("Bostan Cloud self-host enrollment", () => {
  let root = "";
  let previousHome: string | undefined;
  let previousInstance: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "paperclip-cloud-connector-"));
    previousHome = process.env.PAPERCLIP_HOME;
    previousInstance = process.env.PAPERCLIP_INSTANCE_ID;
    process.env.PAPERCLIP_HOME = root;
    process.env.PAPERCLIP_INSTANCE_ID = "connector-test";
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = previousHome;
    if (previousInstance === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
    else process.env.PAPERCLIP_INSTANCE_ID = previousInstance;
    rmSync(root, { recursive: true, force: true });
  });

  it("keeps private keys owner-only and activates only the matching one-time callback", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      const url = String(input);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({ url, body });
      if (url.endsWith("/v1/connector/enrollments")) {
        return Response.json({
          enrollmentId: "enroll-test",
          verificationUrl: "https://my.example.test/connections/enroll?id=enroll-test",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }, { status: 201 });
      }
      const token = String(body.request);
      const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
      expect(claims).toMatchObject({
        iss: loadPaperclipCloudConnectorIdentity()?.instanceId,
        aud: "https://my.example.test/v1/connector/enrollment-claims",
        env: "development",
        op: "enroll",
      });
      expect(typeof claims.ah).toBe("string");
      return Response.json({
        id: loadPaperclipCloudConnectorIdentity()?.instanceId,
        environment: "development",
        origins: ["https://private.example.test"],
      });
    });

    const pending = await startPaperclipCloudConnectorEnrollment({
      origin: "https://private.example.test",
      env: {
        PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://my.example.test",
        PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "development",
      },
      request: request as typeof fetch,
    });
    expect(pending.status).toBe("pending");
    expect(pending.verificationUrl).toBe("https://my.example.test/connections/enroll?id=enroll-test");
    expect(statSync(path.dirname(paperclipCloudConnectorIdentityPath())).mode & 0o777).toBe(0o700);
    expect(statSync(paperclipCloudConnectorIdentityPath()).mode & 0o777).toBe(0o600);
    expect(readFileSync(paperclipCloudConnectorIdentityPath(), "utf8")).not.toContain("approval-code");

    await expect(completePaperclipCloudConnectorEnrollment({
      enrollmentId: "enroll-test",
      approvalCode: "approval-code",
      state: "wrong-state",
      request: request as typeof fetch,
    })).rejects.toThrow(/Invalid or expired/);

    const state = loadPaperclipCloudConnectorIdentity()?.pending?.returnState;
    const active = await completePaperclipCloudConnectorEnrollment({
      enrollmentId: "enroll-test",
      approvalCode: "approval-code",
      state: state!,
      request: request as typeof fetch,
    });
    expect(active).toMatchObject({ configured: true, status: "active", origins: ["https://private.example.test"] });
    const config = paperclipCloudConnectorConfigFromEnv({});
    expect(config).toMatchObject({ baseUrl: "https://my.example.test", environment: "development" });
    expect(requests).toHaveLength(2);

    const statusRequest = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://my.example.test/v1/connector/instance-status");
      return Response.json({ active: false, status: "suspended" });
    });
    await expect(reconcilePaperclipCloudConnectorEnrollmentStatus({}, statusRequest as typeof fetch)).resolves.toMatchObject({
      configured: false,
      status: "suspended",
      instanceId: active.instanceId,
    });
  });

  it("rejects non-loopback plain HTTP destinations before creating keys", async () => {
    await expect(startPaperclipCloudConnectorEnrollment({
      origin: "http://private.example.test",
      request: vi.fn() as typeof fetch,
    })).rejects.toThrow(/requires HTTPS/);
    expect(paperclipCloudConnectorEnrollmentStatus().status).toBe("not_configured");
  });

  it.each([
    "https://my.example.test/connections/enroll?id=another-enrollment",
    "https://my.example.test/connections/enroll",
    "https://my.example.test/connections/enroll?id=enroll-test&next=%2Faccount",
    "https://my.example.test/connections/enroll?id=enroll-test#fragment",
    "https://user@my.example.test/connections/enroll?id=enroll-test",
  ])("rejects an imprecise broker verification destination: %s", async (verificationUrl) => {
    await expect(startPaperclipCloudConnectorEnrollment({
      origin: "https://private.example.test",
      env: {
        PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://my.example.test",
        PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "development",
      },
      request: vi.fn(async () => Response.json({
        enrollmentId: "enroll-test",
        verificationUrl,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }, { status: 201 })) as typeof fetch,
    })).rejects.toThrow(/invalid enrollment destination/);
  });

  it("serializes overlapping starts and reuses one unexpired enrollment", async () => {
    let releaseBroker!: () => void;
    const brokerMayRespond = new Promise<void>((resolve) => {
      releaseBroker = resolve;
    });
    const request = vi.fn(async () => {
      await brokerMayRespond;
      return Response.json({
        enrollmentId: "enroll-shared",
        verificationUrl: "https://my.example.test/connections/enroll?id=enroll-shared",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }, { status: 201 });
    });
    const values = {
      origin: "https://private.example.test",
      companyId: "company-test",
      initiatedBy: "user:admin-test",
      env: {
        PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://my.example.test",
        PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "development",
      },
      request: request as typeof fetch,
    };

    const first = startPaperclipCloudConnectorEnrollment(values);
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    const second = startPaperclipCloudConnectorEnrollment(values);
    releaseBroker();

    const [firstStatus, secondStatus] = await Promise.all([first, second]);
    expect(request).toHaveBeenCalledOnce();
    expect(firstStatus).toMatchObject({ status: "pending", verificationUrl: expect.stringContaining("enroll-shared") });
    expect(secondStatus).toEqual(firstStatus);
    expect(loadPaperclipCloudConnectorIdentity()?.pending).toMatchObject({
      enrollmentId: "enroll-shared",
      companyId: "company-test",
      initiatedBy: "user:admin-test",
    });
    await expect(startPaperclipCloudConnectorEnrollment({
      ...values,
      initiatedBy: "user:another-admin",
    })).rejects.toThrow(/another administrator/);
    await expect(startPaperclipCloudConnectorEnrollment({
      ...values,
      companyId: "another-company",
    })).rejects.toThrow(/another company/);
    expect(request).toHaveBeenCalledOnce();
  });

  it("defaults the explicitly configured Bostan test broker to development", () => {
    expect(paperclipCloudConnectorEnrollmentStatus({})).toMatchObject({
      brokerBaseUrl: "https://my.example.test",
      environment: "development",
    });
    expect(paperclipCloudConnectorEnrollmentStatus({
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example",
    })).toMatchObject({ environment: "staging" });
    expect(paperclipCloudConnectorEnrollmentStatus({
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://qa.bostan.example",
    })).toMatchObject({ environment: "test" });
  });

  it.each(["development", "staging", "production"])("allows explicit Bostan test broker environment %s", (environment) => {
    expect(paperclipCloudConnectorEnrollmentStatus({
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://qa.bostan.example",
      PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: environment,
    })).toMatchObject({ status: "not_configured", environment });
  });

  it("persists test enrollment identity and signs requests for the test broker", async () => {
    const origin = "https://tenant.qa.bostan.example";
    const request = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (String(input).endsWith("/enrollments")) {
        expect(body).toMatchObject({ environment: "test", origin });
        return Response.json({ enrollmentId: "enroll-test", verificationUrl: "https://qa.bostan.example/connections/enroll?id=enroll-test", expiresAt: new Date(Date.now() + 60_000).toISOString() }, { status: 201 });
      }
      const claims = JSON.parse(Buffer.from(body.request.split(".")[1], "base64url").toString("utf8"));
      expect(claims).toMatchObject({ env: "test", aud: "https://qa.bostan.example/v1/connector/enrollment-claims" });
      return Response.json({ id: loadPaperclipCloudConnectorIdentity()!.instanceId, environment: "test", origins: [origin] });
    });
    const env = { PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://qa.bostan.example" };
    await startPaperclipCloudConnectorEnrollment({ origin, env, request: request as typeof fetch });
    const pending = loadPaperclipCloudConnectorIdentity()!;
    await completePaperclipCloudConnectorEnrollment({ enrollmentId: "enroll-test", approvalCode: "approval-code", state: pending.pending!.returnState, env, request: request as typeof fetch });
    expect(paperclipCloudConnectorConfigFromEnv(env)).toMatchObject({ environment: "test", baseUrl: "https://qa.bostan.example", instanceId: pending.instanceId });
  });

  it("rotates a non-active identity instead of mixing enrollment targets", async () => {
    const origin = "https://private.example.test";
    const productionRequest = vi.fn(async () => Response.json({
      enrollmentId: "enroll-production",
      verificationUrl: "https://primary.bostan.example/connections/enroll?id=enroll-production",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }, { status: 201 }));
    await startPaperclipCloudConnectorEnrollment({
      origin,
      env: { PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://primary.bostan.example" },
      request: productionRequest as typeof fetch,
    });
    const productionIdentity = loadPaperclipCloudConnectorIdentity()!;

    expect(paperclipCloudConnectorEnrollmentStatus({
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example",
    })).toEqual({
      configured: false,
      status: "unverified",
      brokerBaseUrl: "https://staging.bostan.example",
      instanceId: null,
      environment: "staging",
      origins: [],
    });

    const stagingRequest = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://staging.bostan.example/v1/connector/enrollments");
      expect(JSON.parse(String(init?.body))).toMatchObject({ environment: "staging", origin });
      return Response.json({
        enrollmentId: "enroll-staging",
        verificationUrl: "https://staging.bostan.example/connections/enroll?id=enroll-staging",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }, { status: 201 });
    });
    const stagingStatus = await startPaperclipCloudConnectorEnrollment({
      origin,
      env: { PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example" },
      request: stagingRequest as typeof fetch,
    });
    const stagingIdentity = loadPaperclipCloudConnectorIdentity()!;

    expect(stagingStatus).toMatchObject({
      status: "pending",
      brokerBaseUrl: "https://staging.bostan.example",
      environment: "staging",
      verificationUrl: "https://staging.bostan.example/connections/enroll?id=enroll-staging",
    });
    expect(stagingIdentity.instanceId).not.toBe(productionIdentity.instanceId);
    expect(stagingIdentity.signPublicKey).not.toBe(productionIdentity.signPublicKey);
    expect(stagingIdentity.sealPublicKey).not.toBe(productionIdentity.sealPublicKey);
    expect(stagingRequest).toHaveBeenCalledOnce();
  });

  it("fails closed when the configured target changes during callback or after activation", async () => {
    const origin = "https://private.example.test";
    const productionEnv = {
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://primary.bostan.example",
      PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "production",
    };
    const request = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/v1/connector/enrollments")) {
        return Response.json({
          enrollmentId: "enroll-production",
          verificationUrl: "https://primary.bostan.example/connections/enroll?id=enroll-production",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }, { status: 201 });
      }
      return Response.json({
        id: loadPaperclipCloudConnectorIdentity()?.instanceId,
        environment: "production",
        origins: [origin],
      });
    });
    await startPaperclipCloudConnectorEnrollment({ origin, env: productionEnv, request: request as typeof fetch });
    const pending = loadPaperclipCloudConnectorIdentity()!;
    const changedTargetRequest = vi.fn();

    await expect(completePaperclipCloudConnectorEnrollment({
      enrollmentId: "enroll-production",
      approvalCode: "approval-code",
      state: pending.pending!.returnState,
      env: {
        PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example",
        PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "staging",
      },
      request: changedTargetRequest as typeof fetch,
    })).rejects.toThrow(/Invalid or expired/);
    expect(changedTargetRequest).not.toHaveBeenCalled();

    await completePaperclipCloudConnectorEnrollment({
      enrollmentId: "enroll-production",
      approvalCode: "approval-code",
      state: pending.pending!.returnState,
      env: productionEnv,
      request: request as typeof fetch,
    });
    const activeIdentity = loadPaperclipCloudConnectorIdentity()!;
    const activeSwitchRequest = vi.fn();
    const stagingEnv = {
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example",
      PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "staging",
    };

    await expect(startPaperclipCloudConnectorEnrollment({
      origin,
      env: stagingEnv,
      request: activeSwitchRequest as typeof fetch,
    })).rejects.toThrow(/another target/);
    expect(activeSwitchRequest).not.toHaveBeenCalled();
    expect(loadPaperclipCloudConnectorIdentity()).toEqual(activeIdentity);
    expect(paperclipCloudConnectorConfigFromEnv(stagingEnv)).toBeNull();
  });

  it("treats managed environment identity as an atomic override of local identity", async () => {
    const origin = "https://private.example.test";
    const productionEnv = {
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://primary.bostan.example",
      PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "production",
    };
    const request = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/v1/connector/enrollments")) {
        return Response.json({
          enrollmentId: "enroll-production",
          verificationUrl: "https://primary.bostan.example/connections/enroll?id=enroll-production",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }, { status: 201 });
      }
      return Response.json({
        id: loadPaperclipCloudConnectorIdentity()?.instanceId,
        environment: "production",
        origins: [origin],
      });
    });
    await startPaperclipCloudConnectorEnrollment({ origin, env: productionEnv, request: request as typeof fetch });
    const pending = loadPaperclipCloudConnectorIdentity()!;
    await completePaperclipCloudConnectorEnrollment({
      enrollmentId: "enroll-production",
      approvalCode: "approval-code",
      state: pending.pending!.returnState,
      env: productionEnv,
      request: request as typeof fetch,
    });
    const localIdentity = loadPaperclipCloudConnectorIdentity()!;

    const managedEnv = {
      PAPERCLIP_CLOUD_CONNECTOR_INSTANCE_ID: "managed-staging-instance",
      PAPERCLIP_CLOUD_CONNECTOR_SIGN_PRIVATE_KEY: "managed-signing-key",
      PAPERCLIP_CLOUD_CONNECTOR_SEAL_PRIVATE_KEY: "managed-sealing-key",
      PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "staging",
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example",
      PAPERCLIP_PUBLIC_URL: "https://managed-stack.example.test",
    };
    // Imported managed keys are NOT re-used in Bostan, even with an explicit
    // private broker. Re-enroll with separate Bostan-owned key material.
    expect(paperclipCloudConnectorEnrollmentStatus(managedEnv)).toMatchObject({
      configured: false, status: "not_configured", instanceId: null,
    });
    expect(paperclipCloudConnectorConfigFromEnv(managedEnv)).toBeNull();
    expect(loadPaperclipCloudConnectorIdentity()).toEqual(localIdentity);

    for (const omitted of [
      "PAPERCLIP_CLOUD_CONNECTOR_INSTANCE_ID",
      "PAPERCLIP_CLOUD_CONNECTOR_SIGN_PRIVATE_KEY",
      "PAPERCLIP_CLOUD_CONNECTOR_SEAL_PRIVATE_KEY",
      "PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT",
    ] as const) {
      const partialManagedEnv: NodeJS.ProcessEnv = { ...managedEnv };
      delete partialManagedEnv[omitted];
      expect(paperclipCloudConnectorEnrollmentStatus(partialManagedEnv)).toMatchObject({
        configured: false, instanceId: null,
      });
      expect(paperclipCloudConnectorConfigFromEnv(partialManagedEnv)).toBeNull();
      expect(loadPaperclipCloudConnectorIdentity()).toEqual(localIdentity);
    }

    expect(paperclipCloudConnectorConfigFromEnv(productionEnv)).toMatchObject({
      baseUrl: localIdentity.brokerBaseUrl,
      instanceId: localIdentity.instanceId,
      environment: localIdentity.environment,
      signPrivateKey: localIdentity.signPrivateKey,
      sealPrivateKey: localIdentity.sealPrivateKey,
    });
  });

  it("does not admit any inherited managed keys across private Bostan brokers", () => {
    for (const origin of ["https://primary.bostan.example", "https://staging.bostan.example"]) {
      const env = {
        PAPERCLIP_CLOUD_CONNECTOR_INSTANCE_ID: "legacy-managed",
        PAPERCLIP_CLOUD_CONNECTOR_SIGN_PRIVATE_KEY: "legacy-sign",
        PAPERCLIP_CLOUD_CONNECTOR_SEAL_PRIVATE_KEY: "legacy-seal",
        PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: origin,
      };
      expect(paperclipCloudConnectorEnrollmentStatus(env)).toMatchObject({
        configured: false, instanceId: null,
      });
      expect(paperclipCloudConnectorConfigFromEnv(env)).toBeNull();
    }
  });

  it("does not create or complete self-host enrollment with managed identity configuration", async () => {
    const origin = "https://private.example.test";
    const localEnv = {
      PAPERCLIP_CLOUD_CONNECTOR_BASE_URL: "https://staging.bostan.example",
      PAPERCLIP_CLOUD_CONNECTOR_ENVIRONMENT: "staging",
    };
    const enrollmentRequest = vi.fn(async () => Response.json({
      enrollmentId: "enroll-local",
      verificationUrl: "https://staging.bostan.example/connections/enroll?id=enroll-local",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }, { status: 201 }));
    await startPaperclipCloudConnectorEnrollment({
      origin,
      env: localEnv,
      request: enrollmentRequest as typeof fetch,
    });
    const pendingIdentity = loadPaperclipCloudConnectorIdentity()!;
    const managedEnv = {
      ...localEnv,
      PAPERCLIP_CLOUD_CONNECTOR_INSTANCE_ID: "managed-staging-instance",
      PAPERCLIP_CLOUD_CONNECTOR_SIGN_PRIVATE_KEY: "managed-signing-key",
      PAPERCLIP_CLOUD_CONNECTOR_SEAL_PRIVATE_KEY: "managed-sealing-key",
    };
    const managedRequest = vi.fn();

    await expect(startPaperclipCloudConnectorEnrollment({
      origin,
      env: managedEnv,
      request: managedRequest as typeof fetch,
    })).rejects.toThrow(/unavailable with managed identity/);
    await expect(completePaperclipCloudConnectorEnrollment({
      enrollmentId: "enroll-local",
      approvalCode: "approval-code",
      state: pendingIdentity.pending!.returnState,
      env: managedEnv,
      request: managedRequest as typeof fetch,
    })).rejects.toThrow(/Invalid or expired/);
    expect(managedRequest).not.toHaveBeenCalled();
    expect(loadPaperclipCloudConnectorIdentity()).toEqual(pendingIdentity);
  });

  it("does not treat legacy Paperclip ID keys as a Cloud enrollment", () => {
    expect(paperclipCloudConnectorEnrollmentStatus({
      PAPERCLIP_ID_CONNECTOR_INSTANCE_ID: "legacy-instance",
      PAPERCLIP_ID_CONNECTOR_SIGN_PRIVATE_KEY: "legacy-signing-key",
      PAPERCLIP_ID_CONNECTOR_SEAL_PRIVATE_KEY: "legacy-sealing-key",
      PAPERCLIP_ID_CONNECTOR_ENVIRONMENT: "production",
      PAPERCLIP_ID_CONNECTOR_BASE_URL: "https://id.paperclip.app",
    })).toMatchObject({
      configured: false,
      status: "not_configured",
      brokerBaseUrl: "https://my.example.test",
      instanceId: null,
    });
  });
});
