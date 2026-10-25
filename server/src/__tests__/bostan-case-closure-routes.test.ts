import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cases, companies, createDb } from "@paperclipai/db";
import { caseRoutes } from "../routes/cases.js";
import { errorHandler } from "../middleware/error-handler.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import {
  getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`B5-07 direct case status test unavailable: ${support.reason}`);

suite("Bostan B5-07 — canonical completion cannot be bypassed by generic Cases routes", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b5-case-closure-");
    db = createDb(backend.connectionString);
    await instanceSettingsService(db).updateExperimental({ enableCases: true });
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); });

  async function fixture() {
    const [company] = await db.insert(companies).values({
      id: randomUUID(), name: "Bostan B5 guarded company", issuePrefix: "B5G",
    }).returning();
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.actor = { type: "board", source: "local_implicit",
      userId: "synthetic-founder", isInstanceAdmin: true }; next(); });
    app.use("/api", caseRoutes(db, {} as never)); app.use(errorHandler);
    return { company, http: request(app) };
  }

  it("blocks creating or retroactively introducing approved/done independent-review claims", async () => {
    const { company, http } = await fixture();
    const url = `/api/companies/${company.id}/cases`;
    const governed = { caseType: "verification", key: "sensitive-work", title: "Signed review",
      fields: { bostanIndependentVerificationRequired: true } };
    const blocked = await http.post(url).send({ ...governed, status: "done" }).expect(409);
    expect(blocked.body.details?.code).toBe("bostan_canonical_case_completion_required");
    await http.post(url).send({ ...governed, status: "approved" }).expect(409);
    expect(await db.select().from(cases)).toHaveLength(0);
    const normal = await http.post(url).send({ caseType: "legacy", key: "ordinary", title: "Ordinary case" }).expect(201);
    await http.patch(`/api/cases/${normal.body.id}`).send({ status: "done" }).expect(200);
    const retroactive = await http.patch(`/api/cases/${normal.body.id}`)
      .send({ fields: { bostanIndependentVerificationRequired: true } }).expect(409);
    expect(retroactive.body.details?.code).toBe("bostan_canonical_case_completion_required");
  });

  it("blocks generic direct done/approved transitions and attempts to remove immutable review policy", async () => {
    const { company, http } = await fixture();
    const url = `/api/companies/${company.id}/cases`;
    const governed = { caseType: "verification", key: "case-42", title: "Must use independent reviewer",
      fields: { bostanIndependentVerificationRequired: true } };
    const created = await http.post(url).send(governed).expect(201);
    const id = created.body.id as string;
    await http.patch(`/api/cases/${id}`).send({ status: "in_review" }).expect(200);
    const direct = await http.patch(`/api/cases/${id}`).send({ status: "done" }).expect(409);
    expect(direct.body.details?.code).toBe("bostan_canonical_case_completion_required");
    await http.patch(`/api/cases/${id}`).send({ status: "approved" }).expect(409);
    const removal = await http.patch(`/api/cases/${id}`).send({ fields: { foo: true } }).expect(409);
    expect(removal.body.details?.code).toBe("bostan_independent_review_policy_immutable");
    await http.patch(`/api/cases/${id}`).send({ fields: { bostanIndependentVerificationRequired: false } }).expect(409);
    await http.post(url).send({ ...governed, fields: {}, status: "done" }).expect(409);
    await http.post(url).send({ ...governed, status: "done" }).expect(409);
    const [retained] = await db.select().from(cases).where(eq(cases.id, id));
    expect(retained).toMatchObject({ status: "in_review", fields: governed.fields });
    expect(retained.completedAt).toBeNull();
    // Safe edits and non-opted-in legacy completion retain old behavior.
    await http.patch(`/api/cases/${id}`).send({ title: "Read-only review pending" }).expect(200);
    const normal = await http.post(url).send({ caseType: "legacy", key: "ordinary",
      title: "Non-governed" }).expect(201);
    await http.patch(`/api/cases/${normal.body.id}`).send({ status: "done" }).expect(200);
    const [legacy] = await db.select().from(cases).where(eq(cases.id, normal.body.id));
    expect(legacy.status).toBe("done");
    expect(legacy.completedAt).toBeInstanceOf(Date);
  });
});
