import { randomUUID } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, authUsers, companies, companyMemberships, createDb, decisions, heartbeatRuns, issues, decisionEffectExecutions } from "@paperclipai/db";
import { createBostanRecommendation, bostanRecommendationSchema } from "../services/bostan-decision-recommendations.js";
import { decisionService } from "../services/decisions.js";
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
  it("rejects foreign company evidence and makes no decision record", async () => {
    await seed();const otherId=randomUUID(),foreignIssue=randomUUID();
    await db.insert(companies).values({id:otherId,name:"Foreign B2 company",issuePrefix:"OTH"});
    await db.insert(issues).values({id:foreignIssue,companyId:otherId,title:"Private foreign evidence",status:"todo",priority:"medium"});
    await expect(write({...base(),evidenceIssueIds:[foreignIssue]})).rejects.toMatchObject({status:422});
    expect(await db.select().from(decisions).where(eq(decisions.companyId,companyId))).toHaveLength(0);
  });
});
