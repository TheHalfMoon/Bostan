import { AGENT_STATUSES, APPROVAL_STATUSES, HEARTBEAT_RUN_STATUSES, ISSUE_STATUSES } from "@bostan/shared";
import { describe, expect, it } from "vitest";
import {
  EXECUTION_STATE_COPY,
  EXECUTION_STATES,
  executionStateFromAgent,
  executionStateFromApproval,
  executionStateFromIssue,
  executionStateFromRun,
} from "./execution-state";

describe("execution states", () => {
  it("defines the nine System-board states with distinct labels", () => {
    expect(EXECUTION_STATES).toHaveLength(9);
    const labels = EXECUTION_STATES.map((state) => EXECUTION_STATE_COPY[state].label);
    expect(new Set(labels).size).toBe(9);
    expect(labels).toEqual([
      "Requested", "Approved", "Queued", "Running", "Completed", "Verified", "Failed", "Blocked", "Outcome unknown",
    ]);
  });

  it("maps every API status without throwing", () => {
    for (const status of HEARTBEAT_RUN_STATUSES) expect(() => executionStateFromRun(status)).not.toThrow();
    for (const status of ISSUE_STATUSES) expect(() => executionStateFromIssue(status)).not.toThrow();
    for (const status of APPROVAL_STATUSES) expect(() => executionStateFromApproval(status)).not.toThrow();
    for (const status of AGENT_STATUSES) expect(() => executionStateFromAgent(status)).not.toThrow();
  });

  it("never infers Verified from a status alone", () => {
    const fromStatuses = [
      ...HEARTBEAT_RUN_STATUSES.map((s) => executionStateFromRun(s)),
      ...HEARTBEAT_RUN_STATUSES.map((s) => executionStateFromRun(s, "completed")),
      ...ISSUE_STATUSES.map((s) => executionStateFromIssue(s)),
      ...APPROVAL_STATUSES.map((s) => executionStateFromApproval(s)),
      ...AGENT_STATUSES.map((s) => executionStateFromAgent(s)),
    ];
    expect(fromStatuses).not.toContain("verified");
    expect(executionStateFromIssue("done")).toBe("completed");
    expect(executionStateFromIssue("done", { verified: true })).toBe("verified");
  });

  it("maps runs, keeping interrupted runs distinct from failures", () => {
    expect(executionStateFromRun("queued")).toBe("queued");
    expect(executionStateFromRun("scheduled_retry")).toBe("queued");
    expect(executionStateFromRun("running")).toBe("running");
    expect(executionStateFromRun("succeeded")).toBe("completed");
    expect(executionStateFromRun("succeeded", "blocked")).toBe("blocked");
    expect(executionStateFromRun("succeeded", "failed")).toBe("failed");
    expect(executionStateFromRun("failed")).toBe("failed");
    expect(executionStateFromRun("timed_out")).toBe("failed");
    expect(executionStateFromRun("interrupted")).toBe("outcome_unknown");
    expect(executionStateFromRun("cancelled")).toBeNull();
  });

  it("maps tasks, approvals and agents", () => {
    expect(executionStateFromIssue("backlog")).toBe("requested");
    expect(executionStateFromIssue("todo")).toBe("queued");
    expect(executionStateFromIssue("in_progress")).toBe("running");
    expect(executionStateFromIssue("in_review")).toBe("completed");
    expect(executionStateFromIssue("blocked")).toBe("blocked");
    expect(executionStateFromApproval("pending")).toBe("requested");
    expect(executionStateFromApproval("approved")).toBe("approved");
    expect(executionStateFromApproval("revision_requested")).toBe("blocked");
    expect(executionStateFromAgent("running")).toBe("running");
    expect(executionStateFromAgent("error")).toBe("failed");
    expect(executionStateFromAgent("paused")).toBe("blocked");
    expect(executionStateFromAgent("idle")).toBeNull();
  });
});
