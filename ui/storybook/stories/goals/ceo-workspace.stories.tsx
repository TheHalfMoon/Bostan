import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/context/CompanyContext";
import { CeoWorkspace } from "@/pages/CeoWorkspace";

/* Storybook fixtures only. In the product every value comes from the goals, tasks, agents and approvals APIs. */
const COMPANY = "company-storybook";
const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

const agents = [
  { id: "ceo", companyId: COMPANY, name: "Chief", role: "ceo", title: "Chief of Staff", status: "running" },
  { id: "research", companyId: COMPANY, name: "Research", role: "researcher", title: null, status: "running" },
  { id: "procurement", companyId: COMPANY, name: "Procurement", role: "general", title: null, status: "paused" },
];
const goals = [
  { id: "g1", companyId: COMPANY, title: "Q1 supplier program", description: "Find three packaging suppliers who can deliver 500 units by January, under $5 per unit.", level: "company", status: "active", parentId: null, ownerAgentId: "ceo", createdAt: ago(200), updatedAt: ago(1) },
  { id: "g2", companyId: COMPANY, title: "Ship website v1", description: null, level: "company", status: "active", parentId: null, ownerAgentId: null, createdAt: ago(300), updatedAt: ago(5) },
  { id: "g3", companyId: COMPANY, title: "Close November books", description: null, level: "company", status: "active", parentId: null, ownerAgentId: null, createdAt: ago(300), updatedAt: ago(8) },
  { id: "g4", companyId: COMPANY, title: "Hiring plan for support", description: null, level: "company", status: "achieved", parentId: null, ownerAgentId: null, createdAt: ago(900), updatedAt: ago(400) },
];
const task = (id: string, title: string, status: string, goalId: string, assigneeAgentId: string | null, createdHoursAgo: number) => ({
  id, companyId: COMPANY, identifier: `BOS-${id}`, title, status, goalId, assigneeAgentId, assigneeUserId: null, createdAt: ago(createdHoursAgo), updatedAt: ago(1), completedAt: status === "done" ? ago(2) : null,
});
const issues = [
  task("11", "Build long list from knowledge base and the web", "done", "g1", "research", 50),
  task("12", "Score 14 vendors on price, lead time, MOQ", "in_progress", "g1", "research", 40),
  task("13", "Email top 3 for written quotes", "blocked", "g1", "procurement", 30),
  task("14", "Verify quotes against replies, recommend one", "todo", "g1", "ceo", 20),
  task("21", "Pricing page", "in_progress", "g2", "research", 30),
  task("31", "Import bank export", "blocked", "g3", null, 10),
];
const approvals = [
  { id: "apr-142", companyId: COMPANY, type: "request_board_approval", payload: { title: "Email 3 packaging suppliers for written quotes" }, requestedByAgentId: "procurement", requestedByUserId: null, status: "pending", decisionNote: null, decidedByUserId: null, decidedAt: null, createdAt: ago(2), updatedAt: ago(2) },
];

function installFixtures() {
  const previous = window.fetch;
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.origin);
    const path = url.pathname;
    const json = (data: unknown) => Response.json(data);
    if (path === `/api/companies/${COMPANY}/agents`) return json(agents);
    if (path === `/api/companies/${COMPANY}/goals`) return json(goals);
    if (path === `/api/companies/${COMPANY}/issues`) return json(issues);
    if (path === `/api/companies/${COMPANY}/approvals`) return json(approvals);
    if (path === "/api/approvals/apr-142/issues") return json([issues[2]]);
    return previous(input, init);
  };
  return () => {
    window.fetch = previous;
  };
}

function Workspace() {
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = installFixtures();
    queryClient.removeQueries();
    setSelectedCompanyId(COMPANY);
    setReady(true);
    return restore;
  }, [queryClient, setSelectedCompanyId]);
  if (!ready || selectedCompanyId !== COMPANY) return null;
  return (
    <div className="h-screen bg-background p-4 text-foreground">
      <CeoWorkspace />
    </div>
  );
}

const meta = {
  id: "goals-ceo-workspace",
  title: "Projects and execution/Goals and work alignment/CEO workspace",
  parameters: {
    layout: "fullscreen",
    paperclip: {
      capabilities: ["goals/navigation", "goals/alignment"],
      status: "current",
      implementation: "production",
      boundary: "fixtures",
      notes: "The shipped CeoWorkspace page with fixture responses for agents, goals, tasks and approvals. Decisions and 'Ask the CEO' call the real handlers; the fixture server does not persist them.",
    },
  },
} satisfies Meta;
export default meta;

export const Workspace_: StoryObj<typeof meta> = { name: "Workspace", render: () => <Workspace /> };
