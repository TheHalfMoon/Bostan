import type { connectionGrants, toolConnections } from "@bostan/db";
import type { ToolCredentialSecretRef } from "@bostan/shared";
import type { PaperclipCloudConnector } from "../../paperclip-cloud-connector.js";
import type { ActorInfo } from "../types.js";
import { managedConnectorProfile, managedConnectorSubject } from "./client-settings.js";
import { oauthConfig } from "./metadata.js";

export type ManagedGrantRelease = "broker_grant_released" | "failed" | "local_only_shared_client";

type Dependencies = {
  currentCloudConnector: () => PaperclipCloudConnector | null;
  resolveOAuthGrantSecret: (
    connection: typeof toolConnections.$inferSelect,
    grant: typeof connectionGrants.$inferSelect,
    ref: ToolCredentialSecretRef,
    actor: ActorInfo | undefined,
    accessContext: undefined,
  ) => Promise<{ value: string }>;
};

/**
 * Releases a broker-held Google grant when its connection grant is removed.
 * The Bostan connector broker destroys its encrypted copy of Google's refresh
 * token and deliberately does not call Google's client-wide revocation, which
 * would also disconnect the account's other Workspace profiles. Other managed
 * providers keep their previous local-only removal.
 */
export function createManagedGrantRelease({ currentCloudConnector, resolveOAuthGrantSecret }: Dependencies) {
  return async function releaseManagedGrant(
    connection: typeof toolConnections.$inferSelect,
    grant: typeof connectionGrants.$inferSelect,
    actor: ActorInfo | undefined,
  ): Promise<ManagedGrantRelease> {
    const oauth = oauthConfig(connection);
    const profile = managedConnectorProfile(typeof oauth.connectorProfile === "string" ? oauth.connectorProfile : undefined);
    const subject = managedConnectorSubject(connection, grant);
    const refreshRef = grant.credentialSecretRefs.find((ref) => ref.configPath === "oauth.refresh_token");
    const connector = currentCloudConnector();
    if (!profile || profile.provider !== "google" || !subject || !refreshRef || !connector) return "local_only_shared_client";
    try {
      const refresh = await resolveOAuthGrantSecret(connection, grant, refreshRef, actor, undefined);
      await connector.revoke({ subject, companyId: connection.companyId, profile: profile.id, token: refresh.value });
      return "broker_grant_released";
    } catch {
      // Local removal still proceeds; the audit event records the failure.
      return "failed";
    }
  };
}
