import type { Goal, Issue } from "@bostan/shared";
import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "./CommandCenter";

const goal = (id: string, status: Goal["status"] = "active") => ({ id, title: id, status }) as Goal;
const issue = (goalId: string | null, status: Issue["status"]) => ({ id: `${goalId}-${status}-${Math.random()}`, goalId, status }) as Issue;

describe("computeGoalProgress", () => {
  it("counts done as verified and in_review as completed, ignoring cancelled tasks", () => {
    const [progress] = computeGoalProgress(
      [goal("g1")],
      [issue("g1", "done"), issue("g1", "done"), issue("g1", "in_review"), issue("g1", "blocked"), issue("g1", "todo"), issue("g1", "cancelled")],
    );
    expect(progress).toMatchObject({ total: 5, verified: 2, completed: 1, blocked: 1 });
  });

  it("skips achieved/cancelled goals and goals without tasks", () => {
    const result = computeGoalProgress(
      [goal("active"), goal("empty"), goal("done", "achieved"), goal("dropped", "cancelled")],
      [issue("active", "todo"), issue("done", "done"), issue("dropped", "todo"), issue(null, "done")],
    );
    expect(result.map((entry) => entry.goal.id)).toEqual(["active"]);
  });
});
