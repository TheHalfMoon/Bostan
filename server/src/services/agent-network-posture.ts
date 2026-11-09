import { CLAUDE_DEFAULT_NETWORK_HOSTS } from "@bostan/adapter-claude-local/server";
import { CODEX_DEFAULT_NETWORK_HOSTS } from "@bostan/adapter-codex-local/server";
import {
  describeAgentNetworkPosture,
  localProcessNetworkSandboxAvailable,
  resolveAgentNetworkPosture,
  type AgentNetworkPosture,
} from "@bostan/adapter-utils/local-process-sandbox";

/**
 * The network posture shown for an agent in its settings
 * (docs/bostan/B2_07_AGENT_NETWORK_POSTURE.md, part b). It mirrors what the
 * adapter applies at run time on this host, so the owner sees, and must
 * acknowledge, an agent whose network access is not restricted.
 */
export type AgentNetworkPostureView =
  | { mode: "not_applicable" }
  | ({ description: string; acknowledged: boolean } & (
    | Extract<AgentNetworkPosture, { mode: "enforced" }>
    | { mode: "unrestricted"; reason: Extract<AgentNetworkPosture, { mode: "unrestricted" }>["reason"] | "adapter_unsupported" | "invalid_settings" }
  ));

export const NETWORK_POSTURE_ACKNOWLEDGEMENT_KEY = "networkPostureAcknowledgement";

const SANDBOXED_ADAPTER_HOSTS: Record<string, readonly string[]> = {
  claude_local: CLAUDE_DEFAULT_NETWORK_HOSTS,
  codex_local: CODEX_DEFAULT_NETWORK_HOSTS,
};

function acknowledgedReason(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ack = (metadata as Record<string, unknown>)[NETWORK_POSTURE_ACKNOWLEDGEMENT_KEY];
  if (!ack || typeof ack !== "object") return null;
  const reason = (ack as Record<string, unknown>).reason;
  return typeof reason === "string" ? reason : null;
}

export function agentNetworkPostureView(
  agent: { adapterType: string; adapterConfig: unknown; metadata?: unknown },
  options: { platform?: NodeJS.Platform; sandboxAvailable?: (command: string) => boolean } = {},
): AgentNetworkPostureView {
  if (!agent.adapterType.endsWith("_local")) return { mode: "not_applicable" };
  const config = agent.adapterConfig && typeof agent.adapterConfig === "object"
    ? agent.adapterConfig as Record<string, unknown>
    : {};
  const ackReason = acknowledgedReason(agent.metadata);
  const providerHosts = SANDBOXED_ADAPTER_HOSTS[agent.adapterType];
  if (!providerHosts) {
    return {
      mode: "unrestricted",
      reason: "adapter_unsupported",
      description: "network access is UNRESTRICTED (this adapter has no network controls)",
      acknowledged: ackReason === "adapter_unsupported",
    };
  }
  let posture: AgentNetworkPosture;
  try {
    const command = typeof config.filesystemSandboxCommand === "string" && config.filesystemSandboxCommand.trim()
      ? config.filesystemSandboxCommand.trim()
      : "bwrap";
    posture = resolveAgentNetworkPosture({
      networkScope: config.networkScope,
      networkAllowlist: config.networkAllowlist,
      providerHosts,
      platform: options.platform,
      sandboxAvailable: () => (options.sandboxAvailable ?? localProcessNetworkSandboxAvailable)(command),
    });
  } catch {
    // An invalid saved scope fails the run closed; show it as not enforced here.
    return {
      mode: "unrestricted",
      reason: "invalid_settings",
      description: "network settings are invalid; runs will refuse to start until they are fixed",
      acknowledged: false,
    };
  }
  return {
    ...posture,
    description: describeAgentNetworkPosture(posture),
    acknowledged: posture.mode === "enforced" || ackReason === posture.reason,
  };
}
