import type { Agent, Approval, DashboardSummary, Goal, Issue } from "@bostan/shared";

/**
 * Pure derivations for the Home command center (Desktop-Home artboard).
 * Every number comes from an API response passed in; nothing is estimated.
 */

export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "Good evening.";
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The one-line status under the greeting. */
export function commandSummaryLine(pendingApprovals: number, failedOrBlocked: number): string {
  if (pendingApprovals === 0 && failedOrBlocked === 0) return "Nothing needs you right now.";
  const parts: string[] = [];
  if (pendingApprovals > 0) parts.push(`${plural(pendingApprovals, "decision")} ${pendingApprovals === 1 ? "needs" : "need"} you`);
  if (failedOrBlocked > 0) parts.push(`${plural(failedOrBlocked, "item")} ${failedOrBlocked === 1 ? "is" : "are"} failed or blocked`);
  const line = parts.join("; ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

export interface CommandTiles {
  judgment: { count: number; detail: string };
  running: { count: number; detail: string };
  awaitingVerification: { count: number; detail: string };
  failedOrBlocked: { count: number; detail: string };
}

export function commandTiles(
  summary: DashboardSummary,
  issues: readonly Pick<Issue, "status">[] | undefined,
  oldestPendingApproval: Pick<Approval, "createdAt"> | null,
  timeAgo: (date: Date | string) => string,
): CommandTiles {
  const inReview = (issues ?? []).filter((issue) => issue.status === "in_review").length;
  const errors = summary.agents.error;
  const blocked = summary.tasks.blocked;
  return {
    judgment: {
      count: summary.pendingApprovals,
      detail:
        summary.pendingApprovals === 0
          ? "no approvals waiting"
          : `${plural(summary.pendingApprovals, "approval")}${oldestPendingApproval ? ` · oldest ${timeAgo(oldestPendingApproval.createdAt)}` : ""}`,
    },
    running: { count: summary.agents.running, detail: `${plural(summary.agents.running, "agent")} executing` },
    awaitingVerification: {
      count: inReview,
      detail: issues === undefined ? "loading tasks" : "completed, not yet verified",
    },
    failedOrBlocked: {
      count: errors + blocked,
      detail: `${plural(errors, "agent error")} · ${plural(blocked, "blocked task")}`,
    },
  };
}

export interface ObjectiveProgress {
  goal: Goal;
  total: number;
  completed: number;
  blocked: number;
}

/** Open objectives (planned/active) with progress counted from their tasks. Cancelled tasks don't count. */
export function objectiveProgress(goals: readonly Goal[] | undefined, issues: readonly Issue[] | undefined, limit = 3): ObjectiveProgress[] {
  const open = (goals ?? []).filter((goal) => goal.status === "active" || goal.status === "planned");
  const byGoal = new Map<string, Issue[]>();
  for (const issue of issues ?? []) {
    if (!issue.goalId || issue.status === "cancelled") continue;
    const list = byGoal.get(issue.goalId) ?? [];
    list.push(issue);
    byGoal.set(issue.goalId, list);
  }
  return open
    .map((goal) => {
      const tasks = byGoal.get(goal.id) ?? [];
      return {
        goal,
        total: tasks.length,
        completed: tasks.filter((task) => task.status === "done").length,
        blocked: tasks.filter((task) => task.status === "blocked").length,
      };
    })
    .sort((a, b) => Number(b.goal.status === "active") - Number(a.goal.status === "active") || b.total - a.total)
    .slice(0, limit);
}

/** Most recently completed tasks (status done with a completion time). */
export function recentlyCompleted(issues: readonly Issue[] | undefined, limit = 3): Issue[] {
  return (issues ?? [])
    .filter((issue) => issue.status === "done" && issue.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, limit);
}

/** Agents ordered so the ones needing attention come first, then running ones. */
export function agentsByAttention(agents: readonly Agent[] | undefined, limit = 5): Agent[] {
  const rank: Partial<Record<Agent["status"], number>> = { error: 0, paused: 1, pending_approval: 2, running: 3 };
  return (agents ?? [])
    .filter((agent) => agent.status !== "terminated")
    .slice()
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Calendar days left in the month of `now`, including today. */
export function daysLeftInMonth(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}

export function monthName(now: Date): string {
  return now.toLocaleString("en-US", { month: "long" });
}
