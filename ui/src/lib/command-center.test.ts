import type { Agent, DashboardSummary, Goal, Issue } from "@bostan/shared";
import { describe, expect, it } from "vitest";
import {
  agentsByAttention,
  commandSummaryLine,
  commandTiles,
  daysLeftInMonth,
  greeting,
  objectiveProgress,
  recentlyCompleted,
} from "./command-center";

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  companyId: "c1",
  agents: { active: 2, running: 3, paused: 1, error: 1 },
  tasks: { open: 5, inProgress: 3, blocked: 2, done: 9 },
  costs: { monthSpendCents: 41280, monthBudgetCents: 60000, monthUtilizationPercent: 68.8 },
  pendingApprovals: 3,
  budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [],
  ...overrides,
});

const issue = (overrides: Partial<Issue>): Issue => ({ id: Math.random().toString(36), title: "t", status: "todo", goalId: null, completedAt: null, identifier: null, ...overrides }) as Issue;
const goal = (overrides: Partial<Goal>): Goal => ({ id: "g", title: "Goal", status: "active", ...overrides }) as Goal;
const agent = (overrides: Partial<Agent>): Agent => ({ id: Math.random().toString(36), name: "A", status: "idle", ...overrides }) as Agent;

describe("command center derivations", () => {
  it("greets by local time of day", () => {
    expect(greeting(new Date(2026, 10, 15, 8))).toBe("Good morning.");
    expect(greeting(new Date(2026, 10, 15, 14))).toBe("Good afternoon.");
    expect(greeting(new Date(2026, 10, 15, 21))).toBe("Good evening.");
    expect(greeting(new Date(2026, 10, 15, 2))).toBe("Good evening.");
  });

  it("writes the status line from real counts, with a calm empty case", () => {
    expect(commandSummaryLine(0, 0)).toBe("Nothing needs you right now.");
    expect(commandSummaryLine(1, 0)).toBe("1 decision needs you.");
    expect(commandSummaryLine(3, 2)).toBe("3 decisions need you; 2 items are failed or blocked.");
    expect(commandSummaryLine(0, 1)).toBe("1 item is failed or blocked.");
  });

  it("derives the four tiles without inventing numbers", () => {
    const tiles = commandTiles(
      summary(),
      [issue({ status: "in_review" }), issue({ status: "in_review" }), issue({ status: "done" })],
      { createdAt: new Date() },
      () => "2 h ago",
    );
    expect(tiles.judgment).toEqual({ count: 3, detail: "3 approvals · oldest 2 h ago" });
    expect(tiles.running).toEqual({ count: 3, detail: "3 agents executing" });
    expect(tiles.awaitingVerification).toEqual({ count: 2, detail: "completed, not yet verified" });
    expect(tiles.failedOrBlocked).toEqual({ count: 3, detail: "1 agent error · 2 blocked tasks" });

    const empty = commandTiles(summary({ pendingApprovals: 0 }), undefined, null, () => "");
    expect(empty.judgment.detail).toBe("no approvals waiting");
    expect(empty.awaitingVerification).toEqual({ count: 0, detail: "loading tasks" });
  });

  it("counts objective progress from its own tasks, ignoring cancelled ones and closed goals", () => {
    const goals = [goal({ id: "g1", title: "Ship v1" }), goal({ id: "g2", status: "achieved" }), goal({ id: "g3", status: "planned", title: "Later" })];
    const issues = [
      issue({ goalId: "g1", status: "done" }),
      issue({ goalId: "g1", status: "blocked" }),
      issue({ goalId: "g1", status: "in_progress" }),
      issue({ goalId: "g1", status: "cancelled" }),
      issue({ goalId: "g2", status: "done" }),
    ];
    const progress = objectiveProgress(goals, issues);
    expect(progress.map((p) => [p.goal.id, p.total, p.completed, p.blocked])).toEqual([
      ["g1", 3, 1, 1],
      ["g3", 0, 0, 0],
    ]);
    expect(objectiveProgress(undefined, undefined)).toEqual([]);
  });

  it("lists recently completed tasks newest first and only with a completion time", () => {
    const list = recentlyCompleted([
      issue({ id: "a", status: "done", completedAt: new Date("2026-11-10") }),
      issue({ id: "b", status: "done", completedAt: new Date("2026-11-12") }),
      issue({ id: "c", status: "done", completedAt: null }),
      issue({ id: "d", status: "in_review", completedAt: new Date("2026-11-13") }),
    ]);
    expect(list.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("puts agents needing attention first and drops terminated ones", () => {
    const ordered = agentsByAttention([
      agent({ name: "Idle", status: "idle" }),
      agent({ name: "Run", status: "running" }),
      agent({ name: "Gone", status: "terminated" }),
      agent({ name: "Err", status: "error" }),
      agent({ name: "Paused", status: "paused" }),
    ]);
    expect(ordered.map((a) => a.name)).toEqual(["Err", "Paused", "Run", "Idle"]);
  });

  it("counts days left in the month including today", () => {
    expect(daysLeftInMonth(new Date(2026, 10, 15))).toBe(16);
    expect(daysLeftInMonth(new Date(2026, 1, 28))).toBe(1);
  });
});
