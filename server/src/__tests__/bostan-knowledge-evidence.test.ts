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
