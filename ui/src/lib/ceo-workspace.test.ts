import type { Agent, Approval, Goal, Issue } from "@bostan/shared";
import { describe, expect, it } from "vitest";
import {
  askCeoTaskDraft,
  assignedAgents,
  findCeoAgent,
  objectiveApprovals,
  objectiveRail,
  planSteps,
  planSummary,
} from "./ceo-workspace";

const agent = (o: Partial<Agent>) => ({ id: "a", name: "A", role: "general", status: "idle", ...o }) as Agent;
const goal = (o: Partial<Goal>) => ({ id: "g", title: "G", status: "active", updatedAt: new Date(2026, 10, 1), ownerAgentId: null, ...o }) as Goal;
const issue = (o: Partial<Issue>) =>
  ({ id: Math.random().toString(36), title: "t", status: "todo", goalId: "g1", assigneeAgentId: null, assigneeUserId: null, createdAt: new Date(2026, 10, 1), ...o }) as Issue;

describe("CEO workspace derivations", () => {
  it("finds the CEO agent, preferring an active one", () => {
    expect(findCeoAgent(undefined)).toBeNull();
    expect(findCeoAgent([agent({ id: "x", role: "engineer" })])).toBeNull();
    expect(findCeoAgent([agent({ id: "old", role: "ceo", status: "terminated" })])).toBeNull();
    expect(findCeoAgent([agent({ id: "p", role: "ceo", status: "paused" }), agent({ id: "r", role: "ceo", status: "running" })])?.id).toBe("r");
    expect(findCeoAgent([agent({ id: "p", role: "ceo", status: "paused" })])?.id).toBe("p");
  });

  it("builds the objectives rail with honest one-line states", () => {
    const goals = [
      goal({ id: "g1", title: "Supplier program" }),
      goal({ id: "g2", title: "Books" }),
      goal({ id: "g3", title: "Website", status: "planned" }),
      goal({ id: "g4", title: "Old", status: "achieved" }),
    ];
    const issues = [
      issue({ goalId: "g1", status: "in_progress", assigneeAgentId: "a1" }),
      issue({ goalId: "g1", status: "done", assigneeAgentId: "a2" }),
      issue({ goalId: "g2", status: "blocked" }),
    ];
    const rail = objectiveRail(goals, issues);
    expect(rail.open.map((e) => [e.goal.id, e.detail, e.tone])).toEqual([
      ["g1", "Running · 2 agents", "default"],
      ["g2", "Blocked · 1 task", "bad"],
      ["g3", "Planned · no tasks yet", "default"],
    ]);
    expect(rail.earlier.map((e) => [e.goal.id, e.detail])).toEqual([["g4", "Achieved"]]);
  });

  it("orders plan steps by creation and maps states without claiming verification", () => {
    const agents = [agent({ id: "a1", name: "Research" })];
    const steps = planSteps(
      "g1",
      [
        issue({ id: "late", createdAt: new Date(2026, 10, 3), status: "done", assigneeAgentId: "a1" }),
        issue({ id: "early", createdAt: new Date(2026, 10, 2), status: "in_progress", assigneeUserId: "u1" }),
        issue({ id: "other", goalId: "g2" }),
        issue({ id: "gone", status: "cancelled" }),
      ],
      agents,
    );
    expect(steps.map((s) => [s.index, s.issue.id, s.state, s.assignee])).toEqual([
      [1, "early", "running", "Person"],
      [2, "late", "completed", "Research"],
    ]);
    expect(planSummary(steps)).toEqual({ steps: 2, completed: 1, inReview: 0, blocked: 0, running: 1 });
  });

  it("lists the agents assigned to an objective", () => {
    const agents = [agent({ id: "a1", name: "Zed" }), agent({ id: "a2", name: "Ann" }), agent({ id: "a3", name: "Idle" })];
    const issues = [issue({ assigneeAgentId: "a1" }), issue({ assigneeAgentId: "a2" }), issue({ assigneeAgentId: "a1" })];
    expect(assignedAgents("g1", issues, agents).map((a) => a.name)).toEqual(["Ann", "Zed"]);
  });

  it("only surfaces approvals linked to the objective's tasks, oldest first", () => {
    const pending = [
      { id: "ap-new", createdAt: new Date(2026, 10, 5) },
      { id: "ap-old", createdAt: new Date(2026, 10, 1) },
      { id: "ap-other", createdAt: new Date(2026, 10, 2) },
    ] as unknown as Approval[];
    const linked = new Map([
      ["ap-new", [{ id: "i1", goalId: "g1" }]],
      ["ap-old", [{ id: "i2", goalId: "g1" }]],
      ["ap-other", [{ id: "i3", goalId: "g2" }]],
    ]);
    expect(objectiveApprovals("g1", pending, linked).map((a) => a.id)).toEqual(["ap-old", "ap-new"]);
    expect(objectiveApprovals("g1", undefined, new Map())).toEqual([]);
  });

  it("turns composer text into a task draft", () => {
    expect(askCeoTaskDraft("   ")).toBeNull();
    expect(askCeoTaskDraft("Find three suppliers\nUnder $5 per unit")).toEqual({
      title: "Find three suppliers",
      description: "Find three suppliers\nUnder $5 per unit",
    });
    expect(askCeoTaskDraft("x".repeat(100))?.title).toHaveLength(80);
  });
});
