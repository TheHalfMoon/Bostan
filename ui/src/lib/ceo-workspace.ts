import type { Agent, Approval, Goal, Issue } from "@bostan/shared";
import { executionStateFromIssue, type ExecutionState } from "./execution-state";

/**
 * Pure derivations for the CEO / Chief of Staff workspace (CEO-Workspace
 * artboard). Inputs are API responses; nothing is estimated.
 */

/** The company's CEO agent: role "ceo", not terminated; an active one wins over a paused one. */
export function findCeoAgent(agents: readonly Agent[] | undefined): Agent | null {
  const ceos = (agents ?? []).filter((agent) => agent.role === "ceo" && agent.status !== "terminated");
  return ceos.find((agent) => agent.status !== "paused" && agent.status !== "error") ?? ceos[0] ?? null;
}

export interface ObjectiveListEntry {
  goal: Goal;
  /** One-line state shown under the title in the objectives rail. */
  detail: string;
  tone: "default" | "bad";
}

function tasksFor(goalId: string, issues: readonly Issue[] | undefined): Issue[] {
  return (issues ?? []).filter((issue) => issue.goalId === goalId && issue.status !== "cancelled");
}

function agentCount(tasks: readonly Issue[]): number {
  return new Set(tasks.flatMap((task) => (task.assigneeAgentId ? [task.assigneeAgentId] : []))).size;
}

/** Open objectives first (active, then planned); achieved and cancelled ones go to "Earlier". */
export function objectiveRail(goals: readonly Goal[] | undefined, issues: readonly Issue[] | undefined) {
  const describe = (goal: Goal): ObjectiveListEntry => {
    const tasks = tasksFor(goal.id, issues);
    const blocked = tasks.filter((task) => task.status === "blocked").length;
    const running = tasks.filter((task) => task.status === "in_progress").length;
    const agents = agentCount(tasks);
    const agentsLabel = `${agents} ${agents === 1 ? "agent" : "agents"}`;
    if (goal.status === "achieved") return { goal, detail: "Achieved", tone: "default" };
    if (goal.status === "cancelled") return { goal, detail: "Cancelled", tone: "default" };
    if (tasks.length === 0) return { goal, detail: goal.status === "planned" ? "Planned · no tasks yet" : "No tasks yet", tone: "default" };
    if (blocked > 0) return { goal, detail: `Blocked · ${blocked} ${blocked === 1 ? "task" : "tasks"}`, tone: "bad" };
    if (running > 0) return { goal, detail: `Running · ${agentsLabel}`, tone: "default" };
    return { goal, detail: `${tasks.filter((task) => task.status === "done").length} of ${tasks.length} tasks completed`, tone: "default" };
  };
  const open = (goals ?? [])
    .filter((goal) => goal.status === "active" || goal.status === "planned")
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const earlier = (goals ?? [])
    .filter((goal) => goal.status === "achieved" || goal.status === "cancelled")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  return { open: open.map(describe), earlier: earlier.map(describe) };
}

export interface PlanStep {
  index: number;
  issue: Issue;
  state: ExecutionState | null;
  assignee: string;
}

/** The objective's tasks as numbered plan steps, in creation order. */
export function planSteps(goalId: string, issues: readonly Issue[] | undefined, agents: readonly Agent[] | undefined): PlanStep[] {
  const names = new Map((agents ?? []).map((agent) => [agent.id, agent.name]));
  return tasksFor(goalId, issues)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((issue, index) => ({
      index: index + 1,
      issue,
      state: executionStateFromIssue(issue.status),
      assignee: issue.assigneeAgentId ? names.get(issue.assigneeAgentId) ?? "Unknown agent" : issue.assigneeUserId ? "Person" : "Unassigned",
    }));
}

export interface PlanSummary {
  steps: number;
  completed: number;
  inReview: number;
  blocked: number;
  running: number;
}

export function planSummary(steps: readonly PlanStep[]): PlanSummary {
  const count = (status: string) => steps.filter((step) => step.issue.status === status).length;
  return { steps: steps.length, completed: count("done"), inReview: count("in_review"), blocked: count("blocked"), running: count("in_progress") };
}

/** Agents assigned to the objective's tasks, with their live status. */
export function assignedAgents(goalId: string, issues: readonly Issue[] | undefined, agents: readonly Agent[] | undefined): Agent[] {
  const ids = new Set(tasksFor(goalId, issues).flatMap((task) => (task.assigneeAgentId ? [task.assigneeAgentId] : [])));
  return (agents ?? []).filter((agent) => ids.has(agent.id)).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Pending approvals that touch this objective: linked to one of its tasks
 * (via the approval→issues relation). Oldest first.
 */
export function objectiveApprovals(
  goalId: string,
  pending: readonly Approval[] | undefined,
  linkedIssues: ReadonlyMap<string, readonly Pick<Issue, "id" | "goalId">[]>,
): Approval[] {
  return (pending ?? [])
    .filter((approval) => (linkedIssues.get(approval.id) ?? []).some((issue) => issue.goalId === goalId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Title + description for the "Ask the CEO" task, from the composer text. */
export function askCeoTaskDraft(text: string): { title: string; description: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const firstLine = trimmed.split(/\r?\n/)[0]!.trim();
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 79).trimEnd()}…` : firstLine;
  return { title, description: trimmed };
}
