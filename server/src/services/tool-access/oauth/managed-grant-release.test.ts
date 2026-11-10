import { describe, expect, it, vi } from "vitest";
import type { connectionGrants, toolConnections } from "@bostan/db";
import type { PaperclipCloudConnector } from "../../paperclip-cloud-connector.js";
import { createManagedGrantRelease } from "./managed-grant-release.js";

type Connection = typeof toolConnections.$inferSelect;
type Grant = typeof connectionGrants.$inferSelect;

const connection = (profile: string) => ({
  id: "connection-1",
  companyId: "company-1",
  config: { oauth: { strategy: "paperclip_cloud_connector", connectorProfile: profile, connectorSubjectUserId: "owner-1" } },
}) as unknown as Connection;

const grant = (overrides: Partial<Grant> = {}) => ({
  id: "grant-1",
  kind: "user",
  subjectUserId: "user-1",
  subjectAgentId: null,
  credentialSecretRefs: [
    { configPath: "oauth.access_token", secretId: "s-access" },
    { configPath: "oauth.refresh_token", secretId: "s-refresh" },
  ],
  ...overrides,
}) as unknown as Grant;

function setup(connector: Partial<PaperclipCloudConnector> | null = { revoke: vi.fn(async () => {}) }) {
  const resolveOAuthGrantSecret = vi.fn(async () => ({ value: "brk_rt_handle" }));
  const release = createManagedGrantRelease({
    currentCloudConnector: () => connector as PaperclipCloudConnector | null,
    resolveOAuthGrantSecret,
  });
  return { release, connector, resolveOAuthGrantSecret };
}

describe("managed grant release", () => {
  it("asks the broker to destroy a Google grant bound to the grant's subject", async () => {
    const { release, connector } = setup();
    await expect(release(connection("gmail.draft"), grant(), undefined)).resolves.toBe("broker_grant_released");
    expect(connector!.revoke).toHaveBeenCalledWith({ subject: "user-1", companyId: "company-1", profile: "gmail.draft", token: "brk_rt_handle" });
  });

  it("uses the agent subject for agent grants", async () => {
    const { release, connector } = setup();
    await release(connection("drive.read"), grant({ kind: "agent", subjectUserId: null, subjectAgentId: "agent-9" }), undefined);
    expect(connector!.revoke).toHaveBeenCalledWith(expect.objectContaining({ subject: "agent:agent-9", profile: "drive.read" }));
  });

  it("keeps other managed providers local-only", async () => {
    const { release, connector } = setup();
    await expect(release(connection("github.code"), grant(), undefined)).resolves.toBe("local_only_shared_client");
    expect(connector!.revoke).not.toHaveBeenCalled();
  });

  it("stays local-only without a broker or a refresh secret", async () => {
    await expect(setup(null).release(connection("gmail.read"), grant(), undefined)).resolves.toBe("local_only_shared_client");
    const { release, connector } = setup();
    await expect(release(connection("gmail.read"), grant({ credentialSecretRefs: [] }), undefined)).resolves.toBe("local_only_shared_client");
    expect(connector!.revoke).not.toHaveBeenCalled();
  });

  it("reports failure without throwing so local removal still completes", async () => {
    const { release } = setup({ revoke: vi.fn(async () => { throw new Error("broker unavailable"); }) });
    await expect(release(connection("gmail.read"), grant(), undefined)).resolves.toBe("failed");
  });
});
