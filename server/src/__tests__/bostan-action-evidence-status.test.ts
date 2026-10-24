import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, toolInvocations } from "@paperclipai/db";
import { toolGatewayRoutes } from "../routes/tool-gateway.js";
import { classifyBostanActionEvidence, readBostanActionEvidence } from "../services/bostan-action-evidence.js";
import { getBostanFeedbackPostgresTestSupport, startBostanFeedbackPostgresTestDatabase } from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan B3 evidence status skipped: ${support.reason}`);

describe("Bostan B3 conservative action outcome classification", () => {
  const specimen = { id: randomUUID(), companyId: randomUUID(), status: "succeeded" as const,
    riskLevel: "write" as const, resultHash: "synthetic-digest", completedAt: new Date() };
  it("never conflates a tool success result with independent effect verification", () => {
    expect(classifyBostanActionEvidence(specimen)).toMatchObject({
      assessment: "readback_required", independentEffectVerified: false,
      autoRetrySafe: false, nextAction: "independent_provider_state_readback_required",
    });
    expect(classifyBostanActionEvidence({ ...specimen, riskLevel: "read" })).toMatchObject({
      assessment: "reported_result_unverified", independentEffectVerified: false,
    });
  });
  it("treats timed-out and failed side-effectful operations as unknown, not safe-to-retry", () => {
    for (const status of ["timed_out", "failed", "cancelled"] as const) {
      expect(classifyBostanActionEvidence({ ...specimen, status })).toMatchObject({
        assessment: "external_outcome_unknown", autoRetrySafe: false,
        nextAction: "operator_reconcile_before_any_retry",
      });
    }
  });
  it("retains explicit non-dispatch and pending distinctions without inventing verified effects", () => {
    expect(classifyBostanActionEvidence({ ...specimen, status: "denied" })).toMatchObject({
      assessment: "not_dispatched", independentEffectVerified: false,
    });
    expect(classifyBostanActionEvidence({ ...specimen, status: "executing" })).toMatchObject({
      assessment: "in_progress", independentEffectVerified: false,
    });
  });
});

suite("Bostan B3 board-only action status with real SQL", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let companyId: string, otherCompany: string;
  beforeAll(async () => {
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b3-action-evidence-");
    db = createDb(backend.connectionString);
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); });
  async function seed() {
    companyId = randomUUID(); otherCompany = randomUUID();
    await db.insert(companies).values([
      { id: companyId, name: "Bostan action QA", issuePrefix: "BOS" },
      { id: otherCompany, name: "Other action QA", issuePrefix: "OTH" },
    ]);
    const rows = await db.insert(toolInvocations).values([
      { companyId, toolName: "synthetic_write", status: "succeeded", riskLevel: "write", resultHash: "private-hash", completedAt: new Date() },
      { companyId, toolName: "synthetic_read", status: "succeeded", riskLevel: "read", resultHash: "read-hash", completedAt: new Date() },
      { companyId, toolName: "synthetic_unknown", status: "timed_out", riskLevel: "destructive", errorCode: "external_result_unconfirmed" },
      { companyId: otherCompany, toolName: "foreign", status: "succeeded", riskLevel: "write" },
    ]).returning();
    return rows;
  }
  function appWithActor(actor: unknown) {
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.actor = actor as typeof req.actor; next(); });
    app.use("/api", toolGatewayRoutes(db, {} as never));
    return app;
  }
  it("returns redacted advisory statuses to a board, without claiming verified side effects", async () => {
    const records = await seed();
    const board = appWithActor({ type: "board", source: "local_implicit", userId: "local", companyIds: [companyId] });
    const first = await request(board).get(`/api/tool-gateway/bostan-action-evidence/${records[0].id}?companyId=${companyId}`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ assessment: "readback_required", independentEffectVerified: false,
      hasResultDigest: true, autoRetrySafe: false });
    expect(JSON.stringify(first.body)).not.toContain("private-hash");
    const reading = await request(board).get(`/api/tool-gateway/bostan-action-evidence/${records[1].id}?companyId=${companyId}`);
    expect(reading.body).toMatchObject({ assessment: "reported_result_unverified", independentEffectVerified: false });
    const unknown = await readBostanActionEvidence(db, companyId, records[2].id);
    expect(unknown).toMatchObject({ assessment: "external_outcome_unknown", autoRetrySafe: false });
  });
  it("rejects agent route probing, cross-company reads, and bad UUID inputs", async () => {
    const records = await seed();
    const agent = appWithActor({ type: "agent", source: "agent_jwt", companyId, agentId: randomUUID(), runId: randomUUID() });
    expect((await request(agent).get(`/api/tool-gateway/bostan-action-evidence/${records[0].id}?companyId=${companyId}`)).status).toBe(403);
    const board = appWithActor({ type: "board", source: "local_implicit", userId: "local", companyIds: [companyId] });
    expect((await request(board).get(`/api/tool-gateway/bostan-action-evidence/${records[3].id}?companyId=${companyId}`)).status).toBe(404);
    expect((await request(board).get(`/api/tool-gateway/bostan-action-evidence/not-a-uuid?companyId=${companyId}`)).status).toBe(400);
  });
});
