import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, Approval, Goal, Issue } from "@bostan/shared";
import { AlertTriangle, CircleCheck, Hourglass, Play } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { dashboardApi } from "../api/dashboard";
import { goalsApi } from "../api/goals";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { approvalLabel, approvalSubject } from "../components/ApprovalPayload";
import { ExecutionStateBadge } from "../components/ExecutionStateBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { findCeoAgent } from "../lib/ceo-agent";
import { executionStateForAgent } from "../lib/execution-state";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";

/** Tasks scanned for objective progress and verification queues. */
export const COMMAND_CENTER_ISSUE_LIMIT = 500;
const ACTIVE_ISSUE_STATUSES = "backlog,todo,in_progress,in_review,blocked,done";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 18) return "Good afternoon.";
  return "Good evening.";
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export interface GoalProgress {
  goal: Goal;
  total: number;
  verified: number;
  completed: number;
  blocked: number;
}

/** Per-goal task counts: done = verified, in_review = completed. */
export function computeGoalProgress(goals: readonly Goal[], issues: readonly Issue[]): GoalProgress[] {
  const byGoal = new Map<string, GoalProgress>();
  for (const goal of goals) {
    if (goal.status === "cancelled" || goal.status === "achieved") continue;
    byGoal.set(goal.id, { goal, total: 0, verified: 0, completed: 0, blocked: 0 });
  }
  for (const issue of issues) {
    const entry = issue.goalId ? byGoal.get(issue.goalId) : undefined;
    if (!entry || issue.status === "cancelled") continue;
    entry.total += 1;
    if (issue.status === "done") entry.verified += 1;
    else if (issue.status === "in_review") entry.completed += 1;
    else if (issue.status === "blocked") entry.blocked += 1;
  }
  return [...byGoal.values()].filter((entry) => entry.total > 0);
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelMessage({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p role={tone === "error" ? "alert" : undefined} className={cn("px-4 py-4 text-sm", tone === "error" ? "text-bad" : "text-muted-foreground")}>
      {children}
    </p>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone,
  href,
}: {
  label: string;
  value: number | null;
  detail: string;
  icon: ReactNode;
  tone: "warn" | "info" | "ok" | "bad";
  href: string;
}) {
  const toneText = { warn: "text-warn", info: "text-info", ok: "text-ok", bad: "text-bad" }[tone];
  return (
    <Link
      to={href}
      className={cn(
        "block rounded-xl border bg-card px-4 py-3.5 text-foreground no-underline transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "bad" && (value ?? 0) > 0 ? "border-bad/30" : "border-border",
      )}
    >
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", toneText)}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums" aria-live="polite">
        {value === null ? "—" : value}
      </div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </Link>
  );
}

function agentStatusLine(agent: Agent): string {
  if (agent.status === "paused" && agent.pauseReason) return `Paused: ${agent.pauseReason.replace(/_/g, " ")}`;
  return agent.title ?? agent.role;
}

export function CommandCenter() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialogActions();
  const companyId = selectedCompanyId ?? "";
  const enabled = !!selectedCompanyId;

  useEffect(() => {
    setBreadcrumbs([{ label: "Home" }]);
  }, [setBreadcrumbs]);

  const summary = useQuery({
    queryKey: queryKeys.dashboard(companyId),
    queryFn: () => dashboardApi.summary(companyId),
    enabled,
  });
  const approvals = useQuery({
    queryKey: queryKeys.approvals.list(companyId, "pending"),
    queryFn: () => approvalsApi.list(companyId, "pending"),
    enabled,
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled,
  });
  const liveRuns = useQuery({
    queryKey: queryKeys.liveRuns(companyId),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
    enabled,
  });
  const goals = useQuery({
    queryKey: queryKeys.goals.list(companyId),
    queryFn: () => goalsApi.list(companyId),
    enabled,
  });
  const issues = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "command-center", ACTIVE_ISSUE_STATUSES],
    queryFn: () =>
      issuesApi.list(companyId, {
        status: ACTIVE_ISSUE_STATUSES,
        limit: COMMAND_CENTER_ISSUE_LIMIT,
        sortField: "updated",
        sortDir: "desc",
      }),
    enabled,
  });

  const ceoAgent = findCeoAgent(agents.data);
  const pendingApprovals: Approval[] = approvals.data ?? [];
  const runningAgentIds = useMemo(() => new Set((liveRuns.data ?? []).map((run) => run.agentId)), [liveRuns.data]);
  const awaitingVerification = (issues.data ?? []).filter((issue) => issue.status === "in_review");
  const recentlyVerified = (issues.data ?? []).filter((issue) => issue.status === "done").slice(0, 4);
  const blockedTasks = summary.data?.tasks.blocked ?? null;
  const erroredAgents = summary.data?.agents.error ?? null;
  const failedOrBlocked = blockedTasks === null || erroredAgents === null ? null : blockedTasks + erroredAgents;
  const goalProgress = useMemo(
    () => computeGoalProgress(goals.data ?? [], issues.data ?? []),
    [goals.data, issues.data],
  );
  const issuesTruncated = (issues.data?.length ?? 0) >= COMMAND_CENTER_ISSUE_LIMIT;
  const visibleAgents = (agents.data ?? []).filter((agent) => agent.status !== "terminated");
  const sortedAgents = [...visibleAgents].sort((a, b) => {
    const rank = (agent: Agent) => (runningAgentIds.has(agent.id) || agent.status === "running" ? 0 : executionStateForAgent(agent.status) ? 1 : 2);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  const monthSpend = summary.data?.costs.monthSpendCents ?? null;
  const monthBudget = summary.data?.costs.monthBudgetCents ?? 0;
  const utilization = summary.data?.costs.monthUtilizationPercent ?? 0;

  const decisionLine = approvals.isSuccess
    ? pendingApprovals.length === 0
      ? "Nothing needs your judgment right now."
      : `${plural(pendingApprovals.length, "decision")} ${pendingApprovals.length === 1 ? "needs" : "need"} you.`
    : null;

  if (!selectedCompanyId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Select an organization to see its command center.</div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">{greeting(new Date())}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {selectedCompany?.name ? <span className="font-medium">{selectedCompany.name}</span> : null}
            {selectedCompany?.name && decisionLine ? " · " : null}
            {decisionLine}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewIssue()}>
            New task
          </Button>
          {ceoAgent ? (
            <Button asChild>
              <Link to="/ceo-workspace">Ask the CEO</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Needs your judgment"
          value={approvals.isSuccess ? pendingApprovals.length : null}
          detail={
            pendingApprovals.length > 0
              ? `pending approvals · oldest ${timeAgo(pendingApprovals.reduce((oldest, item) => (new Date(item.createdAt) < new Date(oldest.createdAt) ? item : oldest)).createdAt)}`
              : "pending approvals"
          }
          icon={<AlertTriangle className="size-3.5" aria-hidden="true" />}
          tone="warn"
          href="/approvals/pending"
        />
        <Metric
          label="Running"
          value={liveRuns.isSuccess ? liveRuns.data.length : null}
          detail={`live runs · ${plural(runningAgentIds.size, "agent")}`}
          icon={<Play className="size-3.5" aria-hidden="true" />}
          tone="info"
          href="/dashboard/live"
        />
        <Metric
          label="Awaiting verification"
          value={issues.isSuccess ? awaitingVerification.length : null}
          detail="completed, not yet verified"
          icon={<Hourglass className="size-3.5" aria-hidden="true" />}
          tone="ok"
          href="/issues"
        />
        <Metric
          label="Failed or blocked"
          value={failedOrBlocked}
          detail={
            summary.isSuccess
              ? `${plural(erroredAgents ?? 0, "agent")} in error · ${plural(blockedTasks ?? 0, "blocked task")}`
              : "agents in error · blocked tasks"
          }
          icon={<AlertTriangle className="size-3.5" aria-hidden="true" />}
          tone="bad"
          href="/issues"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Panel
            title="Needs your judgment"
            action={
              <Link to="/approvals/pending" className="text-xs text-info">
                Open approvals
              </Link>
            }
          >
            {approvals.isError ? (
              <PanelMessage tone="error">Couldn't load approvals. {(approvals.error as Error).message}</PanelMessage>
            ) : approvals.isPending ? (
              <PanelMessage>Loading approvals…</PanelMessage>
            ) : pendingApprovals.length === 0 ? (
              <PanelMessage>No approvals are waiting. Protected actions will appear here before they run.</PanelMessage>
            ) : (
              <ul className="divide-y divide-border">
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <li key={approval.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {approvalSubject(approval.payload) ?? approvalLabel(approval.type, approval.payload)}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {approvalLabel(approval.type, approval.payload)} · requested {timeAgo(approval.createdAt)}
                      </div>
                    </div>
                    <ExecutionStateBadge state="requested" />
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/approvals/${approval.id}`}>Review</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Objectives"
            action={
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-sm bg-ok" /> Verified
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-sm bg-brand-cobalt" /> Completed
                </span>
              </div>
            }
          >
            {goals.isError || issues.isError ? (
              <PanelMessage tone="error">Couldn't load objectives.</PanelMessage>
            ) : goals.isPending || issues.isPending ? (
              <PanelMessage>Loading objectives…</PanelMessage>
            ) : goalProgress.length === 0 ? (
              <PanelMessage>
                No active goals with tasks yet. <Link to="/goals" className="text-info">Set a goal</Link> and link tasks to it to track progress here.
              </PanelMessage>
            ) : (
              <ul className="flex flex-col gap-4 px-4 py-4">
                {goalProgress.slice(0, 5).map(({ goal, total, verified, completed, blocked }) => (
                  <li key={goal.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Link to={`/goals/${goal.id}`} className="truncate text-sm font-medium text-foreground">
                        {goal.title}
                      </Link>
                      <span className={cn("shrink-0 text-xs tabular-nums", blocked > 0 ? "text-bad" : "text-muted-foreground")}>
                        {verified} of {total} tasks verified{blocked > 0 ? ` · ${blocked} blocked` : ""}
                      </span>
                    </div>
                    <div
                      className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${verified} verified and ${completed} completed of ${total} tasks`}
                    >
                      <div className="bg-ok" style={{ width: `${(verified / total) * 100}%` }} />
                      <div className="bg-brand-cobalt" style={{ width: `${(completed / total) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {issuesTruncated ? (
                  <li className="text-xs text-muted-foreground">
                    Based on the {COMMAND_CENTER_ISSUE_LIMIT} most recently updated tasks.
                  </li>
                ) : null}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Agents"
            action={
              agents.isSuccess ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {runningAgentIds.size} running · {visibleAgents.length} total
                </span>
              ) : null
            }
          >
            {agents.isError ? (
              <PanelMessage tone="error">Couldn't load agents.</PanelMessage>
            ) : agents.isPending ? (
              <PanelMessage>Loading agents…</PanelMessage>
            ) : sortedAgents.length === 0 ? (
              <PanelMessage>
                No agents yet. <Link to="/agents/new" className="text-info">Hire your first agent</Link>.
              </PanelMessage>
            ) : (
              <ul className="divide-y divide-border">
                {sortedAgents.slice(0, 6).map((agent) => {
                  const state = runningAgentIds.has(agent.id) ? "running" : executionStateForAgent(agent.status);
                  return (
                    <li key={agent.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link to={`/agents/${agent.id}`} className="block truncate text-sm font-medium text-foreground">
                          {agent.name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">{agentStatusLine(agent)}</div>
                      </div>
                      {state ? (
                        <ExecutionStateBadge state={state} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Idle</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Budget · this month"
            action={
              monthSpend !== null ? (
                <span className="text-sm tabular-nums">
                  <strong>{formatCents(monthSpend)}</strong>
                  {monthBudget > 0 ? <span className="text-muted-foreground"> of {formatCents(monthBudget)}</span> : null}
                </span>
              ) : null
            }
          >
            {summary.isError ? (
              <PanelMessage tone="error">Couldn't load spend.</PanelMessage>
            ) : summary.isPending ? (
              <PanelMessage>Loading spend…</PanelMessage>
            ) : monthBudget > 0 ? (
              <div className="px-4 py-4">
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Monthly budget used"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(utilization)}
                >
                  <div
                    className={cn("h-full", utilization >= 100 ? "bg-brand-accent" : "bg-brand-cobalt")}
                    style={{ width: `${Math.min(100, utilization)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{Math.round(utilization)}% used</span>
                  <Link to="/costs" className="text-info">
                    Costs
                  </Link>
                </div>
              </div>
            ) : (
              <PanelMessage>
                No monthly budget set. <Link to="/costs" className="text-info">Set one in Costs</Link> to get a hard stop.
              </PanelMessage>
            )}
          </Panel>

          <section className="rounded-2xl bg-ok-bg px-4 py-3.5" aria-label="Recently verified">
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              <CircleCheck className="size-4 text-ok" aria-hidden="true" />
              Recently verified
            </h2>
            {issues.isError ? (
              <p role="alert" className="mt-2 text-sm text-bad">Couldn't load tasks.</p>
            ) : recentlyVerified.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">{issues.isPending ? "Loading…" : "No verified tasks yet."}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {recentlyVerified.map((issue) => (
                  <li key={issue.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link to={`/issues/${issue.identifier ?? issue.id}`} className="min-w-0 truncate text-foreground">
                      {issue.title}
                    </Link>
                    <span className="shrink-0 text-xs text-ok">{timeAgo(issue.updatedAt)}</span>
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
