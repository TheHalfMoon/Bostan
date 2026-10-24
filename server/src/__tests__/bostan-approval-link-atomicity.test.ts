import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, approvals, companies, createDb, issueApprovals, issues } from "@paperclipai/db";
import { issueApprovalService } from "../services/issue-approvals.js";
import { issueService } from "../services/issues.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan approval atomicity tests skipped: ${support.reason}`);

suite("Bostan approval link and Done serialize on the issue row", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b1-approval-atomicity-");
    db = createDb(backend.connectionString);
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); });

  async function seed(taskStatus = "in_progress", approvalStatus = "pending") {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID(), approvalId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Bostan B1 concurrency", issuePrefix: "BOS", requireBoardApprovalForNewAgents: false });
    await db.insert(agents).values({ id: agentId, companyId, name: "Worker", role: "engineer", status: "idle" });
    await db.insert(issues).values({ id: issueId, companyId, identifier: "BOS-1", title: "Concurrency task", status: taskStatus, priority: "medium", assigneeAgentId: agentId });
    await db.insert(approvals).values({ id: approvalId, companyId, status: approvalStatus, type: "governed_action", payload: { synthetic: true } });
    return { companyId, agentId, issueId, approvalId };
  }
  it("links a pending approval to open work and blocks agent Done", async () => {
    const s = await seed();
    const row = await issueApprovalService(db).link(s.issueId, s.approvalId);
    expect(row).toMatchObject({ companyId: s.companyId, issueId: s.issueId, approvalId: s.approvalId });
    await expect(issueService(db).update(s.issueId, { status: "done", actorAgentId: s.agentId, companyGuard: s.companyId }))
      .rejects.toMatchObject({ status: 409, details: { code: "task_approval_pending" } });
  });
  for (const status of ["done", "cancelled"]) {
    it(`refuses newly linking a pending approval to already ${status} work`, async () => {
      const s = await seed(status);
      await expect(issueApprovalService(db).link(s.issueId, s.approvalId)).rejects.toMatchObject({
        status: 409, details: { code: "issue_terminal_approval_link", issueId: s.issueId },
      });
      expect(await db.select().from(issueApprovals)).toHaveLength(0);
    });
  }
  it("allows historical approved decisions to be linked to completed work", async () => {
    const s = await seed("done", "approved");
    expect(await issueApprovalService(db).link(s.issueId, s.approvalId))
      .toMatchObject({ issueId: s.issueId, approvalId: s.approvalId });
  });
  it("bulk linking is atomic if one task has already completed", async () => {
    const s = await seed();
    const terminalIssueId = randomUUID();
    await db.insert(issues).values({ id: terminalIssueId, companyId: s.companyId, identifier: "BOS-2", title: "Closed", status: "done", priority: "medium" });
    await expect(issueApprovalService(db).linkManyForApproval(s.approvalId, [s.issueId, terminalIssueId]))
      .rejects.toMatchObject({ status: 409, details: { code: "issue_terminal_approval_link" } });
    expect(await db.select().from(issueApprovals)).toHaveLength(0);
  });
  it("bulk linking rejects another company's task without partial links", async () => {
    const s = await seed();
    const otherCompany = randomUUID(), otherIssue = randomUUID();
    await db.insert(companies).values({ id: otherCompany, name: "Other company", issuePrefix: "OTH", requireBoardApprovalForNewAgents: false });
    await db.insert(issues).values({ id: otherIssue, companyId: otherCompany, identifier: "OTH-1", title: "Other", status: "todo", priority: "medium" });
    await expect(issueApprovalService(db).linkManyForApproval(s.approvalId, [s.issueId, otherIssue]))
      .rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(issueApprovals)).toHaveLength(0);
  });
  it("link waits on concurrent Done and rejects after the committed terminal state", async () => {
    const s = await seed();
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    let acquired!: () => void;
    const locked = new Promise<void>(resolve => { acquired = resolve; });
    const completion = db.transaction(async tx => {
      await tx.select({ id: issues.id }).from(issues).where(eq(issues.id, s.issueId)).for("update");
      acquired();
      await released;
      await tx.update(issues).set({ status: "done", completedAt: new Date() }).where(eq(issues.id, s.issueId));
    });
    await locked;
    let settled = false;
    const linking = issueApprovalService(db).link(s.issueId, s.approvalId).finally(() => { settled = true; });
    try {
      await new Promise(resolve => setTimeout(resolve, 80));
      expect(settled).toBe(false);
    } finally { release(); }
    await completion;
    await expect(linking).rejects.toMatchObject({ status: 409, details: { code: "issue_terminal_approval_link" } });
    expect(await db.select().from(issueApprovals)).toHaveLength(0);
  });
});
