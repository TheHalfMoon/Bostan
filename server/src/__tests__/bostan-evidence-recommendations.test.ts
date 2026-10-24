import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { decisionRoutes } from "../routes/decisions.js";
import { errorHandler } from "../middleware/error-handler.js";
import { sql, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, authUsers, budgetPolicies, companies, companyMemberships, costEvents, createDb, decisions, heartbeatRuns, issues, decisionEffectExecutions, projects } from "@paperclipai/db";
import { createBostanRecommendation, bostanRecommendationSchema } from "../services/bostan-decision-recommendations.js";
import { decisionService } from "../services/decisions.js";
import { signDecisionSpec } from "../services/decision-signing.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan B2 recommendation DB tests skipped: ${support.reason}`);

const exampleIds = { issueId: randomUUID() };
const base = () => ({
  title: "Evaluate synthetic procurement options",
  rationale: "Synthetic source documents support these choices; the model has not been calibrated.",
  alternatives: [
    { id: "pilot", label: "Run a small pilot", rationale: "Limit financial risk" },
    { id: "defer", label: "Defer", rationale: "Request missing comparison evidence" },
  ],
  recommendedOptionId: "pilot", confidence: 0.91,
  estimatedCostUsd: 45, costCeilingUsd: 100,
  evidenceIssueIds: [exampleIds.issueId], idempotencyKey: `bostan-recommendation-${randomUUID()}`,
});

describe("Bostan B2 schema fail-closed behavior", () => {
  it("rejects duplicate evidence, duplicate options and unknown recommended choices", () => {
    const sample = base();
    expect(bostanRecommendationSchema.safeParse({ ...sample, evidenceIssueIds: [sample.evidenceIssueIds[0], sample.evidenceIssueIds[0]] }).success).toBe(false);
    expect(bostanRecommendationSchema.safeParse({ ...sample, alternatives: [sample.alternatives[0], sample.alternatives[0]] }).success).toBe(false);
    expect(bostanRecommendationSchema.safeParse({ ...sample, recommendedOptionId: "invented" }).success).toBe(false);
    expect(bostanRecommendationSchema.safeParse({ ...sample, confidence: Number.NaN }).success).toBe(false);
    expect(bostanRecommendationSchema.safeParse({ ...sample, estimatedCostUsd: -1 }).success).toBe(false);
  });
  it("refuses unknown fields instead of accepting effect instructions", () => {
    expect(bostanRecommendationSchema.safeParse({ ...base(), effects: [{ type: "update_issue_status", status: "done" }] }).success).toBe(false);
    expect(bostanRecommendationSchema.safeParse({ ...base(), alternatives: [{ id: "pilot", label: "Pilot", rationale: "a", effects: [{}] }, { id: "defer", label: "Defer", rationale: "b" }] }).success).toBe(false);
  });
});

suite("Bostan B2 recommendations reuse signed board decisions", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let companyId: string, agentId: string, originIssueId: string, evidenceIssueId: string, runId: string, userId: string;
  const serviceOptions = { wakeOriginAgent: async () => {} };
  beforeAll(async () => { backend = await startBostanFeedbackPostgresTestDatabase("bostan-b2-recommendation-");db=createDb(backend.connectionString);process.env.PAPERCLIP_DECISION_SIGNING_SECRET = "0123456789abcdef0123456789abcdef";}, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({timeout:0});await backend?.cleanup();delete process.env.PAPERCLIP_DECISION_SIGNING_SECRET; });
  async function seed() {
    companyId=randomUUID();agentId=randomUUID();originIssueId=randomUUID();evidenceIssueId=randomUUID();runId=randomUUID();userId=`bostan-${randomUUID()}`;
    await db.insert(companies).values({id:companyId,name:"Bostan B2 QA",issuePrefix:"BOS"});
    await db.insert(authUsers).values({id:userId,name:"Bostan B2 test",email:`${userId}@example.test`,createdAt:new Date(),updatedAt:new Date()});
    await db.insert(companyMemberships).values({companyId,principalType:"user",principalId:userId,status:"active",membershipRole:"member"});
    await db.insert(agents).values({id:agentId,companyId,name:"Synthetic analyst",role:"engineer",status:"active",adapterType:"process",adapterConfig:{},runtimeConfig:{},permissions:{}});
    await db.insert(issues).values([
      {id:originIssueId,companyId,title:"Decision origin",status:"in_progress",priority:"medium",assigneeAgentId:agentId,responsibleUserId:userId},
      {id:evidenceIssueId,companyId,title:"Synthetic evidence",status:"todo",priority:"medium",responsibleUserId:userId},
    ]);
    await db.insert(heartbeatRuns).values({id:runId,companyId,agentId,status:"running",responsibleUserId:userId,contextSnapshot:{issueId:originIssueId}});
  }
  const actor=()=>({type:"agent" as const,companyId,agentId,runId,source:"agent_jwt" as const,onBehalfOfUserId:userId,onBehalfOfMemberships:[{companyId,membershipRole:"member",status:"active"}]});
  const write=(body: ReturnType<typeof base>)=>createBostanRecommendation({db,serviceOptions,companyId,actor:actor(),agentId,runId,body});
  it("persists evidence-linked non-effectful recommendations with idempotent signed decision", async () => {
    await seed();const body={...base(),evidenceIssueIds:[evidenceIssueId]};
    const created=await write(body);const repeat=await write(body);
    expect(repeat.id).toBe(created.id);
    expect(created.options).toHaveLength(2);
    expect(created.options.every(option=>option.effects.length===0)).toBe(true);
    expect(created.metadata).toMatchObject({kind:"bostan_evidence_recommendation_v1",calibrated:false,abstained:false,recommendedOptionId:"pilot",evidenceIssueIds:[evidenceIssueId],permitsEffects:false});
    expect(created.originIssueId).toBe(originIssueId);
    const board={type:"board" as const,userId,companyIds:[companyId],source:"session" as const,memberships:[{companyId,membershipRole:"member",status:"active"}]};
    const resolved=await decisionService(db,serviceOptions).decide({id:created.id,decidedByUserId:userId,userActor:board,optionId:"pilot"});
    expect(resolved.status).toBe("decided");
    expect(await db.select().from(decisionEffectExecutions)).toHaveLength(0);
  });
  it("abstains on insufficient self-reported confidence without authorizing effects", async () => {
    await seed();const created=await write({...base(),evidenceIssueIds:[evidenceIssueId],confidence:0.3});
    expect(created.metadata).toMatchObject({abstained:true,recommendedOptionId:null,abstentionReasons:["low_self_reported_confidence"]});
    expect(created.options.map(option=>option.id)).toEqual(["request_evidence","defer"]);
  });
  it("abstains on projected cost above ceiling; does not execute any provider", async () => {
    await seed();const created=await write({...base(),evidenceIssueIds:[evidenceIssueId],estimatedCostUsd:150,costCeilingUsd:100});
    expect(created.metadata).toMatchObject({abstained:true,abstentionReasons:["cost_ceiling_exceeded"],permitsEffects:false});
    expect(created.options.every(option=>option.effects.length===0)).toBe(true);
  });
  it("B2-02 abstains when a real board-set company budget is lower than the agent's declared ceiling", async () => {
    await seed();
    await db.insert(budgetPolicies).values({
      companyId, scopeType: "company", scopeId: companyId,
      metric: "billed_cents", windowKind: "calendar_month_utc",
      amount: 2_000, hardStopEnabled: true, isActive: true, createdByUserId: userId,
    });
    const created = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 5_000 });
    expect(created.metadata).toMatchObject({
      abstained: true, recommendedOptionId: null,
      abstentionReasons: ["board_budget_capacity_exceeded"],
      permitsEffects: false,
      checkedBoardBudgetPolicyCount: 1,
    });
    expect(created.options.map(option => option.id)).toEqual(["request_evidence", "defer"]);
  });
  it("B2-02 conservatively applies the stricter applicable agent budget even if company permits", async () => {
    await seed();
    await db.insert(budgetPolicies).values([
      { companyId, scopeType: "company", scopeId: companyId, metric: "billed_cents", windowKind: "calendar_month_utc", amount: 10_000, hardStopEnabled: true, isActive: true },
      { companyId, scopeType: "agent", scopeId: agentId, metric: "billed_cents", windowKind: "calendar_month_utc", amount: 500, hardStopEnabled: true, isActive: true },
    ]);
    const created = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 100 });
    expect(created.metadata).toMatchObject({ abstained: true, abstentionReasons: ["board_budget_capacity_exceeded"] });
    expect(created.metadata).toMatchObject({ checkedBoardBudgetPolicyCount: 2 });
    expect(created.metadata.boardBudgetPolicySnapshotHmacSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(created.metadata)).not.toContain("limitCents");
    expect(JSON.stringify(created.metadata)).not.toContain("observedCents");
  });
  it("B2-02 uses real settled ledger spend when calculating board policy remaining capacity", async () => {
    await seed();
    await db.insert(budgetPolicies).values({ companyId, scopeType: "company", scopeId: companyId, metric: "billed_cents", windowKind: "calendar_month_utc", amount: 6_000, hardStopEnabled: true, isActive: true });
    await db.insert(costEvents).values({
      companyId, agentId, issueId: evidenceIssueId, usageKind: "agent",
      provider: "synthetic-offline", biller: "test", billingType: "usage",
      model: "test-only", costStatus: "reported", costCents: 3_000,
      occurredAt: new Date(),
    });
    const created = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 100 });
    expect(created.metadata).toMatchObject({ abstained: true, abstentionReasons: ["board_budget_capacity_exceeded"] });
    expect(created.metadata.checkedBoardBudgetPolicyCount).toBe(1);
    expect(JSON.stringify(created.metadata)).not.toContain("observedCents");
  });
  it("B2-02 enforces the board's project budget for the *origin* issue's project", async () => {
    await seed();
    const projectId = randomUUID();
    await db.insert(projects).values({ id: projectId, companyId, name: "Bostan bounded origin project" });
    await db.update(issues).set({ projectId }).where(eq(issues.id, originIssueId));
    await db.insert(budgetPolicies).values({ companyId, scopeType: "project", scopeId: projectId, metric: "billed_cents", windowKind: "lifetime", amount: 2_000, hardStopEnabled: true, isActive: true });
    const created = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 100 });
    expect(created.metadata).toMatchObject({ abstained: true, abstentionReasons: ["board_budget_capacity_exceeded"] });
    expect(created.metadata.checkedBoardBudgetPolicyCount).toBe(1);
    expect(JSON.stringify(created.metadata)).not.toContain(projectId);
  });
  it("B2-02 still offers only effect-free alternatives if the board budget has ample remaining capacity", async () => {
    await seed();
    await db.insert(budgetPolicies).values({ companyId, scopeType: "company", scopeId: companyId, metric: "billed_cents", windowKind: "lifetime", amount: 10_000, hardStopEnabled: true, isActive: true });
    const created = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 100 });
    expect(created.metadata).toMatchObject({ abstained: false, checkedBoardBudgetPolicyCount: 1 });
    expect(created.options.every(option => option.effects.length === 0)).toBe(true);
  });
  it("B2-02 never reuses stale idempotent advice after the board changes its hard-stop budget", async () => {
    await seed();
    const [policy] = await db.insert(budgetPolicies).values({ companyId, scopeType: "company", scopeId: companyId, metric: "billed_cents", windowKind: "lifetime", amount: 10_000, hardStopEnabled: true, isActive: true }).returning();
    const request = { ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 100 };
    const before = await write(request);
    expect(before.metadata).toMatchObject({ abstained: false });
    await db.update(budgetPolicies).set({ amount: 2_000, enforcementVersion: policy.enforcementVersion + 1 }).where(eq(budgetPolicies.id, policy.id));
    // The same request ID cannot silently return the old signed recommendation.
    await expect(write(request)).rejects.toMatchObject({ status: 409 });
    const after = await write({ ...request, idempotencyKey: `bostan-budget-updated-${randomUUID()}` });
    expect(after.metadata).toMatchObject({ abstained: true, abstentionReasons: ["board_budget_capacity_exceeded"] });
    expect(after.metadata.boardBudgetPolicySnapshotHmacSha256).not.toBe(before.metadata.boardBudgetPolicySnapshotHmacSha256);
  });
  it("B2-03 invalidates stale signed advice when a cited issue's evidence changes", async () => {
    await seed();
    const request = { ...base(), evidenceIssueIds: [evidenceIssueId] };
    const first = await write(request);
    expect(first.metadata).toMatchObject({ evidenceIssueCount: 1, evidenceRelevanceVerified: false });
    expect(first.metadata.evidenceSnapshotHmacSha256).toMatch(/^[a-f0-9]{64}$/);
    await db.update(issues).set({
      description: "Synthetic evidence was revised after the initial recommendation",
      updatedAt: new Date(Date.now() + 10_000),
    }).where(eq(issues.id, evidenceIssueId));
    await expect(write(request)).rejects.toMatchObject({ status: 409 });
    const updated = await write({ ...request, idempotencyKey: `bostan-evidence-revised-${randomUUID()}` });
    expect(updated.metadata.evidenceSnapshotHmacSha256).not.toBe(first.metadata.evidenceSnapshotHmacSha256);
    expect(JSON.stringify(updated.metadata)).not.toContain("Synthetic evidence was revised");
    expect(updated.options.every(option => option.effects.length === 0)).toBe(true);
  });
  it("B2-02 never applies a budget belonging to another company", async () => {
    await seed();
    const otherCompany = randomUUID();
    await db.insert(companies).values({ id: otherCompany, name: "Foreign budget company", issuePrefix: "FBG" });
    await db.insert(budgetPolicies).values({ companyId: otherCompany, scopeType: "company", scopeId: otherCompany, metric: "billed_cents", windowKind: "calendar_month_utc", amount: 100, hardStopEnabled: true, isActive: true });
    const created = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], estimatedCostUsd: 45, costCeilingUsd: 100 });
    expect(created.metadata).toMatchObject({ abstained: false, checkedBoardBudgetPolicyCount: 0 });
  });
  it("B2-05 blocks board acceptance of a recommendation when evidence changed after creation", async () => {
    await seed();
    const recommendation = await write({ ...base(), evidenceIssueIds: [evidenceIssueId] });
    await db.update(issues).set({ description: "New factual information invalidating this proposal", updatedAt: new Date(Date.now() + 8_000) })
      .where(eq(issues.id, evidenceIssueId));
    const board = { type: "board" as const, userId, companyIds: [companyId], source: "session" as const,
      memberships: [{ companyId, membershipRole: "member", status: "active" }] };
    await expect(decisionService(db,serviceOptions).decide({ id: recommendation.id, optionId: "pilot", decidedByUserId: userId, userActor: board }))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_recommendation_stale" } });
    const [row] = await db.select().from(decisions).where(eq(decisions.id, recommendation.id));
    expect(row.status).toBe("open");
    expect(await db.select().from(decisionEffectExecutions)).toHaveLength(0);
  });
  it("B2-05 allows explicit safe deferral after evidence changed", async () => {
    await seed();
    const recommendation = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], confidence: 0.1 });
    await db.update(issues).set({ description: "Changed after advisory proposal", updatedAt: new Date(Date.now() + 8_000) })
      .where(eq(issues.id, evidenceIssueId));
    const board = { type: "board" as const, userId, companyIds: [companyId], source: "session" as const,
      memberships: [{ companyId, membershipRole: "member", status: "active" }] };
    const resolved = await decisionService(db,serviceOptions).decide({ id: recommendation.id, optionId: "defer", decidedByUserId: userId, userActor: board });
    expect(resolved.chosenOptionId).toBe("defer");
    expect(await db.select().from(decisionEffectExecutions)).toHaveLength(0);
  });
  it("B2-05 denies even a defer choice if a malformed Bostan advisory contains executable effects", async () => {
    await seed();
    const recommendation = await write({ ...base(), evidenceIssueIds: [evidenceIssueId], confidence: 0.1 });
    // Construct a synthetically corrupted-but-signed record to prove the
    // Bostan rule key is not a shortcut around the imported effect verifier.
    const unsafeOptions = recommendation.options.map((option, index) => index === 0
      ? { ...option, effects: [{ type: "comment_on_issue", targetIssueId: evidenceIssueId,
          bodyMarkdown: "synthetic never-execute", staleness: "strict" }] }
      : option);
    const signedSpec = signDecisionSpec({ decisionId: recommendation.id, options: unsafeOptions,
      targetSnapshots: recommendation.targetSnapshots });
    await db.update(decisions).set({ options: unsafeOptions as typeof recommendation.options, signedSpec })
      .where(eq(decisions.id, recommendation.id));
    const board = { type: "board" as const, userId, companyIds: [companyId], source: "session" as const,
      memberships: [{ companyId, membershipRole: "member", status: "active" }] };
    await expect(decisionService(db,serviceOptions).decide({ id: recommendation.id, optionId: "defer", decidedByUserId: userId, userActor: board }))
      .rejects.toMatchObject({ status: 403 });
    expect((await db.select().from(decisions).where(eq(decisions.id,recommendation.id)))[0].status).toBe("open");
    expect(await db.select().from(decisionEffectExecutions)).toHaveLength(0);
  });
  it("B2-05 blocks board acceptance after board budget is lowered", async () => {
    await seed();
    const [policy] = await db.insert(budgetPolicies).values({ companyId, scopeType: "company", scopeId: companyId,
      metric: "billed_cents", windowKind: "calendar_month_utc", amount: 10_000,
      hardStopEnabled: true, isActive: true }).returning();
    const recommendation = await write({ ...base(), evidenceIssueIds: [evidenceIssueId] });
    await db.update(budgetPolicies).set({ amount: 1000, enforcementVersion: policy.enforcementVersion + 1 }).where(eq(budgetPolicies.id, policy.id));
    const board = { type: "board" as const, userId, companyIds: [companyId], source: "session" as const,
      memberships: [{ companyId, membershipRole: "member", status: "active" }] };
    await expect(decisionService(db,serviceOptions).decide({ id: recommendation.id, optionId: "pilot", decidedByUserId: userId, userActor: board }))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_recommendation_stale" } });
    expect((await db.select().from(decisions).where(eq(decisions.id,recommendation.id)))[0].status).toBe("open");
  });
  it("B2-04 authenticates the agent-run HTTP route and returns only non-effectful signed choices", async () => {
    await seed();
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.actor = actor(); next(); });
    app.use("/api", decisionRoutes(db, serviceOptions)); app.use(errorHandler);
    const response = await request(app).post(`/api/companies/${companyId}/bostan-decision-recommendations`)
      .send({ ...base(), evidenceIssueIds: [evidenceIssueId] });
    expect(response.status).toBe(201);
    expect(response.body.metadata).toMatchObject({
      kind: "bostan_evidence_recommendation_v1", evidenceIssueCount: 1,
      abstained: false, permitsEffects: false,
    });
    expect(response.body.options.every((option: { effects: unknown[] }) => option.effects.length === 0)).toBe(true);
  });
  it("B2-04 rejects a board principal on the agent-only recommendation route", async () => {
    await seed();
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => {
      req.actor = { type: "board", userId, companyIds: [companyId], source: "session" }; next();
    });
    app.use("/api", decisionRoutes(db, serviceOptions)); app.use(errorHandler);
    const response = await request(app).post(`/api/companies/${companyId}/bostan-decision-recommendations`)
      .send({ ...base(), evidenceIssueIds: [evidenceIssueId] });
    expect(response.status).toBe(403);
    expect(await db.select().from(decisions)).toHaveLength(0);
  });
  it("B2-04 refuses a forged cross-company route and unknown model-authored effect fields", async () => {
    await seed();
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.actor = actor(); next(); });
    app.use("/api", decisionRoutes(db, serviceOptions)); app.use(errorHandler);
    const payload = { ...base(), evidenceIssueIds: [evidenceIssueId] };
    const foreignResponse = await request(app).post(`/api/companies/${randomUUID()}/bostan-decision-recommendations`).send(payload);
    expect(foreignResponse.status).toBe(403);
    const invalidResponse = await request(app).post(`/api/companies/${companyId}/bostan-decision-recommendations`)
      .send({ ...payload, effects: [{ type: "update_issue_status", status: "done" }] });
    expect(invalidResponse.status).toBe(400);
    expect(await db.select().from(decisions)).toHaveLength(0);
  });
  it("rejects foreign company evidence and makes no decision record", async () => {
    await seed();const otherId=randomUUID(),foreignIssue=randomUUID();
    await db.insert(companies).values({id:otherId,name:"Foreign B2 company",issuePrefix:"OTH"});
    await db.insert(issues).values({id:foreignIssue,companyId:otherId,title:"Private foreign evidence",status:"todo",priority:"medium"});
    await expect(write({...base(),evidenceIssueIds:[foreignIssue]})).rejects.toMatchObject({status:422});
    expect(await db.select().from(decisions).where(eq(decisions.companyId,companyId))).toHaveLength(0);
  });
});
