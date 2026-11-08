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


/** Keep the old key readable until user-owned draft data has been migrated. */
export const ONBOARDING_STORAGE_KEY = "paperclip-onboarding-state";

/**
 * This does not authorize a hire. It only selects a resume CTA for the exact
 * paused agent named in this browser's saved, server-verified draft.
 */
export function savedDraftMatchesAgent(
  raw: string | null,
  agent: { id: string; companyId: string; lifecycleState?: string; pauseReason?: string | null },
): boolean {
  if (!isPersistedDeferredAgent(agent, agent.companyId, agent.id) || !raw) return false;
  try {
    const draft: unknown = JSON.parse(raw);
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return false;
    const record = draft as Record<string, unknown>;
    return record.step === 4 && record.createdCompanyId === agent.companyId
      && record.setupAgentId === agent.id && !record.createdAgentId;
  } catch {
    return false;
  }
}
