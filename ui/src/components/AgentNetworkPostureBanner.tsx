import { useState } from "react";
import type { AgentDetail } from "@bostan/shared";
import { InlineBanner } from "./InlineBanner";
import { Button } from "@/components/ui/button";

export const NETWORK_POSTURE_ACKNOWLEDGEMENT_KEY = "networkPostureAcknowledgement";

/**
 * Shows how this agent's network access is governed on the server host and,
 * when it is unrestricted, asks the operator to acknowledge the specific
 * reason (docs/bostan/B2_07_AGENT_NETWORK_POSTURE.md, part b). The
 * acknowledgement is saved in agent metadata through the audited agent update.
 */
export function AgentNetworkPostureBanner({
  agent,
  onAcknowledge,
}: {
  agent: Pick<AgentDetail, "networkPosture" | "metadata">;
  onAcknowledge: (patch: { metadata: Record<string, unknown> }) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posture = agent.networkPosture;
  if (!posture || posture.mode === "not_applicable") return null;

  if (posture.mode === "enforced") {
    return (
      <div data-agent-network-posture="enforced">
        <InlineBanner tone="info" compact title="Network access is restricted">
          This agent&apos;s {posture.description}.
        </InlineBanner>
      </div>
    );
  }

  if (posture.acknowledged) {
    return (
      <div data-agent-network-posture="acknowledged">
        <InlineBanner tone="info" compact title="Network access is unrestricted (acknowledged)">
          This agent&apos;s {posture.description}.
        </InlineBanner>
      </div>
    );
  }

  const canAcknowledge = posture.reason !== "invalid_settings";
  const acknowledge = async () => {
    setSaving(true);
    setError(null);
    try {
      await onAcknowledge({
        metadata: {
          ...(agent.metadata ?? {}),
          [NETWORK_POSTURE_ACKNOWLEDGEMENT_KEY]: { reason: posture.reason, acknowledgedAt: new Date().toISOString() },
        },
      });
    } catch {
      setError("Could not save the acknowledgement. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-agent-network-posture="unrestricted">
      <InlineBanner
        tone="warning"
        title="This agent can reach any network host"
        actions={canAcknowledge ? (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void acknowledge()}>
            {saving ? "Saving…" : "I understand"}
          </Button>
        ) : undefined}
      >
        <p>This agent&apos;s {posture.description}.</p>
        <p>
          Its tools and commands can contact any address. Restrict it with a network allowlist where the host supports it,
          or acknowledge to keep running as is.
        </p>
        {error ? <p role="alert">{error}</p> : null}
      </InlineBanner>
    </div>
  );
}
