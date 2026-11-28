import type { AgentStatus, ApprovalStatus, HeartbeatRunStatus, IssueStatus } from "@bostan/shared";

/**
 * The nine execution states of the v3 desktop shell. Each has its own shape,
 * label and tone so state never depends on colour alone.
 *
 * "Completed" means the work finished; "Verified" means a check or a person
 * confirmed the outcome. "Outcome unknown" means the runner stopped without a
 * definitive result (for example the process was lost), so its receipt must be
 * reconciled before anyone relies on it.
 */
export const EXECUTION_STATES = [
  "requested",
  "approved",
  "queued",
  "running",
  "completed",
  "verified",
  "failed",
  "blocked",
  "outcome_unknown",
] as const;
export type ExecutionState = (typeof EXECUTION_STATES)[number];

export type ExecutionTone = "neutral" | "accent" | "info" | "ok" | "bad" | "warn" | "unknown";

export interface ExecutionStateMeta {
  label: string;
  /** Short explanation shown beside or under the label. */
  description: string;
  tone: ExecutionTone;
}

export const EXECUTION_STATE_META: Record<ExecutionState, ExecutionStateMeta> = {
  requested: { label: "Requested", description: "Awaiting triage", tone: "neutral" },
  approved: { label: "Approved", description: "Human granted scope", tone: "accent" },
  queued: { label: "Queued", description: "Waiting for a runner", tone: "neutral" },
  running: { label: "Running", description: "Agent executing", tone: "info" },
  completed: { label: "Completed", description: "Not yet verified", tone: "neutral" },
  verified: { label: "Verified", description: "Evidence confirmed", tone: "ok" },
  failed: { label: "Failed", description: "Error with reason", tone: "bad" },
  blocked: { label: "Blocked", description: "Needs input or budget", tone: "warn" },
  outcome_unknown: { label: "Outcome unknown", description: "Reconcile receipt", tone: "unknown" },
};

/** Heartbeat runs. Cancelled runs have no execution state. */
export function executionStateForRun(status: HeartbeatRunStatus | string): ExecutionState | null {
  switch (status) {
    case "queued":
    case "scheduled_retry":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "completed";
    case "failed":
    case "timed_out":
      return "failed";
    // The runner stopped (process lost, restart) without a definitive result.
    case "interrupted":
      return "outcome_unknown";
    default:
      return null;
  }
}

/** Approvals. Rejected and cancelled approvals leave the execution flow. */
export function executionStateForApproval(status: ApprovalStatus | string): ExecutionState | null {
  switch (status) {
    case "pending":
    case "revision_requested":
      return "requested";
    case "approved":
      return "approved";
    default:
      return null;
  }
}

/**
 * Tasks. `in_review` is finished work awaiting its reviewer (Completed);
 * `done` is the state a task reaches once its review policy is satisfied
 * (Verified). Cancelled tasks have no execution state.
 */
export function executionStateForIssue(status: IssueStatus | string): ExecutionState | null {
  switch (status) {
    case "backlog":
      return "requested";
    case "todo":
      return "queued";
    case "in_progress":
      return "running";
    case "in_review":
      return "completed";
    case "done":
      return "verified";
    case "blocked":
      return "blocked";
    default:
      return null;
  }
}

/** Agents. Idle/active agents are not executing anything, so they have none. */
export function executionStateForAgent(status: AgentStatus | string): ExecutionState | null {
  switch (status) {
    case "running":
      return "running";
    case "error":
      return "failed";
    case "paused":
      return "blocked";
    case "pending_approval":
      return "requested";
    default:
      return null;
  }
}
