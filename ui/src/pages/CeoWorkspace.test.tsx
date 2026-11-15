// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CeoWorkspace } from "./CeoWorkspace";

const api = vi.hoisted(() => ({
  agents: { list: vi.fn() },
  goals: { list: vi.fn() },
  issues: { list: vi.fn() },
  approvals: { list: vi.fn(), listIssues: vi.fn(), approve: vi.fn(), reject: vi.fn(), requestRevision: vi.fn() },
}));
const dialog = vi.hoisted(() => ({ openNewGoal: vi.fn(), openNewIssue: vi.fn(), openNewAgent: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams(), set: vi.fn() }));

vi.mock("../api/agents", () => ({ agentsApi: api.agents }));
vi.mock("../api/goals", () => ({ goalsApi: api.goals }));
vi.mock("../api/issues", () => ({ issuesApi: api.issues }));
vi.mock("../api/approvals", () => ({ approvalsApi: api.approvals }));
vi.mock("../context/DialogContext", () => ({ useDialogActions: () => dialog }));
vi.mock("../context/CompanyContext", () => ({ useCompany: () => ({ selectedCompanyId: "c1" }) }));
vi.mock("../context/BreadcrumbContext", () => ({ useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }) }));
vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useSearchParams: () => [search.params, search.set],
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const agents = [
  { id: "ceo", name: "Chief", role: "ceo", status: "running" },
  { id: "r1", name: "Research", role: "researcher", status: "running" },
  { id: "p1", name: "Procurement", role: "general", status: "paused" },
];
const goals = [
  { id: "g1", title: "Q1 supplier program", status: "active", description: null, ownerAgentId: "ceo", updatedAt: "2026-11-14" },
  { id: "g2", title: "Close November books", status: "active", description: null, ownerAgentId: null, updatedAt: "2026-11-13" },
];
const issues = [
  { id: "i1", identifier: "BOS-1", title: "Build long list", status: "done", goalId: "g1", assigneeAgentId: "r1", assigneeUserId: null, createdAt: "2026-11-01" },
  { id: "i2", identifier: "BOS-2", title: "Score vendors", status: "in_progress", goalId: "g1", assigneeAgentId: "r1", assigneeUserId: null, createdAt: "2026-11-02" },
  { id: "i3", identifier: "BOS-3", title: "Email top 3 for quotes", status: "blocked", goalId: "g1", assigneeAgentId: "p1", assigneeUserId: null, createdAt: "2026-11-03" },
  { id: "i4", identifier: "BOS-4", title: "Bank export", status: "blocked", goalId: "g2", assigneeAgentId: null, assigneeUserId: null, createdAt: "2026-11-03" },
];
const pending = [
  { id: "ap1", type: "request_board_approval", payload: { title: "Email 3 packaging suppliers" }, requestedByAgentId: "p1", status: "pending", createdAt: new Date() },
  { id: "ap2", type: "request_board_approval", payload: { title: "Unrelated" }, requestedByAgentId: "r1", status: "pending", createdAt: new Date() },
];

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("CeoWorkspace", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    search.params = new URLSearchParams();
    api.agents.list.mockResolvedValue(agents);
    api.goals.list.mockResolvedValue(goals);
    api.issues.list.mockResolvedValue(issues);
    api.approvals.list.mockResolvedValue(pending);
    api.approvals.listIssues.mockImplementation(async (id: string) => (id === "ap1" ? [issues[2]] : [issues[3]]));
    api.approvals.approve.mockResolvedValue({});
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function render() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <CeoWorkspace />
        </QueryClientProvider>,
      );
    });
    await settle();
    return root;
  }

  it("shows the first objective's plan, its protected action, summary and assigned agents", async () => {
    const root = await render();
    const text = container.textContent ?? "";
    expect(container.querySelector("h1")?.textContent).toBe("Q1 supplier program");
    expect(text).toContain("owner: Chief · Chief coordinating");
    expect(text).toContain("Execution plan · 3 steps");
    const states = [...container.querySelectorAll("ol [data-execution-state]")].map((n) => n.getAttribute("data-execution-state"));
    expect(states).toEqual(["completed", "running", "blocked"]);
    expect(text).toContain("Blocked · 1 task");
    // Only the approval linked to this objective's tasks is shown.
    expect(text).toContain("Board Approval: Email 3 packaging suppliers");
    expect(text).not.toContain("Unrelated");
    expect(text).toContain("Requested byProcurement");
    expect([...container.querySelectorAll("aside li")].map((li) => li.textContent)).toEqual(["ProcurementBlocked", "ResearchRunning"]);
    act(() => root.unmount());
  });

  it("decides the protected action through the approvals API", async () => {
    const root = await render();
    const approve = [...container.querySelectorAll("button")].find((b) => b.textContent === "Approve this scope") as HTMLButtonElement;
    await act(async () => {
      approve.click();
    });
    await settle();
    expect(api.approvals.approve).toHaveBeenCalledWith("ap1");
    expect(api.approvals.reject).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("hands the CEO a task under the objective through the confirmed task dialog", async () => {
    const root = await render();
    const textarea = container.querySelector("textarea")!;
    const submit = [...container.querySelectorAll("button")].find((b) => b.textContent === "Ask the CEO") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(textarea, "Find three suppliers\nUnder $5");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(submit.disabled).toBe(false);
    await act(async () => {
      submit.click();
    });
    expect(dialog.openNewIssue).toHaveBeenCalledWith({
      title: "Find three suppliers",
      description: "Find three suppliers\nUnder $5",
      goalId: "g1",
      assigneeAgentId: "ceo",
    });
    act(() => root.unmount());
  });

  it("follows the objective in the URL", async () => {
    search.params = new URLSearchParams("objective=g2");
    const root = await render();
    expect(container.querySelector("h1")?.textContent).toBe("Close November books");
    // ap2 is linked to this objective's task, ap1 is not.
    expect(container.textContent).toContain("Board Approval: Unrelated");
    expect(container.textContent).not.toContain("Email 3 packaging suppliers");
    expect(container.textContent).toContain("No agents are assigned to this objective's tasks yet.");
    act(() => root.unmount());
  });

  it("says when nothing in the objective waits for approval", async () => {
    api.approvals.listIssues.mockResolvedValue([]);
    const root = await render();
    expect(container.textContent).toContain("Nothing in this objective is waiting for your approval.");
    expect([...container.querySelectorAll("button")].some((b) => b.textContent === "Approve this scope")).toBe(false);
    act(() => root.unmount());
  });

  it("offers to hire a CEO when there is none, and to create a first objective", async () => {
    api.agents.list.mockResolvedValue(agents.filter((a) => a.role !== "ceo"));
    let root = await render();
    expect(container.textContent).toContain("There is no CEO agent in this company yet");
    act(() => (([...container.querySelectorAll("button")].find((b) => b.textContent === "Hire a CEO")) as HTMLButtonElement).click());
    expect(dialog.openNewAgent).toHaveBeenCalled();
    act(() => root.unmount());

    api.goals.list.mockResolvedValue([]);
    root = await render();
    expect(container.querySelector("h1")?.textContent).toBe("No objectives yet");
    act(() => root.unmount());
  });

  it("reports a load failure", async () => {
    api.goals.list.mockRejectedValue(new Error("boom"));
    const root = await render();
    expect([...container.querySelectorAll('[role="alert"]')].map((n) => n.textContent)).toContain("Couldn't load objectives.");
    act(() => root.unmount());
  });
});
