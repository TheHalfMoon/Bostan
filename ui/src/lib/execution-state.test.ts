import { AGENT_STATUSES, APPROVAL_STATUSES, HEARTBEAT_RUN_STATUSES, ISSUE_STATUSES, RUN_LIVENESS_STATES } from "@bostan/shared";
import { describe, expect, it } from "vitest";
import {
  EXECUTION_STATE_META,
  EXECUTION_STATES,
  executionStateForAgent,
  executionStateForApproval,
  executionStateForIssue,
  executionStateForRun,
  executionStateForSucceededLiveness,
} from "./execution-state";

describe("execution states", () => {
  it("defines nine distinct states with unique labels", () => {
    expect(EXECUTION_STATES).toHaveLength(9);
    const labels = EXECUTION_STATES.map((state) => EXECUTION_STATE_META[state].label);
    expect(new Set(labels).size).toBe(9);
    expect(labels).toEqual([
      "Requested",
      "Approved",
      "Queued",
      "Running",
      "Completed",
      "Verified",
      "Failed",
      "Blocked",
      "Outcome unknown",
    ]);
  });

  it("maps every heartbeat run status", () => {
    const mapped = Object.fromEntries(HEARTBEAT_RUN_STATUSES.map((status) => [status, executionStateForRun(status)]));
    expect(mapped).toEqual({
      queued: "queued",
      scheduled_retry: "queued",
      running: "running",
      succeeded: "completed",
      interrupted: "outcome_unknown",
      failed: "failed",
      cancelled: null,
      timed_out: "failed",
    });
  });

  it("never reports a finished run as verified", () => {
    for (const status of HEARTBEAT_RUN_STATUSES) expect(executionStateForRun(status)).not.toBe("verified");
  });

  it("maps approvals, tasks and agents", () => {
    expect(APPROVAL_STATUSES.map(executionStateForApproval)).toEqual(["requested", "requested", "approved", null, null]);
    expect(ISSUE_STATUSES.map(executionStateForIssue)).toEqual([
      "requested",
      "queued",
      "running",
      "completed",
      "verified",
      "blocked",
      null,
    ]);
    expect(AGENT_STATUSES.map(executionStateForAgent)).toEqual([null, "blocked", null, "running", "failed", "requested", null]);
  });

  it("returns null for unknown values instead of guessing", () => {
    expect(executionStateForRun("mystery")).toBeNull();
    expect(executionStateForIssue("mystery")).toBeNull();
  });

  it("maps every run liveness value explicitly, claiming completion only with action evidence", () => {
    const mapped = Object.fromEntries(RUN_LIVENESS_STATES.map((state) => [state, executionStateForSucceededLiveness(state)]));
    expect(mapped).toEqual({
      completed: "completed",
      advanced: "completed",
      plan_only: "queued",
      empty_response: "queued",
      blocked: "blocked",
      failed: "failed",
      needs_followup: "blocked",
    });
    for (const state of ["plan_only", "empty_response", "needs_followup"] as const) {
      expect(executionStateForRun("succeeded", state)).not.toBe("completed");
    }
    expect(executionStateForRun("succeeded", null)).toBe("completed");
  });
});
