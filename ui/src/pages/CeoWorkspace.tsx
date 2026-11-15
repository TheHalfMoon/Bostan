import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import type { Approval } from "@bostan/shared";
import { Link, useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { executionStateFromAgent } from "../lib/execution-state";
import {
  askCeoTaskDraft,
  assignedAgents,
  findCeoAgent,
  objectiveApprovals,
  objectiveRail,
  planSteps,
  planSummary,
} from "../lib/ceo-workspace";
import { approvalLabel } from "../components/ApprovalPayload";
import { BostanAppIcon } from "../components/brand/BostanMark";
import { ExecutionStateBadge } from "../components/ExecutionStateBadge";

function PanelHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/**
 * CEO / Chief of Staff workspace (CEO-Workspace artboard): pick an objective,
 * see its plan as tasks with execution states, decide the protected actions
 * waiting on it, and hand the CEO agent new work. Every value comes from the
 * goals, tasks, agents and approvals APIs.
 */
export function CeoWorkspace() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId!;
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewGoal, openNewIssue, openNewAgent } = useDialogActions();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "CEO · Chief of Staff" }]);
  }, [setBreadcrumbs]);

  const agentsQuery = useQuery({ queryKey: queryKeys.agents.list(companyId), queryFn: () => agentsApi.list(companyId), enabled: !!selectedCompanyId });
  const goalsQuery = useQuery({ queryKey: queryKeys.goals.list(companyId), queryFn: () => goalsApi.list(companyId), enabled: !!selectedCompanyId });
  const issuesQuery = useQuery({ queryKey: queryKeys.issues.list(companyId), queryFn: () => issuesApi.list(companyId), enabled: !!selectedCompanyId });
  const approvalsQuery = useQuery({
    queryKey: queryKeys.approvals.list(companyId, "pending"),
    queryFn: () => approvalsApi.list(companyId, "pending"),
    enabled: !!selectedCompanyId,
  });
  const pending = approvalsQuery.data;
  const approvalIssueQueries = useQueries({
    queries: (pending ?? []).map((approval) => ({
      queryKey: queryKeys.approvals.issues(approval.id),
      queryFn: () => approvalsApi.listIssues(approval.id),
    })),
  });
  const linkedIssues = useMemo(
    () => new Map((pending ?? []).map((approval, index) => [approval.id, approvalIssueQueries[index]?.data ?? []])),
    [pending, approvalIssueQueries],
  );

  const agents = agentsQuery.data;
  const issues = issuesQuery.data;
  const ceo = findCeoAgent(agents);
  const rail = objectiveRail(goalsQuery.data, issues);
  const requestedId = searchParams.get("objective");
  const selected =
    [...rail.open, ...rail.earlier].find((entry) => entry.goal.id === requestedId)?.goal ?? rail.open[0]?.goal ?? rail.earlier[0]?.goal ?? null;
  const steps = selected ? planSteps(selected.id, issues, agents) : [];
  const summary = planSummary(steps);
  const assigned = selected ? assignedAgents(selected.id, issues, agents) : [];
  const approvals = selected ? objectiveApprovals(selected.id, pending, linkedIssues) : [];
  const owner = selected?.ownerAgentId ? agents?.find((agent) => agent.id === selected.ownerAgentId) : null;

  const invalidateApprovals = (approval: Approval) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(companyId, "pending") });
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.detail(approval.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
  };
  const decide = useMutation({
    mutationFn: ({ approval, decision }: { approval: Approval; decision: "approve" | "revise" | "reject" }) =>
      decision === "approve"
        ? approvalsApi.approve(approval.id)
        : decision === "revise"
          ? approvalsApi.requestRevision(approval.id)
          : approvalsApi.reject(approval.id),
    onSuccess: (_result, { approval }) => invalidateApprovals(approval),
  });

  function selectObjective(goalId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("objective", goalId);
    setSearchParams(next, { replace: true });
  }

  function askCeo() {
    const task = askCeoTaskDraft(draft);
    if (!task || !ceo || !selected) return;
    // The CEO gets real work through the normal task flow; the person confirms it in the dialog.
    openNewIssue({ ...task, goalId: selected.id, assigneeAgentId: ceo.id });
    setDraft("");
  }

  const loading = goalsQuery.isLoading || issuesQuery.isLoading || agentsQuery.isLoading;
  const loadError = goalsQuery.error ?? issuesQuery.error ?? agentsQuery.error;
  const protectedAction = approvals[0] ?? null;

  return (
    <div data-testid="ceo-workspace" className="flex min-h-full flex-col overflow-hidden rounded-xl border border-border bg-background lg:flex-row">
      {/* Objectives rail */}
      <nav aria-label="Objectives" className="flex shrink-0 flex-col gap-1 border-b border-border bg-chrome p-3 lg:w-60 lg:border-r lg:border-b-0">
        <Button variant="outline" className="mb-3 w-full justify-center" onClick={() => openNewGoal()}>
          <Plus className="size-4" aria-hidden="true" />
          New objective
        </Button>
        <PanelHeading>Objectives</PanelHeading>
        {goalsQuery.error ? (
          <p role="alert" className="px-2 text-sm text-destructive">Couldn't load objectives.</p>
        ) : goalsQuery.isLoading ? (
          <Notice>Loading…</Notice>
        ) : rail.open.length === 0 ? (
          <Notice>No open objectives.</Notice>
        ) : (
          rail.open.map((entry) => (
            <button
              key={entry.goal.id}
              type="button"
              aria-current={selected?.id === entry.goal.id ? "true" : undefined}
              onClick={() => selectObjective(entry.goal.id)}
              data-accent-surface={selected?.id === entry.goal.id ? "" : undefined}
              className={cn(
                "rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                selected?.id === entry.goal.id && "bg-sage",
              )}
            >
              <span className="block truncate text-sm font-semibold">{entry.goal.title}</span>
              <span className={cn("block truncate text-xs", entry.tone === "bad" ? "text-bad" : "text-muted-foreground")}>{entry.detail}</span>
            </button>
          ))
        )}
        {rail.earlier.length > 0 ? (
          <>
            <div className="mt-4">
              <PanelHeading>Earlier</PanelHeading>
            </div>
            {rail.earlier.map((entry) => (
              <button
                key={entry.goal.id}
                type="button"
                aria-current={selected?.id === entry.goal.id ? "true" : undefined}
                onClick={() => selectObjective(entry.goal.id)}
                className={cn(
                  "truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                  selected?.id === entry.goal.id && "bg-sage",
                )}
              >
                {entry.goal.title}
              </button>
            ))}
          </>
        ) : null}
      </nav>

      {/* Plan and composer */}
      <section className="flex min-w-0 flex-1 flex-col">
        {loadError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-destructive">Couldn't load this workspace. {loadError.message}</p>
          </div>
        ) : loading ? (
          <div className="p-6">
            <Notice>Loading workspace…</Notice>
          </div>
        ) : !selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
            <BostanAppIcon title="" className="size-12" />
            <h1 className="font-serif text-3xl font-semibold">No objectives yet</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Objectives group the work toward one outcome. Create one, then ask the CEO to plan it.
            </p>
            <Button onClick={() => openNewGoal()}>New objective</Button>
          </div>
        ) : (
          <>
            <header className="border-b border-border px-6 py-4">
              <h1 className="font-serif text-3xl font-semibold tracking-tight">{selected.title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Objective · {selected.status} · owner: {owner?.name ?? "you"}
                {ceo ? ` · ${ceo.name} coordinating` : ""}
              </p>
              {selected.description ? <p className="mt-2 max-w-2xl text-sm text-ink-2">{selected.description}</p> : null}
            </header>

            <div className="flex-1 px-6 py-5">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-widest">
                    Execution plan · {summary.steps} {summary.steps === 1 ? "step" : "steps"}
                  </h2>
                  <Link to={`/goals/${selected.id}`} className="text-xs text-accent-text underline underline-offset-2">
                    Open objective
                  </Link>
                </div>
                {steps.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted-foreground">
                    No tasks under this objective yet. Ask the CEO below to break it into a plan.
                  </p>
                ) : (
                  <ol className="divide-y divide-border">
                    {steps.map((step) => (
                      <li key={step.issue.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span data-numeric className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                          {String(step.index).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link to={`/issues/${step.issue.identifier ?? step.issue.id}`} className="block truncate text-sm font-medium text-foreground no-underline hover:underline">
                            {step.issue.title}
                          </Link>
                          <span className="block truncate text-xs text-muted-foreground">{step.assignee}</span>
                        </div>
                        {step.state ? <ExecutionStateBadge state={step.state} /> : <span className="text-xs text-muted-foreground">Cancelled</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <div className="border-t border-border px-6 py-4">
              {ceo ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    askCeo();
                  }}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <label htmlFor="ask-ceo" className="sr-only">
                    Ask {ceo.name}
                  </label>
                  <textarea
                    id="ask-ceo"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    placeholder={`Ask ${ceo.name}, redirect, or request a correction…`}
                    className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Creates a task for {ceo.name} under this objective. You confirm it before it is sent.</span>
                    <Button type="submit" size="sm" disabled={!askCeoTaskDraft(draft)}>
                      Ask the CEO
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong p-4">
                  <p className="text-sm text-muted-foreground">There is no CEO agent in this company yet, so nobody coordinates objectives.</p>
                  <Button variant="outline" onClick={() => openNewAgent()}>
                    Hire a CEO
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Decision and status panel */}
      {selected ? (
        <aside aria-label="Objective details" className="flex shrink-0 flex-col gap-6 border-t border-border bg-surface p-4 lg:w-80 lg:border-t-0 lg:border-l">
          <section>
            {approvalsQuery.error ? (
              <p role="alert" className="text-sm text-destructive">Couldn't load approvals.</p>
            ) : protectedAction ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-warn">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Protected action
                </div>
                <h2 className="font-display text-lg font-semibold leading-snug">{approvalLabel(protectedAction.type, protectedAction.payload)}</h2>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Requested by</dt>
                    <dd className="font-medium">
                      {protectedAction.requestedByAgentId
                        ? agents?.find((agent) => agent.id === protectedAction.requestedByAgentId)?.name ?? "Agent"
                        : "Person"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Waiting</dt>
                    <dd className="font-medium">{timeAgo(protectedAction.createdAt)}</dd>
                  </div>
                </dl>
                <Button
                  onClick={() => decide.mutate({ approval: protectedAction, decision: "approve" })}
                  disabled={decide.isPending}
                >
                  Approve this scope
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => decide.mutate({ approval: protectedAction, decision: "revise" })} disabled={decide.isPending}>
                    Request changes
                  </Button>
                  <Button
                    variant="outline"
                    className="text-bad"
                    onClick={() => decide.mutate({ approval: protectedAction, decision: "reject" })}
                    disabled={decide.isPending}
                  >
                    Reject
                  </Button>
                </div>
                {decide.error ? <p role="alert" className="text-xs text-destructive">{decide.error.message}</p> : null}
                <Link to={`/approvals/${protectedAction.id}`} className="text-xs text-accent-text underline underline-offset-2">
                  Open full approval{approvals.length > 1 ? ` · ${approvals.length - 1} more waiting` : ""}
                </Link>
              </div>
            ) : (
              <>
                <PanelHeading>Protected actions</PanelHeading>
                <Notice>Nothing in this objective is waiting for your approval.</Notice>
              </>
            )}
          </section>

          <section>
            <PanelHeading>Plan summary</PanelHeading>
            <dl data-numeric className="flex flex-col gap-1.5 text-sm">
              {[
                ["Steps", summary.steps],
                ["Completed", summary.completed],
                ["In review", summary.inReview],
                ["Running", summary.running],
                ["Blocked", summary.blocked],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("font-medium", label === "Blocked" && Number(value) > 0 && "text-bad")}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <PanelHeading>Assigned</PanelHeading>
            {assigned.length === 0 ? (
              <Notice>No agents are assigned to this objective's tasks yet.</Notice>
            ) : (
              <ul className="flex flex-col gap-2">
                {assigned.map((agent) => {
                  const state = executionStateFromAgent(agent.status);
                  return (
                    <li key={agent.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <Link to={`/agents/${agent.id}`} className="truncate text-sm text-foreground no-underline hover:underline">
                        {agent.name}
                      </Link>
                      {state ? <ExecutionStateBadge state={state} /> : <span className="text-xs text-muted-foreground">Idle</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      ) : null}
    </div>
  );
}
