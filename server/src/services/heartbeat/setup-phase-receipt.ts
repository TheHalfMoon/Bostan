/**
 * Records ONLY fixed execution checkpoints when a legacy run reaches
 * environment lease release still live in pre-dispatch preparation.
 * Raw errors, source paths, prompts, stack traces, and connection secrets
 * must never be included in this lightweight diagnostic payload.
 */
export type PreDispatchCheckpoint =
  | "claimed"
  | "agent_loaded"
  | "runtime_prepared"
  | "session_prepared";

const SAFE_ERRORS = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError",
  "AbortError", "TimeoutError", "ConfigurationIncompleteFailure",
  "LegacyControllerLeaseLostError",
]);

export function buildPreDispatchLeaseReleaseReceipt(
  checkpoint: PreDispatchCheckpoint,
  setupError: unknown,
) {
  const candidate = setupError instanceof Error ? setupError.name : "";
  return {
    checkpoint,
    errorClass: SAFE_ERRORS.has(candidate) ? candidate : "unclassified",
    reason: "legacy_pre_dispatch_lease_release",
    providerWorkStarted: false,
  };
}
