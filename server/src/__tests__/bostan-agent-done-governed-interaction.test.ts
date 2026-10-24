import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, issueThreadInteractions, issues } from "@paperclipai/db";
import { issueService } from "../services/issues.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan B1 governed interaction suite skipped: ${support.reason}`);

suite("Bostan governed interactions fence agent task completion", () => {
  let database: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    database = await startBostanFeedbackPostgresTestDatabase("bostan-b1-governed-interactions-");
    db = createDb(database.connectionString);
  }, 120_000);
  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE companies CASCADE`);
  });
  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await database?.cleanup();
  });

  async function seed() {
    const companyId = randomUUID(), agentId = randomUUID(), issueId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Bostan governed completion", issuePrefix: "BOS", requireBoardApprovalForNewAgents: false });
    await db.insert(agents).values({ id: agentId, companyId, name: "Bostan worker", role: "engineer", status: "idle" });
    await db.insert(issues).values({ id: issueId, companyId, identifier: "BOS-1", title: "Sensitive task", status: "in_progress", priority: "medium", assigneeAgentId: agentId });
    return { companyId, agentId, issueId };
  }
  async function interaction(companyId: string, issueId: string, payload: Record<string, unknown>, status = "pending", kind = "request_confirmation") {
    const [row] = await db.insert(issueThreadInteractions).values({
      companyId, issueId, kind, status,
      payload: (kind === "connection_intent"
        ? payload
        : { version: 1, prompt: "Synthetic Bostan QA confirmation", ...payload }) as typeof issueThreadInteractions.$inferInsert.payload,
    }).returning();
    return row.id;
  }
  async function markDone({ companyId, issueId, agentId }: Awaited<ReturnType<typeof seed>>, asBoard = false) {
    return issueService(db).update(issueId, {
      status: "done", companyGuard: companyId,
      ...(asBoard ? { actorUserId: "operator" } : { actorAgentId: agentId }),
    });
  }
  for (const key of ["toolAction", "secretProposal", "connectionAuthorization"]) {
    it(`blocks agent Done for pending governed ${key}`, async () => {
      const task = await seed();
      const id = await interaction(task.companyId, task.issueId, { version: 1, [key]: { synthetic: true } });
      await expect(markDone(task)).rejects.toMatchObject({
        status: 409, details: { code: "task_governed_interaction_pending", interactionId: id },
      });
      const [saved] = await db.select({ status: issues.status }).from(issues).where(eq(issues.id, task.issueId));
      expect(saved.status).toBe("in_progress");
    });
  }
  it("blocks a pending document verdict, even if it looks like a confirmation", async () => {
    const task = await seed();
    const id = await interaction(task.companyId, task.issueId, { version: 1, target: { type: "issue_document" } });
    await expect(markDone(task)).rejects.toMatchObject({
      status: 409, details: { code: "task_governed_interaction_pending", interactionId: id },
    });
  });
  it("blocks real pending non-AI service connection enrollment", async () => {
    const task = await seed();
    const intent = {
      version: 1, serviceSlug: "synthetic-mail", serviceName: "Synthetic Mail",
      requestingAgentId: task.agentId, requestingAgentName: "Bostan worker",
      phase: "requested", purpose: "channel",
    };
    const id = await interaction(task.companyId, task.issueId, intent, "pending", "connection_intent");
    await expect(markDone(task)).rejects.toMatchObject({
      status: 409, details: { code: "task_governed_interaction_pending", interactionId: id },
    });
  });
  it("does not turn another user's pending AI-account login into this agent's task completion gate", async () => {
    const task = await seed();
    const intent = {
      version: 1, serviceSlug: "synthetic-ai", serviceName: "Synthetic AI",
      requestingAgentId: task.agentId, requestingAgentName: "Bostan worker",
      phase: "requested", purpose: "ai",
    };
    await interaction(task.companyId, task.issueId, intent, "pending", "connection_intent");
    expect(await markDone(task)).toMatchObject({ status: "done" });
  });
  it("does not block a normal pending user question or ordinary confirmation", async () => {
    const task = await seed();
    await interaction(task.companyId, task.issueId, { version: 1, question: "How should this look?" });
    expect(await markDone(task)).toMatchObject({ status: "done" });
  });
  it("a resolved governed interaction does not block completion", async () => {
    const task = await seed();
    await interaction(task.companyId, task.issueId, { version: 1, toolAction: { synthetic: true } }, "resolved");
    expect(await markDone(task)).toMatchObject({ status: "done" });
  });
  it("unlinked sensitive requests from a different task do not block", async () => {
    const task = await seed();
    const foreignTaskId = randomUUID();
    await db.insert(issues).values({ id: foreignTaskId, companyId: task.companyId, identifier: "BOS-2", title: "Other issue", status: "todo", priority: "medium" });
    await interaction(task.companyId, foreignTaskId, { version: 1, toolAction: { synthetic: true } });
    expect(await markDone(task)).toMatchObject({ status: "done" });
  });
  it("an authorized board operator can explicitly close the governed task", async () => {
    const task = await seed();
    await interaction(task.companyId, task.issueId, { version: 1, connectionAuthorization: { synthetic: true } });
    expect(await markDone(task, true)).toMatchObject({ status: "done" });
  });
});
