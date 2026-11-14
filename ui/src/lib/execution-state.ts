import type { AgentStatus, ApprovalStatus, HeartbeatRunStatus, IssueStatus, RunLivenessState } from "@bostan/shared";

/**
 * The nine execution states from the Bostan System board. Each has its own
 * shape, label and tone so nothing depends on colour alone.
 *
 * "Completed" means the work finished. "Verified" means a check or a person
 * confirmed the outcome. The two are never inferred from one another: the
 * mappers below never return "verified" from a status alone, because the API
 * has no verification field yet. Callers that hold explicit proof (an
 * approval of the outcome, a recorded check) pass `verified: true`.
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

export const EXECUTION_STATE_COPY: Record<ExecutionState, { label: string; description: string }> = {
  requested: { label: "Requested", description: "Awaiting triage" },
  approved: { label: "Approved", description: "Human granted scope" },
  queued: { label: "Queued", description: "Waiting for a runner" },
  running: { label: "Running", description: "Agent executing" },
  completed: { label: "Completed", description: "Not yet verified" },
  verified: { label: "Verified", description: "Evidence confirmed" },
  failed: { label: "Failed", description: "Error with reason" },
  blocked: { label: "Blocked", description: "Needs input or budget" },
  outcome_unknown: { label: "Outcome unknown", description: "Reconcile receipt" },
};

/** Heartbeat run → execution state. `cancelled` is not an execution outcome and maps to null. */
export function executionStateFromRun(
  status: HeartbeatRunStatus,
  liveness?: RunLivenessState | null,
): ExecutionState | null {
  switch (status) {
    case "queued":
    case "scheduled_retry":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      if (liveness === "blocked") return "blocked";
      if (liveness === "failed") return "failed";
      return "completed";
    case "failed":
    case "timed_out":
      return "failed";
    case "interrupted":
      // The process stopped without reporting; whether side effects landed is unknown.
      return "outcome_unknown";
    case "cancelled":
      return null;
  }
}

/** Task (issue) → execution state. `done` is Completed, never Verified on its own. */
export function executionStateFromIssue(status: IssueStatus, options: { verified?: boolean } = {}): ExecutionState | null {
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
      return options.verified ? "verified" : "completed";
    case "blocked":
      return "blocked";
    case "cancelled":
      return null;
  }
}

/** Approval → execution state. Rejected and cancelled approvals end the request and map to null. */
export function executionStateFromApproval(status: ApprovalStatus): ExecutionState | null {
  switch (status) {
    case "pending":
      return "requested";
    case "approved":
      return "approved";
    case "revision_requested":
      return "blocked";
    case "rejected":
    case "cancelled":
      return null;
  }
}

/** Agent → execution state, for agent rows. Idle/active/terminated agents have no execution state. */
export function executionStateFromAgent(status: AgentStatus): ExecutionState | null {
  switch (status) {
    case "running":
      return "running";
    case "error":
      return "failed";
    case "paused":
      return "blocked";
    case "pending_approval":
      return "requested";
    case "active":
    case "idle":
    case "terminated":
      return null;
  }
}
