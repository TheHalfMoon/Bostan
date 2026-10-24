/**
 * Connecting an AI provider is optional on first run, but hiring the agent is
 * not. A deferred setup must stay on the server's paused setup lifecycle.
 */
export function canDeferModelConnection(input: {
  companyId: string | null;
  setupAgentId: string | null;
  setupPrepared: boolean;
  createdAgentId: string | null;
  loading: boolean;
  hireInFlight: boolean;
}): boolean {
  return Boolean(input.companyId && input.setupAgentId && input.setupPrepared
    && !input.createdAgentId && !input.loading && !input.hireInFlight);
}

export function isPersistedDeferredAgent(input: {
  id: string;
  companyId: string;
  lifecycleState?: string;
  pauseReason?: string | null;
} | undefined, companyId: string, agentId: string): boolean {
  return Boolean(input && input.id === agentId && input.companyId === companyId
    && input.lifecycleState === "paused" && input.pauseReason === "setup");
}
