import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import type { Agent, DashboardSummary, Issue } from "@bostan/shared";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { approvalsApi } from "@/api/approvals";
import { goalsApi } from "@/api/goals";
import { queryKeys } from "@/lib/queryKeys";
import { timeAgo } from "@/lib/timeAgo";
import { cn, formatCents } from "@/lib/utils";
import { executionStateFromAgent } from "@/lib/execution-state";
import {
  agentsByAttention,
  commandSummaryLine,
  commandTiles,
  daysLeftInMonth,
  greeting,
  monthName,
  objectiveProgress,
  recentlyCompleted,
} from "@/lib/command-center";
import { useDialogActions } from "@/context/DialogContext";
import { approvalLabel } from "../ApprovalPayload";
import { ExecutionStateBadge, ExecutionStateIcon } from "../ExecutionStateBadge";

interface CommandCenterProps {
  companyId: string;
  summary: DashboardSummary;
  agents: Agent[] | undefined;
  issues: Issue[] | undefined;
  /** Injectable clock for tests and stories. */
  now?: Date;
}

function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside ? <div className="text-xs text-muted-foreground">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-sm text-muted-foreground">{children}</p>;
}

function Tile({
  to,
  icon,
  label,
  count,
  detail,
  tone,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  count: number;
  detail: string;
  tone?: "attention";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-card p-4 no-underline text-foreground transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-ring",
        tone === "attention" && count > 0 ? "border-bad-line" : "border-border",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-xs font-medium", tone === "attention" && count > 0 ? "text-bad" : "text-muted-foreground")}>
        {icon}
        {label}
      </span>
      <span data-numeric className="font-display text-3xl font-semibold leading-none">{count}</span>
      <span className="truncate text-xs text-muted-foreground">{detail}</span>
    </Link>
  );
}

/**
 * Founder command center (Desktop-Home artboard). Every figure is read from
 * the dashboard summary, approvals, goals, agents and tasks APIs; sections with
 * no data render an empty state rather than placeholders.
 */
export function CommandCenter({ companyId, summary, agents, issues, now = new Date() }: CommandCenterProps) {
  const { openNewIssue, openNewGoal } = useDialogActions();
  const { data: pendingApprovals, error: approvalsError } = useQuery({
    queryKey: queryKeys.approvals.list(companyId, "pending"),
    queryFn: () => approvalsApi.list(companyId, "pending"),
  });
  const { data: goals, error: goalsError } = useQuery({
    queryKey: queryKeys.goals.list(companyId),
    queryFn: () => goalsApi.list(companyId),
  });

  const pendingSorted = useMemo(
    () => (pendingApprovals ?? []).slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [pendingApprovals],
  );
  const agentNames = useMemo(() => new Map((agents ?? []).map((agent) => [agent.id, agent.name])), [agents]);
  const tiles = commandTiles(summary, issues, pendingSorted[0] ?? null, timeAgo);
  const objectives = objectiveProgress(goals, issues);
  const completed = recentlyCompleted(issues);
  const agentRows = agentsByAttention(agents);
  const nonTerminated = (agents ?? []).filter((agent) => agent.status !== "terminated").length;
  const budgetCents = summary.costs.monthBudgetCents;
  const spendCents = summary.costs.monthSpendCents;
  const spendShare = budgetCents > 0 ? Math.min(100, (spendCents / budgetCents) * 100) : 0;

  return (
    <div data-testid="command-center" className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">{greeting(now)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {commandSummaryLine(summary.pendingApprovals, tiles.failedOrBlocked.count)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => openNewGoal()}>
            New objective
          </Button>
          <Button onClick={() => openNewIssue()}>New task</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile to="/approvals" icon={<ShieldCheck className="size-3.5" aria-hidden="true" />} label="Needs your judgment" count={tiles.judgment.count} detail={tiles.judgment.detail} />
        <Tile to="/agents" icon={<ExecutionStateIcon state="running" className="size-3.5" />} label="Running" count={tiles.running.count} detail={tiles.running.detail} />
        <Tile to="/issues" icon={<ExecutionStateIcon state="completed" className="size-3.5" />} label="Awaiting verification" count={tiles.awaitingVerification.count} detail={tiles.awaitingVerification.detail} />
        <Tile to="/inbox/blocked" icon={<ExecutionStateIcon state="failed" className="size-3.5" />} label="Failed or blocked" count={tiles.failedOrBlocked.count} detail={tiles.failedOrBlocked.detail} tone="attention" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            title="Needs your judgment"
            aside={
              <Link to="/approvals" className="text-accent-text underline underline-offset-2">
                Open approvals
              </Link>
            }
          >
            {approvalsError ? (
              <p role="alert" className="px-4 py-5 text-sm text-destructive">Couldn't load approvals.</p>
            ) : pendingApprovals === undefined ? (
              <EmptyRow>Loading approvals…</EmptyRow>
            ) : pendingSorted.length === 0 ? (
              <EmptyRow>Nothing is waiting for your approval.</EmptyRow>
            ) : (
              <ul className="divide-y divide-border">
                {pendingSorted.slice(0, 3).map((approval) => {
                  const requester = approval.requestedByAgentId ? agentNames.get(approval.requestedByAgentId) : null;
                  return (
                    <li key={approval.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{approvalLabel(approval.type, approval.payload)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {requester ? `${requester} · ` : ""}requested {timeAgo(approval.createdAt)}
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/approvals/${approval.id}`}>Review</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Objectives" aside={<span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-sm bg-ok-strong" />Completed tasks</span>}>
            {goalsError ? (
              <p role="alert" className="px-4 py-5 text-sm text-destructive">Couldn't load objectives.</p>
            ) : goals === undefined ? (
              <EmptyRow>Loading objectives…</EmptyRow>
            ) : objectives.length === 0 ? (
              <EmptyRow>No open objectives yet. Create one to group the work toward an outcome.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-4 px-4 py-4">
                {objectives.map(({ goal, total, completed: done, blocked }) => (
                  <li key={goal.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Link to={`/goals/${goal.id}`} className="truncate text-sm font-medium text-foreground no-underline hover:underline">
                        {goal.title}
                      </Link>
                      <span data-numeric className={cn("shrink-0 text-xs", blocked > 0 ? "text-bad" : "text-muted-foreground")}>
                        {total === 0
                          ? "No tasks yet"
                          : blocked > 0
                            ? `Blocked · ${blocked} of ${total} tasks`
                            : `${done} of ${total} tasks completed`}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${goal.title} progress`}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={done}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div className="h-full rounded-full bg-ok-strong" style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section
            title="Agents"
            aside={<span data-numeric>{`${summary.agents.running} running · ${nonTerminated} total`}</span>}
          >
            {agents === undefined ? (
              <EmptyRow>Loading agents…</EmptyRow>
            ) : agentRows.length === 0 ? (
              <EmptyRow>No agents yet. Hire one to start delegating work.</EmptyRow>
            ) : (
              <ul className="divide-y divide-border">
                {agentRows.map((agent) => {
                  const state = executionStateFromAgent(agent.status);
                  return (
                    <li key={agent.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <Link to={`/agents/${agent.id}`} className="block truncate text-sm font-medium text-foreground no-underline hover:underline">
                          {agent.name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">{agent.title ?? agent.role}</div>
                      </div>
                      {state ? (
                        <ExecutionStateBadge state={state} />
                      ) : (
                        <span className="text-xs text-muted-foreground">{agent.status === "idle" ? "Idle" : "Ready"}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title={`Budget · ${monthName(now)}`}
            aside={
              budgetCents > 0 ? (
                <span data-numeric>
                  <strong className="text-sm font-semibold text-foreground">{formatCents(spendCents)}</strong> of {formatCents(budgetCents)}
                </span>
              ) : (
                <span data-numeric>{formatCents(spendCents)} spent</span>
              )
            }
          >
            <div className="px-4 py-4">
              {budgetCents > 0 ? (
                <div
                  role="progressbar"
                  aria-label="Monthly budget used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(spendShare)}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-brand-slate" style={{ width: `${spendShare}%` }} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No monthly budget is set.</p>
              )}
              <div data-numeric className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{budgetCents > 0 ? `${Math.round(summary.costs.monthUtilizationPercent)}% used` : ""}</span>
                <span>{`${daysLeftInMonth(now)} days left`}</span>
              </div>
            </div>
          </Section>

          <section className="rounded-xl bg-sage px-4 py-3" data-accent-surface>
            <h2 className="mb-1 text-base font-semibold">Recently completed</h2>
            {issues === undefined ? (
              <p className="text-sm text-muted-foreground">Loading tasks…</p>
            ) : completed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {completed.map((issue) => (
                  <li key={issue.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <Link to={`/issues/${issue.identifier ?? issue.id}`} className="truncate text-foreground no-underline hover:underline">
                      {issue.title}
                    </Link>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      <time dateTime={new Date(issue.completedAt!).toISOString()}>{timeAgo(issue.completedAt!)}</time>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
