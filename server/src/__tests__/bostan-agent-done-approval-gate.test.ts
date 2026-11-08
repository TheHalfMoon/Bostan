import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, approvals, companies, createDb, issueApprovals, issues } from "@bostan/db";
import { issueService } from "../services/issues.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const describeWithDb = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan B1 agent completion DB suite skipped: ${support.reason}`);

describeWithDb("Bostan agent completion cannot bypass linked approvals", () => {
  let database: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    database = await startBostanFeedbackPostgresTestDatabase("bostan-b1-done-approvals-");
    db = createDb(database.connectionString);
  }, 120_000);
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE companies CASCADE`);
  });
  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await database?.cleanup();
  });

  async function prepare(status: string, link = true) {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID();
    const approvalId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Bostan B1 isolated", issuePrefix: "BOS", requireBoardApprovalForNewAgents: false });
    await db.insert(agents).values({ id: agentId, companyId, name: "Worker", role: "engineer", status: "idle" });
    await db.insert(issues).values({ id: issueId, companyId, identifier: "BOS-1", title: "Governed change", status: "in_progress", priority: "medium", assigneeAgentId: agentId });
    await db.insert(approvals).values({ id: approvalId, companyId, type: "governed_action", status, payload: { kind: "synthetic" }, requestedByAgentId: agentId });
    if (link) await db.insert(issueApprovals).values({ issueId, companyId, approvalId, linkedByAgentId: agentId });
    return { companyId, agentId, issueId, approvalId };
  }
  for (const state of ["pending", "revision_requested"]) {
    it(`refuses self-certified Done when linked approval is ${state}`, async () => {
      const { companyId, agentId, issueId, approvalId } = await prepare(state);
      await expect(issueService(db).update(issueId, { status: "done", actorAgentId: agentId, companyGuard: companyId }))
        .rejects.toMatchObject({ status: 409, details: { code: "task_approval_pending", approvalId } });
      const [saved] = await db.select({ status: issues.status }).from(issues).where(eq(issues.id, issueId));
      expect(saved.status).toBe("in_progress");
    });
  }
  it("allows qualified agent completion when the linked approval was granted", async () => {
    const { companyId, agentId, issueId } = await prepare("approved");
    const updated = await issueService(db).update(issueId, { status: "done", actorAgentId: agentId, companyGuard: companyId });
    expect(updated).toMatchObject({ status: "done" });
  });
  it("unrelated, unlinked approvals do not block an agent", async () => {
    const { companyId, agentId, issueId } = await prepare("pending", false);
    expect(await issueService(db).update(issueId, { status: "done", actorAgentId: agentId, companyGuard: companyId })).toMatchObject({ status: "done" });
  });
  it("a board operator's explicit completion is distinct from agent self-certification", async () => {
    const { companyId, issueId } = await prepare("pending");
    expect(await issueService(db).update(issueId, { status: "done", actorUserId: "operator", companyGuard: companyId })).toMatchObject({ status: "done" });
  });
});
