import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, caseAccessSources, caseHandoffs, cases, companies,
  createDb, issues, toolInvocations } from "@paperclipai/db";
import { caseHandoffService } from "../services/case-handoffs.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan B5 verifier test skipped: ${support.reason}`);

suite("Bostan B5-01 independent specialist-verifier routing", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b5-verifier-");
    db = createDb(backend.connectionString);
    await instanceSettingsService(db).updateExperimental({ enableCases: true });
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); });

  async function setup() {
    const companyId = randomUUID(), ceoId = randomUUID(), specialistId = randomUUID(), verifierId = randomUUID();
    const issueId = randomUUID(), caseId = randomUUID();
    await db.insert(companies).values({ id: companyId, name: "Bostan acceptance team", issuePrefix: "BST",
      requireBoardApprovalForNewAgents: false });
    await db.insert(agents).values([
      { id: ceoId, companyId, name: "CEO", role: "ceo", status: "active", adapterType: "process" },
      { id: specialistId, companyId, name: "Specialist", role: "engineer", status: "active", adapterType: "process", reportsTo: ceoId },
      { id: verifierId, companyId, name: "Independent verifier", role: "engineer", status: "active", adapterType: "process", reportsTo: ceoId },
    ]);
    await db.insert(issues).values({ id: issueId, companyId, title: "Build a synthetic report", status: "todo",
      assigneeAgentId: specialistId });
    await db.insert(cases).values({ id: caseId, companyId, caseNumber: 1, identifier: "BST-C1",
      caseType: "work", title: "Build and independently verify", status: "in_progress",
      phase: "implementation", handoffVersion: 1, workIssueId: issueId });
    await db.insert(caseAccessSources).values({ companyId, caseId, sourceKind: "issue", sourceId: issueId });
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
    return { companyId, ceoId, specialistId, verifierId, issueId, caseId, statusVersion: issue.statusVersion };
  }
  const board = { type: "board" as const, source: "local_implicit" as const };
  it("refuses same-agent verifier while preserving original task and no side effects", async () => {
    const f = await setup();
    await expect(caseHandoffService(db).handoff(f.companyId, board, {
      case: { id: f.caseId }, idempotencyKey: "self-verification",
      expectedHandoffVersion: 1, expectedIssueStatusVersion: f.statusVersion,
      toAgentId: f.specialistId, phase: "verification", instructions: "Sign off your own work",
    })).rejects.toMatchObject({ status: 422, details: { code: "bostan_independent_verifier_required" } });
    const [task] = await db.select().from(issues).where(eq(issues.id, f.issueId));
    const [caseRow] = await db.select().from(cases).where(eq(cases.id, f.caseId));
    expect(task).toMatchObject({ status: "todo", assigneeAgentId: f.specialistId,
      statusVersion: f.statusVersion });
    expect(caseRow.handoffVersion).toBe(1);
    expect(await db.select().from(caseHandoffs)).toHaveLength(0);
    expect(await db.select().from(toolInvocations)).toHaveLength(0);
  });
  it("retains the real source handoff authority for a distinct verifier", async () => {
    const f = await setup();
    const accepted = await caseHandoffService(db).handoff(f.companyId, board, {
      case: { id: f.caseId }, idempotencyKey: "independent-review",
      expectedHandoffVersion: 1, expectedIssueStatusVersion: f.statusVersion,
      toAgentId: f.verifierId, phase: "verification", instructions: "Review the actual saved report",
    });
    expect(accepted).toMatchObject({ caseId: f.caseId, taskId: f.issueId, replayed: false });
    const [task] = await db.select().from(issues).where(eq(issues.id, f.issueId));
    const [handoff] = await db.select().from(caseHandoffs).where(eq(caseHandoffs.id, accepted.handoffId));
    expect(task.assigneeAgentId).toBe(f.verifierId);
    expect(handoff).toMatchObject({ fromAgentId: f.specialistId,
      toAgentId: f.verifierId, phase: "verification" });
    expect(await db.select().from(toolInvocations)).toHaveLength(0);
  });
});
