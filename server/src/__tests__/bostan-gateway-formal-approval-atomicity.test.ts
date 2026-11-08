import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, approvals, companies, createDb, issueApprovals, issues } from "@bostan/db";
import { issueApprovalService } from "../services/issue-approvals.js";
import { issueService } from "../services/issues.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan gateway formal approval tests skipped: ${support.reason}`);

suite("Bostan formal gateway approval creation is atomic with issue linking", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b1-gateway-formal-");
    db = createDb(backend.connectionString);
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); });

  async function seed(status = "in_progress") {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Bostan formal gateway", issuePrefix: "BOS", requireBoardApprovalForNewAgents: false });
    await db.insert(agents).values({ id: agentId, companyId, name: "Worker", role: "engineer", status: "idle" });
    await db.insert(issues).values({ id: issueId, companyId, identifier: "BOS-1", title: "Governed tool", status, priority: "medium", assigneeAgentId: agentId });
    return { companyId, agentId, issueId };
  }
  async function create(s: Awaited<ReturnType<typeof seed>>) {
    return issueApprovalService(db).createPendingToolApproval({
      companyId: s.companyId, issueId: s.issueId, requestedByAgentId: s.agentId,
      payload: { source: "tool_gateway", tool: "synthetic_write", risk: "write" },
    });
  }
  it("creates a pending formal board approval and linked task atomically", async () => {
    const s = await seed();
    const approvalId = await create(s);
    const [row] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
    expect(row).toMatchObject({ id: approvalId, companyId: s.companyId, status: "pending", type: "request_board_approval" });
    expect(await db.select().from(issueApprovals)).toMatchObject([{ issueId: s.issueId, companyId: s.companyId, approvalId }]);
    await expect(issueService(db).update(s.issueId, { status: "done", actorAgentId: s.agentId, companyGuard: s.companyId }))
      .rejects.toMatchObject({ status: 409, details: { code: "task_approval_pending" } });
  });
  for (const status of ["done", "cancelled"]) {
    it(`refuses formal creation on already ${status} issue without leaving orphan rows`, async () => {
      const s = await seed(status);
      await expect(create(s)).rejects.toMatchObject({ status: 409, details: { code: "issue_terminal_approval_link" } });
      expect(await db.select().from(approvals)).toHaveLength(0);
      expect(await db.select().from(issueApprovals)).toHaveLength(0);
    });
  }
  it("refuses a forged company binding before creating a formal approval", async () => {
    const s = await seed();
    await expect(issueApprovalService(db).createPendingToolApproval({
      companyId: randomUUID(), issueId: s.issueId, requestedByAgentId: s.agentId, payload: {},
    })).rejects.toMatchObject({ status: 404 });
    expect(await db.select().from(approvals)).toHaveLength(0);
  });
  it("serializes a concurrent completed task and leaves neither approval nor link", async () => {
    const s = await seed();
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    let acquired!: () => void;
    const locked = new Promise<void>(resolve => { acquired = resolve; });
    const finish = db.transaction(async tx => {
      await tx.select({ id: issues.id }).from(issues).where(eq(issues.id, s.issueId)).for("update");
      acquired();
      await released;
      await tx.update(issues).set({ status: "done", completedAt: new Date() }).where(eq(issues.id, s.issueId));
    });
    await locked;
    let settled = false;
    const creating = create(s).finally(() => { settled = true; });
    try {
      await new Promise(resolve => setTimeout(resolve, 80));
      expect(settled).toBe(false);
    } finally { release(); }
    await finish;
    await expect(creating).rejects.toMatchObject({ status: 409, details: { code: "issue_terminal_approval_link" } });
    expect(await db.select().from(approvals)).toHaveLength(0);
    expect(await db.select().from(issueApprovals)).toHaveLength(0);
  });
});
