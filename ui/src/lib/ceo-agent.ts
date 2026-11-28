import type { Agent } from "@bostan/shared";

/**
 * The company's CEO agent: the first non-terminated agent with the `ceo`
 * role. Returns null when the company has none, so CEO surfaces stay hidden
 * instead of inventing one.
 */
export function findCeoAgent(agents: readonly Agent[] | null | undefined): Agent | null {
  if (!agents) return null;
  return agents.find((agent) => agent.role === "ceo" && agent.status !== "terminated") ?? null;
}
