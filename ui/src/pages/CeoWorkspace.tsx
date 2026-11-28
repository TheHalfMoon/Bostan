import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, Approval, Issue } from "@bostan/shared";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { approvalLabel, approvalSubject } from "../components/ApprovalPayload";
import { BostanMark } from "../components/brand/BostanMark";
import { CeoInspectorTabs, type CeoInspectorTab } from "./CeoInspectorTabs";
import { ExecutionStateBadge } from "../components/ExecutionStateBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { findCeoAgent } from "../lib/ceo-agent";
import { executionStateForAgent, executionStateForIssue } from "../lib/execution-state";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";

const CEO_WORK_STATUSES = "backlog,todo,in_progress,in_review,blocked,done";
function ApprovalCard({ approval, requester }: { approval: Approval; requester: string | null }) {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
  };
  const onError = (fallback: string) => (err: unknown) => setError(err instanceof Error ? err.message : fallback);
  // Same endpoints and permission checks as the Approvals page.
  const approve = useMutation({ mutationFn: () => approvalsApi.approve(approval.id), onSuccess: invalidate, onError: onError("Couldn't approve") });
  const reject = useMutation({ mutationFn: () => approvalsApi.reject(approval.id), onSuccess: invalidate, onError: onError("Couldn't reject") });
  const revise = useMutation({
    mutationFn: () => approvalsApi.requestRevision(approval.id),
    onSuccess: invalidate,
    onError: onError("Couldn't request changes"),
  });
  const busy = approve.isPending || reject.isPending || revise.isPending;
  const title = approvalSubject(approval.payload) ?? approvalLabel(approval.type, approval.payload);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-warn">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        PROTECTED ACTION
      </div>
      <h3 className="font-display text-base font-semibold leading-snug">{title}</h3>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium">{approvalLabel(approval.type, approval.payload)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Requested</dt>
          <dd className="font-medium">{timeAgo(approval.createdAt)}</dd>
        </div>
        {requester ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">By</dt>
            <dd className="font-medium">{requester}</dd>
          </div>
        ) : null}
      </dl>
      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button disabled={busy} onClick={() => approve.mutate()}>
          Approve this scope
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => revise.mutate()}>
            Request changes
          </Button>
          <Button variant="outline" className="flex-1 text-bad" disabled={busy} onClick={() => reject.mutate()}>
            Reject
          </Button>
        </div>
        <Link to={`/approvals/${approval.id}`} className="text-center text-xs text-info">
          Full details
        </Link>
      </div>
    </article>
  );
}

function WorkRow({ issue, index }: { issue: Issue; index: number }) {
  const state = executionStateForIssue(issue.status);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <Link to={`/issues/${issue.identifier ?? issue.id}`} className="block truncate text-sm font-medium text-foreground">
          {issue.title}
        </Link>
        <div className="truncate text-xs text-muted-foreground">
          {issue.identifier ? <span className="font-mono">{issue.identifier}</span> : null}
          {issue.identifier ? " · " : null}updated {timeAgo(issue.updatedAt)}
        </div>
      </div>
      {state ? <ExecutionStateBadge state={state} /> : null}
    </li>
  );
}

export function CeoWorkspace() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialogActions();
  const [tab, setTab] = useState<CeoInspectorTab>("approvals");
  const companyId = selectedCompanyId ?? "";
  const enabled = !!selectedCompanyId;

  useEffect(() => {
    setBreadcrumbs([{ label: "CEO workspace" }]);
  }, [setBreadcrumbs]);

  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled,
  });
  const ceo = findCeoAgent(agents.data);
  const ceoWork = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "ceo-workspace", ceo?.id ?? null],
    queryFn: () =>
      issuesApi.list(companyId, {
        assigneeAgentId: ceo!.id,
        status: CEO_WORK_STATUSES,
        limit: 25,
        sortField: "updated",
        sortDir: "desc",
      }),
    enabled: enabled && !!ceo,
  });
  const approvals = useQuery({
    queryKey: queryKeys.approvals.list(companyId, "pending"),
    queryFn: () => approvalsApi.list(companyId, "pending"),
    enabled,
  });
  const liveRuns = useQuery({
    queryKey: queryKeys.liveRuns(companyId),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
    enabled,
  });

  const agentsById = useMemo(() => new Map((agents.data ?? []).map((agent) => [agent.id, agent])), [agents.data]);
  const runningAgentIds = useMemo(() => new Set((liveRuns.data ?? []).map((run) => run.agentId)), [liveRuns.data]);
  const team: Agent[] = (agents.data ?? []).filter((agent) => agent.reportsTo === ceo?.id && agent.status !== "terminated");
  // CEO-requested approvals first, then everything else that is pending.
  const pending = [...(approvals.data ?? [])].sort(
    (a, b) => Number(b.requestedByAgentId === ceo?.id) - Number(a.requestedByAgentId === ceo?.id),
  );
  const work = ceoWork.data ?? [];
  const openWork = work.filter((issue) => issue.status !== "done");
  const ceoState = ceo ? (runningAgentIds.has(ceo.id) ? "running" : executionStateForAgent(ceo.status)) : null;

  if (agents.isError) {
    return (
      <p role="alert" className="p-8 text-sm text-bad">
        Couldn't load agents. {(agents.error as Error).message}
      </p>
    );
  }
  if (agents.isPending) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!ceo) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 px-6 py-12">
        <h1 className="font-display text-2xl font-medium">No CEO agent yet</h1>
        <p className="text-sm text-muted-foreground">
          The CEO workspace coordinates objectives through your CEO agent. Hire an agent with the CEO role to use it.
        </p>
        <Button asChild>
          <Link to="/agents/new">Hire a CEO agent</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary" aria-hidden="true">
              <BostanMark size={22} tone="reversed" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-medium leading-tight">{ceo.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>CEO agent · coordinating {plural(openWork.length, "open task")}</span>
                {ceoState ? <ExecutionStateBadge state={ceoState} /> : <span>Idle</span>}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/agents/${ceo.id}`}>Agent settings</Link>
          </Button>
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 md:px-7">
          <section aria-label="CEO work" className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-chrome px-4 py-2.5 text-xs font-semibold tracking-wider">
              <span>ASSIGNED TO THE CEO · {work.length}</span>
            </div>
            {ceoWork.isError ? (
              <p role="alert" className="px-4 py-4 text-sm text-bad">
                Couldn't load the CEO's tasks.
              </p>
            ) : ceoWork.isPending ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Loading…</p>
            ) : work.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nothing assigned yet. Ask the CEO below to start an objective.
              </p>
            ) : (
              <ol className="divide-y divide-border">
                {work.map((issue, index) => (
                  <WorkRow key={issue.id} issue={issue} index={index} />
                ))}
              </ol>
            )}
          </section>

          <div className="mt-auto flex flex-col gap-2 rounded-xl border border-line-strong bg-card p-3">
            <p className="text-sm text-ink-2">
              Ask, redirect or request a correction. Your request becomes a task assigned to {ceo.name}; anything
              external still waits for your approval.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => openNewIssue({ assigneeAgentId: ceo.id, status: "todo" })}>Ask the CEO</Button>
            </div>
          </div>
        </div>
      </div>

      <aside aria-label="Inspector" className="flex w-full shrink-0 flex-col border-border bg-chrome lg:w-88 lg:border-l">
        <CeoInspectorTabs activeTab={tab} onTabChange={setTab} pendingApprovals={pending.length} teamSize={team.length} />
        {tab === "approvals" ? (
          <div
            role="tabpanel"
            id="ceo-panel-approvals"
            aria-labelledby="ceo-tab-approvals"
            tabIndex={approvals.isPending || approvals.isError || pending.length === 0 ? 0 : undefined}
            className="flex flex-col gap-3 p-4"
          >
            {approvals.isError ? (
              <p role="alert" className="text-sm text-bad">
                Couldn't load approvals.
              </p>
            ) : approvals.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No protected actions are waiting for you.</p>
            ) : (
              pending.slice(0, 5).map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  requester={approval.requestedByAgentId ? agentsById.get(approval.requestedByAgentId)?.name ?? null : null}
                />
              ))
            )}
          </div>
        ) : (
          <div
            role="tabpanel"
            id="ceo-panel-team"
            aria-labelledby="ceo-tab-team"
            tabIndex={team.length === 0 ? 0 : undefined}
            className="flex flex-col gap-2 p-4"
          >
            {team.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agents report to the CEO yet.</p>
            ) : (
              team.map((agent) => {
                const state = runningAgentIds.has(agent.id) ? "running" : executionStateForAgent(agent.status);
                return (
                  <div key={agent.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <Link to={`/agents/${agent.id}`} className="min-w-0 truncate text-sm text-foreground">
                      {agent.name}
                    </Link>
                    {state ? <ExecutionStateBadge state={state} /> : <span className="text-xs text-muted-foreground">Idle</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function plural(count: number, one: string): string {
  return `${count} ${count === 1 ? one : `${one}s`}`;
}
