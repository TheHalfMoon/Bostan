import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Approval, DashboardSummary, Goal, Issue } from "@bostan/shared";
import { CommandCenter } from "@/components/command-center/CommandCenter";
import { queryKeys } from "@/lib/queryKeys";

/* Storybook fixtures only. In the product every figure comes from the API. */
const COMPANY = "story-company";
const NOW = new Date(2026, 10, 15, 9, 30);
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

const summary: DashboardSummary = {
  companyId: COMPANY,
  agents: { active: 5, running: 2, paused: 1, error: 1 },
  tasks: { open: 11, inProgress: 4, blocked: 1, done: 18 },
  costs: { monthSpendCents: 41280, monthBudgetCents: 60000, monthUtilizationPercent: 68.8 },
  pendingApprovals: 3,
  budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [],
};

const agents = [
  { id: "a1", name: "Procurement", title: "Waiting for your approval", role: "general", status: "paused" },
  { id: "a2", name: "Research", title: "Comparing supplier quotes", role: "researcher", status: "running" },
  { id: "a3", name: "Web", title: "Pricing page draft", role: "engineer", status: "idle" },
  { id: "a4", name: "Finance", title: "Bank export timed out", role: "general", status: "error" },
  { id: "a5", name: "CEO", title: "Coordinating objectives", role: "ceo", status: "running" },
] as unknown as Agent[];

const approvals = [
  { id: "ap1", type: "request_board_approval", payload: { title: "Email 3 packaging suppliers for quotes" }, requestedByAgentId: "a1", status: "pending", createdAt: hoursAgo(2) },
  { id: "ap2", type: "budget_override_required", payload: { title: "Raise Research limit to $250 / month" }, requestedByAgentId: "a5", status: "pending", createdAt: hoursAgo(1) },
  { id: "ap3", type: "request_board_approval", payload: { title: "Publish pricing page draft to staging" }, requestedByAgentId: "a3", status: "pending", createdAt: hoursAgo(0.5) },
] as unknown as Approval[];

const goals = [
  { id: "g1", title: "Launch Q1 supplier program", status: "active" },
  { id: "g2", title: "Ship website v1", status: "active" },
  { id: "g3", title: "Close November books", status: "active" },
] as unknown as Goal[];

const issue = (id: string, title: string, status: string, goalId: string | null, completedHoursAgo?: number) =>
  ({ id, identifier: `BOS-${id}`, title, status, goalId, completedAt: completedHoursAgo === undefined ? null : hoursAgo(completedHoursAgo) }) as unknown as Issue;

const issues = [
  issue("1", "Supplier shortlist (5 vendors)", "done", "g1", 3),
  issue("2", "Score vendors on price and lead time", "done", "g1", 20),
  issue("3", "Email top 3 for written quotes", "todo", "g1"),
  issue("4", "Verify quotes against replies", "in_review", "g1"),
  issue("5", "Homepage copy v3", "done", "g2", 26),
  issue("6", "Pricing page", "in_progress", "g2"),
  issue("7", "Docs page", "todo", "g2"),
  issue("8", "Import bank export", "blocked", "g3"),
  issue("9", "Reconcile October", "done", "g3", 50),
];

function Seeded({ empty = false }: { empty?: boolean }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    queryClient.setQueryData(queryKeys.approvals.list(COMPANY, "pending"), empty ? [] : approvals);
    queryClient.setQueryData(queryKeys.goals.list(COMPANY), empty ? [] : goals);
    return queryClient;
  });
  const emptySummary: DashboardSummary = {
    ...summary,
    agents: { active: 0, running: 0, paused: 0, error: 0 },
    tasks: { open: 0, inProgress: 0, blocked: 0, done: 0 },
    costs: { monthSpendCents: 0, monthBudgetCents: 0, monthUtilizationPercent: 0 },
    pendingApprovals: 0,
  };
  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-background p-6 text-foreground">
        <CommandCenter
          companyId={COMPANY}
          summary={empty ? emptySummary : summary}
          agents={empty ? [] : agents}
          issues={empty ? [] : issues}
          now={NOW}
        />
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  id: "activity-command-center",
  title: "Oversight and operation/Dashboards and audit trails/Command center",
  parameters: {
    layout: "fullscreen",
    paperclip: {
      capabilities: ["activity/overview"],
      status: "current",
      implementation: "production",
      boundary: "fixtures",
      notes: "The shipped CommandCenter with seeded fixture responses for the dashboard summary, approvals, goals, agents and tasks. Empty shows the first-run state.",
    },
  },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;
export const WithActivity: Story = { render: () => <Seeded /> };
export const FirstRun: Story = { render: () => <Seeded empty /> };
