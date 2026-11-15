// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Approval, DashboardSummary, Goal, Issue } from "@bostan/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandCenter } from "./CommandCenter";

const mockApprovals = vi.hoisted(() => ({ list: vi.fn() }));
const mockGoals = vi.hoisted(() => ({ list: vi.fn() }));
const mockDialog = vi.hoisted(() => ({ openNewIssue: vi.fn(), openNewGoal: vi.fn() }));

vi.mock("@/api/approvals", () => ({ approvalsApi: mockApprovals }));
vi.mock("@/api/goals", () => ({ goalsApi: mockGoals }));
vi.mock("@/context/DialogContext", () => ({ useDialogActions: () => mockDialog }));
vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 10, 15, 9, 0, 0);

const summary = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  companyId: "c1",
  agents: { active: 1, running: 1, paused: 0, error: 1 },
  tasks: { open: 2, inProgress: 1, blocked: 1, done: 1 },
  costs: { monthSpendCents: 41280, monthBudgetCents: 60000, monthUtilizationPercent: 68.8 },
  pendingApprovals: 1,
  budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [],
  ...overrides,
});

const agents = [
  { id: "a1", name: "Procurement", title: "Buyer", role: "general", status: "error" },
  { id: "a2", name: "Research", title: null, role: "researcher", status: "running" },
] as unknown as Agent[];

const issues = [
  { id: "i1", identifier: "BOS-1", title: "Supplier shortlist", status: "done", goalId: "g1", completedAt: new Date(2026, 10, 14) },
  { id: "i2", identifier: "BOS-2", title: "Quote review", status: "in_review", goalId: "g1", completedAt: null },
  { id: "i3", identifier: "BOS-3", title: "Bank export", status: "blocked", goalId: null, completedAt: null },
] as unknown as Issue[];

describe("CommandCenter", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockApprovals.list.mockReset();
    mockGoals.list.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function render(props: Partial<Parameters<typeof CommandCenter>[0]> = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <CommandCenter companyId="c1" summary={summary()} agents={agents} issues={issues} now={NOW} {...props} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return root;
  }

  it("renders real counts, approvals, objectives, agents, budget and completed work", async () => {
    mockApprovals.list.mockResolvedValue([
      { id: "ap1", type: "hire_agent", payload: { name: "Designer" }, requestedByAgentId: "a2", status: "pending", createdAt: new Date(2026, 10, 15, 7) },
    ] as unknown as Approval[]);
    mockGoals.list.mockResolvedValue([{ id: "g1", title: "Launch supplier program", status: "active" }] as unknown as Goal[]);
    const root = await render();
    const text = container.textContent ?? "";

    expect(mockApprovals.list).toHaveBeenCalledWith("c1", "pending");
    expect(container.querySelector("h1")?.textContent).toBe("Good morning.");
    expect(text).toContain("1 decision needs you; 2 items are failed or blocked.");
    // Tiles
    expect(text).toContain("Needs your judgment");
    expect(text).toContain("1 approval · oldest");
    expect(text).toContain("completed, not yet verified");
    expect(text).toContain("1 agent error · 1 blocked task");
    // Approval row links to its review page
    expect(container.querySelector('a[href="/approvals/ap1"]')?.textContent).toBe("Review");
    expect(text).toContain("Hire Agent: Designer");
    expect(text).toContain("Research · requested");
    // Objective progress from its own tasks
    expect(text).toContain("Launch supplier program");
    expect(text).toContain("1 of 2 tasks completed");
    // Agents with execution states; errors first
    const states = [...container.querySelectorAll("[data-execution-state]")].map((node) => node.getAttribute("data-execution-state"));
    expect(states).toEqual(["failed", "running"]);
    // Budget
    expect(text).toContain("Budget · November");
    expect(text).toContain("$412.80");
    expect(text).toContain("16 days left");
    // Completed (never labelled verified)
    expect(text).toContain("Recently completed");
    expect(text).toContain("Supplier shortlist");
    expect(text).not.toContain("Recently verified");
    act(() => root.unmount());
  });

  it("shows empty states instead of invented data", async () => {
    mockApprovals.list.mockResolvedValue([]);
    mockGoals.list.mockResolvedValue([]);
    const root = await render({
      summary: summary({ pendingApprovals: 0, agents: { active: 0, running: 0, paused: 0, error: 0 }, tasks: { open: 0, inProgress: 0, blocked: 0, done: 0 }, costs: { monthSpendCents: 0, monthBudgetCents: 0, monthUtilizationPercent: 0 } }),
      agents: [],
      issues: [],
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Nothing needs you right now.");
    expect(text).toContain("Nothing is waiting for your approval.");
    expect(text).toContain("No open objectives yet.");
    expect(text).toContain("No agents yet.");
    expect(text).toContain("No monthly budget is set.");
    expect(text).toContain("No completed tasks yet.");
    expect(container.querySelector("[data-execution-state]")).toBeNull();
    act(() => root.unmount());
  });

  it("reports API failures instead of hiding them", async () => {
    mockApprovals.list.mockRejectedValue(new Error("boom"));
    mockGoals.list.mockRejectedValue(new Error("boom"));
    const root = await render();
    const alerts = [...container.querySelectorAll('[role="alert"]')].map((node) => node.textContent);
    expect(alerts).toEqual(["Couldn't load approvals.", "Couldn't load objectives."]);
    act(() => root.unmount());
  });

  it("starts objectives and tasks from the header actions", async () => {
    mockApprovals.list.mockResolvedValue([]);
    mockGoals.list.mockResolvedValue([]);
    const root = await render();
    const buttons = [...container.querySelectorAll("header button")];
    act(() => (buttons.find((b) => b.textContent === "New objective") as HTMLButtonElement).click());
    act(() => (buttons.find((b) => b.textContent === "New task") as HTMLButtonElement).click());
    expect(mockDialog.openNewGoal).toHaveBeenCalledTimes(1);
    expect(mockDialog.openNewIssue).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
