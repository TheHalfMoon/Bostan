/**
 * BOSTAN_OFFLINE=1 suppresses the server's scheduled outbound network jobs:
 * remote tool connection health probes, GitHub event polling and continuity
 * sweeps, merged pull request confirmation, and external-object refresh.
 * User-initiated requests are unaffected.
 */
export const OFFLINE_ENV = "BOSTAN_OFFLINE";

export const OFFLINE_SUPPRESSED_JOBS = [
  "tool_connection_health",
  "github_connection_event_poll",
  "github_connection_continuity_sweep",
  "merged_pull_request_confirmation_sweep",
  "external_object_refresh",
] as const;

export function isBostanOffline(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[OFFLINE_ENV] === "1";
}
