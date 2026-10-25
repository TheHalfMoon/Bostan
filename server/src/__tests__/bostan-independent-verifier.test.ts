import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, caseAccessSources, caseHandoffs, cases, companies,
  createDb, documentRevisions, heartbeatRuns, issues, toolInvocations } from "@paperclipai/db";
import { caseHandoffService } from "../services/case-handoffs.js";
import { issueService } from "../services/issues.js";
import { documentService } from "../services/documents.js";
import { issueRoutes } from "../routes/issues.js";
import { caseRoutes } from "../routes/cases.js";
import { errorHandler } from "../middleware/error-handler.js";
import { readBostanIssueDocumentEvidence } from "../services/bostan-knowledge-evidence.js";
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
    process.env.PAPERCLIP_DECISION_SIGNING_SECRET = "bostan-b5-synthetic-signing-test-0123456789";
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); delete process.env.PAPERCLIP_DECISION_SIGNING_SECRET; });

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
      phase: "implementation", handoffVersion: 1, workIssueId: issueId,
      fields: { bostanIndependentVerificationRequired: true } });
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
  it("B5-02 refuses opt-in case closure until a distinct verifier handoff is delivered", async () => {
    const f = await setup();
    const service = caseHandoffService(db);
    const terminal = (handoffVersion: number, statusVersion: number) => ({
      to: "done" as const, idempotencyKey: `close-${handoffVersion}`,
      case: { id: f.caseId }, expectedHandoffVersion: handoffVersion,
      expectedIssueStatusVersion: statusVersion,
      instructions: "Close the already-reviewed task",
    });
    await expect(service.handoff(f.companyId, board, terminal(1, f.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verification_handoff_required" } });
    expect(await db.select().from(caseHandoffs)).toHaveLength(0);
    const submitted = await service.handoff(f.companyId, board, {
      case: { id: f.caseId }, idempotencyKey: "handoff-to-independent-verifier",
      expectedHandoffVersion: 1, expectedIssueStatusVersion: f.statusVersion,
      toAgentId: f.verifierId, phase: "verification", instructions: "Independently inspect the output",
    });
    const [afterAssign] = await db.select().from(issues).where(eq(issues.id, f.issueId));
    const [afterCase] = await db.select().from(cases).where(eq(cases.id, f.caseId));
    expect(afterAssign.assigneeAgentId).toBe(f.verifierId);
    expect(afterCase.handoffVersion).toBe(2);
    // Dispatch acknowledgement alone is not an actual *delivered* handoff.
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409 });
    // Simulate the existing worker's durable terminal delivery confirmation.
    // This does not simulate an AI run, independent content review or action.
    const deliveryAt = new Date(Date.now() - 120_000);
    await db.update(caseHandoffs).set({ state: "delivered", deliveredAt: deliveryAt })
      .where(eq(caseHandoffs.id, submitted.handoffId));
    // B5-03: A delivered handoff alone must not be called a completed review.
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_run_required" } });
    const otherRunId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: otherRunId, companyId: f.companyId,
      agentId: f.specialistId, issueId: f.issueId, status: "succeeded",
      finishedAt: new Date(deliveryAt.getTime() + 2_000), contextSnapshot: { issueId: f.issueId } });
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_run_required" } });
    await db.insert(heartbeatRuns).values({ id: randomUUID(), companyId: f.companyId,
      agentId: f.verifierId, issueId: f.issueId, status: "succeeded",
      finishedAt: new Date(deliveryAt.getTime() - 2_000), contextSnapshot: { issueId: f.issueId } });
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_run_required" } });
    // Synthetic source-runtime completion row; no AI/model/provider actually
    // executed in this test. It proves only the canonical DB run gate.
    const sourceDocument = await documentService(db).upsertIssueDocument({
      issueId: f.issueId, key: "bostan-source", title: "Implementation source",
      format: "markdown", body: "Original synthetic result to be independently checked for acceptance.",
      createdByAgentId: f.specialistId, createdByRunId: otherRunId,
    });
    const sourceEvidence = await readBostanIssueDocumentEvidence({ db,
      companyId: f.companyId, issueId: f.issueId,
      documentId: sourceDocument.document.id, issueReadCondition: sql<boolean>`true`,
    });
    const reportText = (hmac: string) => JSON.stringify({
      schema: "bostan.verification.report.v1", verdict: "pass",
      summary: "Synthetic reviewer checked the current implementation source and recorded a bounded observation.",
      sources: [{ documentId: sourceDocument.document.id, expectedSnapshotHmacSha256: hmac }],
    });
    const getActiveSourceSnapshot = async (currentRunId: string) => {
      const app = express(); app.use(express.json());
      app.use((req, _res, next) => { req.actor = { type: "agent", source: "agent_jwt",
        companyId: f.companyId, agentId: f.verifierId, runId: currentRunId }; next(); });
      app.use("/api", issueRoutes(db, {} as never)); app.use(errorHandler);
      return request(app).get(`/api/companies/${f.companyId}/issues/${f.issueId}/bostan-verification/sources/${sourceDocument.document.id}/snapshot`);
    };
    const reviewedRunId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: reviewedRunId, companyId: f.companyId,
      agentId: f.verifierId, issueId: f.issueId, status: "running",
      startedAt: new Date(deliveryAt.getTime() + 60_000),
      contextSnapshot: { issueId: f.issueId } });
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_run_required" } });
    // B5-06: the actual reviewer GET endpoint, not an internal bypass,
    // supplies the digest needed by the JSON evidence report.
    const scopedSource = await getActiveSourceSnapshot(reviewedRunId);
    expect(scopedSource.status).toBe(200);
    expect(scopedSource.body.sourceSnapshotHmacSha256).toBe(sourceEvidence!.sourceSnapshotHmacSha256);
    expect(scopedSource.body.excerpt).toBeUndefined();
    const note = await documentService(db).upsertIssueDocument({
      issueId: f.issueId, key: "bostan-verification", title: "Verifier assessment",
      format: "markdown", body: "Independent synthetic inspection: test output matches the task acceptance criteria.",
      createdByAgentId: f.specialistId, createdByRunId: otherRunId,
    });
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_run_required" } });
    // B5-11: exercise the actual authenticated agent REST deliverable write,
    // not the test-only direct documentService shortcut. The run is live
    // and assigned, the original delivered case handoff is still current.
    const verifierWriteApp = (currentRunId: string) => {
      const app = express(); app.use(express.json());
      app.use((req, _res, next) => { req.actor = { type: "agent", source: "agent_jwt",
        companyId: f.companyId, agentId: f.verifierId, runId: currentRunId }; next(); });
      app.use("/api", issueRoutes(db, {} as never)); app.use(errorHandler);
      return app;
    };
    const writeApp = verifierWriteApp(reviewedRunId);
    const reportUrl = `/api/issues/${f.issueId}/documents/bostan-verification`;
    const negativeWrite = { title: "Verifier assessment", format: "json",
      body: reportText(scopedSource.body.sourceSnapshotHmacSha256),
      baseRevisionId: note.document.latestRevisionId };
    const otherFormat = await request(writeApp)
      .put(`/api/issues/${f.issueId}/documents/unrelated-json`).send(negativeWrite);
    expect(otherFormat.status).toBe(400);
    const malformedReport = await request(writeApp).put(reportUrl)
      .send({ ...negativeWrite, body: JSON.stringify({ schema: "bostan.verification.report.v1", verdict: "pass" }) });
    expect(malformedReport.status).toBe(400);
    const boardReportApp = express(); boardReportApp.use(express.json());
    boardReportApp.use((req, _res, next) => { req.actor = { type: "board", source: "local_implicit",
      userId: "synthetic-founder", isInstanceAdmin: true }; next(); });
    boardReportApp.use("/api", issueRoutes(db, {} as never)); boardReportApp.use(errorHandler);
    expect((await request(boardReportApp).put(reportUrl).send(negativeWrite)).status).toBe(403);
    const writeReview = await request(writeApp)
      .put(reportUrl)
      .send({ title: "Verifier assessment", format: "json",
        body: reportText(scopedSource.body.sourceSnapshotHmacSha256),
        baseRevisionId: note.document.latestRevisionId });
    expect(writeReview.status, JSON.stringify(writeReview.body)).toBe(200);
    const revised = { document: (await documentService(db).getIssueDocumentByKey(f.issueId, "bostan-verification"))! };
    const [actualRevision] = await db.select({ agentId: documentRevisions.createdByAgentId,
      runId: documentRevisions.createdByRunId }).from(documentRevisions)
      .where(eq(documentRevisions.id, revised.document.latestRevisionId));
    expect(actualRevision).toMatchObject({ agentId: f.verifierId, runId: reviewedRunId });
    await new Promise(resolve => setTimeout(resolve, 30));
    await db.update(heartbeatRuns).set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(heartbeatRuns.id, reviewedRunId));
    expect((await request(writeApp).put(reportUrl).send(negativeWrite)).status).toBe(403);
    // The actual underlying implementation source changes after review:
    // a well-attributed run/report is NOT enough if its cited facts are stale.
    await documentService(db).upsertIssueDocument({
      issueId: f.issueId, key: "bostan-source", title: "Implementation source",
      format: "markdown", body: "Changed implementation source that invalidates the prior reviewer citation.",
      baseRevisionId: sourceDocument.document.latestRevisionId,
      createdByAgentId: f.specialistId, createdByRunId: otherRunId,
    });
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_source_stale" } });
    // Historical verifier-owned content is not sufficient after the latest
    // revision is rewritten by an implementer. This must reject before the
    // canonical terminal comment or version advances.
    const tampered = await documentService(db).upsertIssueDocument({
      issueId: f.issueId, key: "bostan-verification", title: "Verifier assessment",
      format: "markdown", body: "Original implementer overwrote the independent sign-off after its verification run.",
      baseRevisionId: revised.document.latestRevisionId,
      createdByAgentId: f.specialistId, createdByRunId: otherRunId,
    });
    await expect(service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion)))
      .rejects.toMatchObject({ status: 409, details: { code: "bostan_verifier_document_required" } });
    const resumedRunId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: resumedRunId, companyId: f.companyId,
      agentId: f.verifierId, issueId: f.issueId, status: "running",
      startedAt: new Date(), contextSnapshot: { issueId: f.issueId } });
    const refreshedSource = await getActiveSourceSnapshot(resumedRunId);
    expect(refreshedSource.status).toBe(200);
    expect(refreshedSource.body.sourceSnapshotHmacSha256).not.toBe(scopedSource.body.sourceSnapshotHmacSha256);
    const resumedWrite = await request(verifierWriteApp(resumedRunId)).put(reportUrl)
      .send({ title: "Verifier assessment", format: "json",
        body: reportText(refreshedSource.body.sourceSnapshotHmacSha256),
        baseRevisionId: tampered.document.latestRevisionId });
    expect(resumedWrite.status, JSON.stringify(resumedWrite.body)).toBe(200);
    const finalReviewed = { document: (await documentService(db).getIssueDocumentByKey(f.issueId, "bostan-verification"))! };
    await new Promise(resolve => setTimeout(resolve, 30));
    await db.update(heartbeatRuns).set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(heartbeatRuns.id, resumedRunId));
    const accepted = await service.handoff(f.companyId, board, terminal(2, afterAssign.statusVersion));
    expect(accepted).toMatchObject({ destinationKind: "done", state: "awaiting_completion" });
    // B5-09: source changes AFTER the case accepted terminal intent but
    // BEFORE the final task Done. A previously accepted receipt is stale.
    await documentService(db).upsertIssueDocument({
      issueId: f.issueId, key: "bostan-source", title: "Implementation source",
      format: "markdown", body: "A changed implementation source after the case accepted terminal intent",
      baseRevisionId: (await documentService(db).getIssueDocumentByKey(f.issueId, "bostan-source"))!.latestRevisionId,
      createdByAgentId: f.specialistId, createdByRunId: otherRunId,
    });
    const requestFinalDone = () => issueService(db).update(f.issueId, {
      status: "done", actorUserId: "synthetic-founder", companyGuard: f.companyId,
    });
    await expect(requestFinalDone()).rejects.toMatchObject({
      status: 409, details: { code: "bostan_verifier_source_stale" },
    });
    const [[stillOpenTask], [stillOpenCase], [pendingIntent]] = await Promise.all([
      db.select().from(issues).where(eq(issues.id, f.issueId)),
      db.select().from(cases).where(eq(cases.id, f.caseId)),
      db.select().from(caseHandoffs).where(eq(caseHandoffs.id, accepted.handoffId)),
    ]);
    expect(stillOpenTask.status).not.toBe("done");
    expect(stillOpenCase.status).not.toBe("done");
    expect(pendingIntent.state).toBe("awaiting_completion");
    // The same active agent must re-review the changed source in a NEW
    // successful run and update the latest review document accordingly.
    const finalRunId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: finalRunId, companyId: f.companyId,
      agentId: f.verifierId, issueId: f.issueId, status: "running", startedAt: new Date(),
      contextSnapshot: { issueId: f.issueId } });
    const finalDigest = await getActiveSourceSnapshot(finalRunId);
    expect(finalDigest.status).toBe(200);
    expect(finalDigest.body.sourceSnapshotHmacSha256).not.toBe(refreshedSource.body.sourceSnapshotHmacSha256);
    const finalWrite = await request(verifierWriteApp(finalRunId)).put(reportUrl)
      .send({ title: "Verifier assessment", format: "json",
        body: reportText(finalDigest.body.sourceSnapshotHmacSha256),
        baseRevisionId: finalReviewed.document.latestRevisionId });
    expect(finalWrite.status, JSON.stringify(finalWrite.body)).toBe(200);
    await new Promise(resolve => setTimeout(resolve, 35));
    await db.update(heartbeatRuns).set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(heartbeatRuns.id, finalRunId));
    await requestFinalDone();
    const [completedCase] = await db.select().from(cases).where(eq(cases.id, f.caseId));
    expect(completedCase.status).toBe("done");
    // B5-10: the board sees only a bounded current reviewer claim, not raw
    // source content, HMAC digest or permission to execute anything.
    const founderApp = express(); founderApp.use(express.json());
    founderApp.use((req, _res, next) => { req.actor = { type: "board", source: "local_implicit",
      userId: "synthetic-founder", isInstanceAdmin: true }; next(); });
    founderApp.use("/api", caseRoutes(db, {} as never)); founderApp.use(errorHandler);
    const summaryPath = `/api/cases/${f.caseId}/bostan-verification`;
    const currentReview = await request(founderApp).get(summaryPath);
    expect(currentReview.status).toBe(200);
    expect(currentReview.headers["cache-control"]).toContain("no-store");
    expect(currentReview.body).toMatchObject({
      schema: "bostan.verification.board-summary.v1", caseId: f.caseId,
      caseStatus: "done", current: true, provenanceCurrent: true,
      citedDocumentCount: 1, reviewerAgentId: f.verifierId,
      factualRelevanceVerified: false, sourceContentIsUntrusted: true,
      executionAuthorized: false,
    });
    expect(currentReview.body.reportSummary).toContain("Synthetic reviewer checked");
    expect(JSON.stringify(currentReview.body)).not.toContain("implementation source after");
    expect(JSON.stringify(currentReview.body)).not.toContain("sourceSnapshotHmacSha256");
    const agentApp = express(); agentApp.use(express.json());
    agentApp.use((req, _res, next) => { req.actor = { type: "agent", source: "agent_key",
      companyId: f.companyId, agentId: f.verifierId }; next(); });
    agentApp.use("/api", caseRoutes(db, {} as never)); agentApp.use(errorHandler);
    expect((await request(agentApp).get(summaryPath)).status).toBe(403);
    const outsideApp = express(); outsideApp.use(express.json());
    outsideApp.use((req, _res, next) => { req.actor = { type: "board", source: "session",
      userId: "other-company-user", companyIds: [randomUUID()], isInstanceAdmin: false }; next(); });
    outsideApp.use("/api", caseRoutes(db, {} as never)); outsideApp.use(errorHandler);
    expect((await request(outsideApp).get(summaryPath)).status).toBe(404);
    // Rewriting the original source *after Case Done* revokes any claim that
    // today's displayed review still cites the current original revision.
    await documentService(db).upsertIssueDocument({ issueId: f.issueId, key: "bostan-source",
      title: "Implementation source", format: "markdown",
      body: "A later document change after Case Done invalidates historical reviewer provenance.",
      baseRevisionId: (await documentService(db).getIssueDocumentByKey(f.issueId, "bostan-source"))!.latestRevisionId,
      createdByAgentId: f.specialistId, createdByRunId: otherRunId });
    const staleReview = await request(founderApp).get(summaryPath);
    expect(staleReview.status).toBe(200);
    expect(staleReview.body).toMatchObject({ current: false, provenanceCurrent: false,
      reportSummary: null, citedDocumentCount: 0, executionAuthorized: false });
    expect(await db.select().from(toolInvocations)).toHaveLength(0);
  });
  it("B5-08 blocks direct Issue Done until the original independent-review terminal handoff is accepted", async () => {
    const f = await setup();
    const requestDone = () => issueService(db).update(f.issueId, {
      status: "done", actorUserId: "synthetic-founder", companyGuard: f.companyId,
    });
    await expect(requestDone()).rejects.toMatchObject({
      status: 409, details: { code: "bostan_case_terminal_handoff_required" },
    });
    const [before] = await db.select().from(issues).where(eq(issues.id, f.issueId));
    expect(before.status).toBe("todo");
    const [caseRow] = await db.select().from(cases).where(eq(cases.id, f.caseId));
    expect(caseRow.status).toBe("in_progress");
    expect(caseRow.handoffVersion).toBe(1);
    expect(await db.select().from(caseHandoffs)).toHaveLength(0);

    // The opt-out behavior is deliberately unchanged for legacy Cases.
    await db.update(cases).set({ fields: {} }).where(eq(cases.id, f.caseId));
    await requestDone();
    const [afterOrdinary] = await db.select().from(issues).where(eq(issues.id, f.issueId));
    expect(afterOrdinary.status).toBe("done");
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
