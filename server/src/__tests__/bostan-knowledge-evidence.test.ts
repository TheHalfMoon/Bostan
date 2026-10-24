import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, documents, issueDocuments, issues } from "@paperclipai/db";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/error-handler.js";
import { readBostanIssueDocumentEvidence } from "../services/bostan-knowledge-evidence.js";
import {
  getBostanFeedbackPostgresTestSupport, startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`Bostan knowledge SQL QA unsupported: ${support.reason}`);

suite("Bostan B4-01 versioned, tenant-scoped task document evidence", () => {
  let database: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    database = await startBostanFeedbackPostgresTestDatabase("bostan-b4-knowledge-");
    db = createDb(database.connectionString);
    process.env.PAPERCLIP_DECISION_SIGNING_SECRET = "bostan-B4-synthetic-deterministic-key-0123456789";
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await database?.cleanup();
    delete process.env.PAPERCLIP_DECISION_SIGNING_SECRET;
  });
  async function seed() {
    const companyId = randomUUID(), otherCompany = randomUUID();
    await db.insert(companies).values([
      { id: companyId, name: "Bostan knowledge company", issuePrefix: "BKN" },
      { id: otherCompany, name: "Bostan isolated outsider", issuePrefix: "OTH" },
    ]);
    const issueId = randomUUID();
    await db.insert(issues).values({ id: issueId, companyId,
      title: "Synthetic grounded evidence issue", status: "in_progress" });
    const documentId = randomUUID();
    const original = "Clinical-source example: this is untrusted source text, not instructions for an agent.";
    await db.insert(documents).values({ id: documentId, companyId,
      title: "Original factual source", latestBody: original, latestRevisionNumber: 1 });
    await db.insert(issueDocuments).values({ companyId, issueId, documentId, key: "research-source" });
    return { companyId, otherCompany, issueId, documentId, original };
  }
  function appFor(actor: unknown) {
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.actor = actor as typeof req.actor; next(); });
    app.use("/api", issueRoutes(db, {} as never)); app.use(errorHandler);
    return app;
  }
  const board = (companyId: string) => ({ type: "board", source: "local_implicit",
    userId: "local", companyIds: [companyId] });
  it("returns only currently linked document revision provenance and marks text untrusted", async () => {
    const s = await seed();
    const original = await readBostanIssueDocumentEvidence({ db, ...s,
      issueReadCondition: sql<boolean>`true` });
    expect(original).toMatchObject({
      companyId: s.companyId, issueId: s.issueId, documentId: s.documentId,
      latestRevisionNumber: 1, sourceContentIsUntrusted: true,
      provenanceVerified: true, factualRelevanceVerified: false,
      executionAuthorized: false,
    });
    expect(original!.sourceSnapshotHmacSha256).toMatch(/^[a-f0-9]{64}$/);
    const deniedAtIssueReadGate = await readBostanIssueDocumentEvidence({ db, ...s,
      issueReadCondition: sql<boolean>`false` });
    expect(deniedAtIssueReadGate).toBeNull();
    const endpoint = `/api/companies/${s.companyId}/issues/${s.issueId}/bostan-evidence/documents/${s.documentId}`;
    const response = await request(appFor(board(s.companyId))).get(endpoint);
    expect(response.status).toBe(200);
    expect(response.body.sourceSnapshotHmacSha256).toBe(original!.sourceSnapshotHmacSha256);
    expect(response.body.excerpt).toContain("untrusted source text");
    expect(response.body.executionAuthorized).toBe(false);
    await db.update(documents).set({ latestBody: "Corrected source evidence for an edited revision",
      latestRevisionNumber: 2, updatedAt: new Date(Date.now() + 5000) })
      .where(eq(documents.id, s.documentId));
    const revised = await request(appFor(board(s.companyId))).get(endpoint);
    expect(revised.status).toBe(200);
    expect(revised.body.latestRevisionNumber).toBe(2);
    expect(revised.body.sourceSnapshotHmacSha256).not.toBe(original!.sourceSnapshotHmacSha256);
    expect(revised.body.excerpt).not.toContain(s.original);
  });
  it("revokes evidence retrieval on unlink/deletion and never mixes tenants", async () => {
    const s = await seed();
    const endpoint = `/api/companies/${s.companyId}/issues/${s.issueId}/bostan-evidence/documents/${s.documentId}`;
    const boardApp = appFor(board(s.companyId));
    expect((await request(boardApp).get(endpoint)).status).toBe(200);
    expect((await request(boardApp).get(endpoint.replace(s.documentId, randomUUID()))).status).toBe(404);
    const outsider = { type: "board", source: "session", userId: "ordinary-other-company-member",
      companyIds: [s.otherCompany], memberships: [{ companyId: s.otherCompany,
        membershipRole: "member", status: "active" }] };
    expect((await request(appFor(outsider)).get(endpoint)).status).toBe(403);
    const agent = { type: "agent", source: "agent_jwt", companyId: s.companyId,
      agentId: randomUUID(), runId: randomUUID() };
    expect((await request(appFor(agent)).get(endpoint)).status).toBe(403);
    await db.delete(issueDocuments).where(eq(issueDocuments.documentId, s.documentId));
    expect((await request(boardApp).get(endpoint)).status).toBe(404);
    await db.insert(issueDocuments).values({ companyId: s.companyId,
      issueId: s.issueId, documentId: s.documentId, key: "research-source" });
    await db.delete(documents).where(eq(documents.id, s.documentId));
    expect((await request(boardApp).get(endpoint)).status).toBe(404);
  });
  it("B4-02 verifies current document snapshot, fails closed on revision changes and restricts tenants", async () => {
    const s = await seed();
    const app = appFor(board(s.companyId));
    const sourcePath = `/api/companies/${s.companyId}/issues/${s.issueId}/bostan-evidence/documents/${s.documentId}`;
    const freshPath = `${sourcePath}/freshness`;
    const first = await request(app).get(sourcePath);
    expect(first.status).toBe(200);
    const body = { expectedSnapshotHmacSha256: first.body.sourceSnapshotHmacSha256 };
    const current = await request(app).post(freshPath).send(body);
    expect(current.status).toBe(200);
    expect(current.headers["cache-control"]).toContain("no-store");
    expect(current.body).toMatchObject({ snapshotCurrent: true, decisionCommitAuthorized: false,
      factualRelevanceVerified: false, sourceContentIsUntrusted: true });
    expect(JSON.stringify(current.body)).not.toContain(first.body.excerpt);
    expect(JSON.stringify(current.body)).not.toContain(first.body.sourceSnapshotHmacSha256);
    expect((await request(app).post(freshPath).send({ ...body, unexpected: true })).status).toBe(400);
    expect((await request(app).post(freshPath).send({ expectedSnapshotHmacSha256: "bad" })).status).toBe(400);
    expect((await request(app).post(freshPath).send({ expectedSnapshotHmacSha256: "0".repeat(64) })).body)
      .toMatchObject({ snapshotCurrent: false, decisionCommitAuthorized: false });
    await db.update(documents).set({ latestBody: "changed cited evidence, not a valid earlier snapshot",
      latestRevisionNumber: 2, updatedAt: new Date(Date.now()+10_000) }).where(eq(documents.id, s.documentId));
    const stale = await request(app).post(freshPath).send(body);
    expect(stale.status).toBe(200);
    expect(stale.body).toMatchObject({ snapshotCurrent: false, decisionCommitAuthorized: false });
    const second = await request(app).get(sourcePath);
    expect((await request(app).post(freshPath).send({ expectedSnapshotHmacSha256: second.body.sourceSnapshotHmacSha256 })).body)
      .toMatchObject({ snapshotCurrent: true, decisionCommitAuthorized: false });
    const outsider = { type: "board", source: "session", userId: "separate-company-user",
      companyIds: [s.otherCompany], memberships: [{ companyId: s.otherCompany, membershipRole: "member", status: "active" }] };
    expect((await request(appFor(outsider)).post(freshPath).send(body)).status).toBe(403);
    const agent = { type: "agent", source: "agent_jwt", companyId: s.companyId, agentId: randomUUID(), runId: randomUUID() };
    expect((await request(appFor(agent)).post(freshPath).send(body)).status).toBe(403);
    await db.delete(issueDocuments).where(eq(issueDocuments.documentId, s.documentId));
    expect((await request(app).post(freshPath).send(body)).status).toBe(404);
  });
  it("B4-03 requires every current citation in a repeatable-read source set", async () => {
    const s = await seed();
    const secondaryId = randomUUID();
    await db.insert(documents).values({ id: secondaryId, companyId: s.companyId,
      title: "Second source", latestBody: "Second independent synthetic fact", latestRevisionNumber: 1 });
    await db.insert(issueDocuments).values({ companyId: s.companyId, issueId: s.issueId,
      documentId: secondaryId, key: "second-source" });
    const app = appFor(board(s.companyId));
    const prefix = `/api/companies/${s.companyId}/issues/${s.issueId}/bostan-evidence/documents/`;
    const first = (await request(app).get(prefix + s.documentId)).body;
    const second = (await request(app).get(prefix + secondaryId)).body;
    const sources = [
      { issueId: s.issueId, documentId: s.documentId, expectedSnapshotHmacSha256: first.sourceSnapshotHmacSha256 },
      { issueId: s.issueId, documentId: secondaryId, expectedSnapshotHmacSha256: second.sourceSnapshotHmacSha256 },
    ];
    const path = `/api/companies/${s.companyId}/bostan-evidence/snapshots/freshness`;
    const fresh = await request(app).post(path).send({ sources });
    expect(fresh.status).toBe(200);
    expect(fresh.headers["cache-control"]).toContain("no-store");
    expect(fresh.body).toMatchObject({ citationsChecked: 2, allSnapshotsCurrent: true,
      decisionCommitAuthorized: false, factualRelevanceVerified: false });
    expect(JSON.stringify(fresh.body)).not.toContain(first.sourceSnapshotHmacSha256);
    expect(JSON.stringify(fresh.body)).not.toContain("Second independent synthetic fact");
    expect((await request(app).post(path).send({ sources: [sources[0], sources[0]] })).status).toBe(400);
    expect((await request(app).post(path).send({ sources: [] })).status).toBe(400);
    expect((await request(app).post(path).send({ sources: Array(11).fill(sources[0]) })).status).toBe(400);
    await db.update(documents).set({ latestBody: "Altered evidence source two",
      latestRevisionNumber: 2 }).where(eq(documents.id, secondaryId));
    const stale = await request(app).post(path).send({ sources });
    expect(stale.status).toBe(200);
    expect(stale.body).toMatchObject({ allSnapshotsCurrent: false, decisionCommitAuthorized: false });
    await db.delete(issueDocuments).where(eq(issueDocuments.documentId, secondaryId));
    const detached = await request(app).post(path).send({ sources });
    expect(detached.body).toMatchObject({ allSnapshotsCurrent: false });
  });
  it("B4-03 denies foreign company and agent citation set probes", async () => {
    const s = await seed();
    const evidence = await readBostanIssueDocumentEvidence({ db, ...s,
      issueReadCondition: sql<boolean>`true` });
    const path = `/api/companies/${s.companyId}/bostan-evidence/snapshots/freshness`;
    const sources = [{ issueId: s.issueId, documentId: s.documentId,
      expectedSnapshotHmacSha256: evidence!.sourceSnapshotHmacSha256 }];
    const outsider = { type: "board", source: "session", userId: "other-member",
      companyIds: [s.otherCompany], memberships: [{ companyId: s.otherCompany, status: "active", membershipRole: "member" }] };
    expect((await request(appFor(outsider)).post(path).send({ sources })).status).toBe(403);
    const agent = { type: "agent", source: "agent_jwt", companyId: s.companyId,
      agentId: randomUUID(), runId: randomUUID() };
    expect((await request(appFor(agent)).post(path).send({ sources })).status).toBe(403);
    await db.update(issues).set({ hiddenAt: new Date() }).where(eq(issues.id, s.issueId));
    const hidden = await request(appFor(board(s.companyId))).post(path).send({ sources });
    expect(hidden.status).toBe(200);
    expect(hidden.body).toMatchObject({ allSnapshotsCurrent: false, decisionCommitAuthorized: false });
  });
  it("B4-02 denies hidden/unauthorized source even with a valid old snapshot", async () => {
    const s = await seed();
    const first = await readBostanIssueDocumentEvidence({ db, ...s, issueReadCondition: sql<boolean>`true` });
    const { checkBostanIssueDocumentSnapshot } = await import("../services/bostan-knowledge-evidence.js");
    const input = { db, ...s, expectedSnapshotHmacSha256: first!.sourceSnapshotHmacSha256 };
    expect(await checkBostanIssueDocumentSnapshot({ ...input, issueReadCondition: sql<boolean>`false` })).toBeNull();
    await db.update(issues).set({ hiddenAt: new Date() }).where(eq(issues.id, s.issueId));
    expect(await checkBostanIssueDocumentSnapshot({ ...input, issueReadCondition: sql<boolean>`true` })).toBeNull();
  });
  it("never exposes the contents of hidden issues and bounds giant source excerpts", async () => {
    const s = await seed();
    await db.update(documents).set({ latestBody: "p".repeat(12_000) })
      .where(eq(documents.id, s.documentId));
    const result = await readBostanIssueDocumentEvidence({ db, ...s,
      issueReadCondition: sql<boolean>`true` });
    expect(result?.excerpt).toHaveLength(1200);
    expect(result?.excerptTruncated).toBe(true);
    await db.update(issues).set({ hiddenAt: new Date() }).where(eq(issues.id, s.issueId));
    const hidden = await readBostanIssueDocumentEvidence({ db, ...s,
      issueReadCondition: sql<boolean>`true` });
    expect(hidden).toBeNull();
  });
});
