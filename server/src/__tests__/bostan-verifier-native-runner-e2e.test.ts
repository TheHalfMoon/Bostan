import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agents, caseHandoffs, cases, companies, createDb, documentRevisions, heartbeatRuns, issues } from "@paperclipai/db";
import { actorMiddleware } from "../middleware/auth.js";
import { errorHandler } from "../middleware/error-handler.js";
import { issueRoutes } from "../routes/issues.js";
import { PaperclipRunnerToolAuthority } from "../services/native-runtime/paperclip-runner-tool-authority.js";
import { documentService } from "../services/documents.js";
import { readBostanIssueDocumentEvidence } from "../services/bostan-knowledge-evidence.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import {
  getBostanFeedbackPostgresTestSupport, startBostanFeedbackPostgresTestDatabase,
} from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
if (!support.supported) console.warn(`B5-14 native tool test skipped: ${support.reason}`);

suite("Bostan B5-14 — full native tool/JWT/HTTP/PG reviewer report authoring", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let http: Server;
  let authority: PaperclipRunnerToolAuthority;
  const companyId = randomUUID(), specialistId = randomUUID(), verifierId = randomUUID();
  const issueId = randomUUID(), caseId = randomUUID(), runId = randomUUID();
  const previousJwtSecret = process.env.PAPERCLIP_AGENT_JWT_SECRET;
  const previousDecisionSecret = process.env.PAPERCLIP_DECISION_SIGNING_SECRET;
  let body: string;
  let sourceDocumentId: string;

  beforeAll(async () => {
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "bostan-native-runner-jwt-integration-synthetic-2026";
    process.env.PAPERCLIP_DECISION_SIGNING_SECRET = "bostan-b5-synthetic-signing-test-0123456789";
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b5-native-jwt-");
    db = createDb(backend.connectionString);
    await instanceSettingsService(db).updateExperimental({ enableCases: true });
    await db.insert(companies).values({ id: companyId, name: "Bostan isolated runner team", issuePrefix: "BNR" });
    await db.insert(agents).values([
      { id: specialistId, companyId, name: "Source specialist", role: "engineer", status: "active", adapterType: "process" },
      { id: verifierId, companyId, name: "Native independent reviewer", role: "engineer", status: "active", adapterType: "paperclip_runner" },
    ]);
    await db.insert(issues).values({ id: issueId, companyId, title: "Independent reviewer task",
      status: "in_progress", workMode: "standard", assigneeAgentId: verifierId });
    await db.insert(cases).values({ id: caseId, companyId, caseNumber: 1, identifier: "BNR-C1",
      caseType: "verification", title: "B5 reviewed case", status: "in_review",
      phase: "verification", handoffVersion: 2, workIssueId: issueId,
      fields: { bostanIndependentVerificationRequired: true } });
    await db.insert(caseHandoffs).values({ id: randomUUID(), companyId, caseId, issueId,
      version: 2, phase: "verification", destinationKind: "agent", state: "delivered",
      fromAgentId: specialistId, toAgentId: verifierId, deliveredAt: new Date(Date.now()-120_000),
      instructions: "Read the current source and author an independent bounded review report",
      actorType: "user", actorId: "synthetic-founder", idempotencyKey: randomUUID(),
      inputFingerprint: "synthetic-b5-native-review-fixture", wakeupRequestId: randomUUID() });
    await db.insert(heartbeatRuns).values({ id: runId, companyId, agentId: verifierId, issueId,
      nativeIssueId: issueId, runtimeMode: "native", status: "running",
      startedAt: new Date(), contextSnapshot: { issueId } });
    await db.update(issues).set({ executionRunId: runId }).where(eq(issues.id, issueId));
    const source = await documentService(db).upsertIssueDocument({ issueId, key: "bostan-source",
      title: "Synthetic source under review", body: "Synthetic output inspected by native reviewer",
      format: "markdown", createdByAgentId: specialistId });
    sourceDocumentId = source.document.id;
    const evidence = await readBostanIssueDocumentEvidence({ db, companyId, issueId,
      documentId: sourceDocumentId, issueReadCondition: sql<boolean>`true` });
    expect(evidence?.sourceSnapshotHmacSha256).toMatch(/^[a-f0-9]{64}$/);
    body = JSON.stringify({ schema: "bostan.verification.report.v1", verdict: "pass",
      summary: "Native integration fixture reviewer checked the currently persisted source and its revision.",
      sources: [{ documentId: sourceDocumentId, expectedSnapshotHmacSha256: evidence!.sourceSnapshotHmacSha256 }] });
    const app = express(); app.use(express.json());
    app.use(actorMiddleware(db, { deploymentMode: "authenticated" }));
    app.use("/api", issueRoutes(db, {} as never)); app.use(errorHandler);
    http = await new Promise<Server>((resolve) => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); });
    const port = (http.address() as AddressInfo).port;
    authority = new PaperclipRunnerToolAuthority(db, { companyId, agentId: verifierId,
      issueId, runId, apiUrl: `http://127.0.0.1:${port}`, apiToolsEnabled: true });
  }, 120_000);
  afterAll(async () => {
    authority?.close();
    if (http) await new Promise<void>((resolve,reject) => http.close(error => error ? reject(error) : resolve()));
    await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup();
    if (previousJwtSecret === undefined) delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
    else process.env.PAPERCLIP_AGENT_JWT_SECRET = previousJwtSecret;
    if (previousDecisionSecret === undefined) delete process.env.PAPERCLIP_DECISION_SIGNING_SECRET;
    else process.env.PAPERCLIP_DECISION_SIGNING_SECRET = previousDecisionSecret;
  });

  it("executes native agent tool over signed JWT and live local HTTP; persists true run-attributed report exactly once", async () => {
    const toolName = "write_task_document";
    expect(authority.definitions().some(tool => tool.name === toolName)).toBe(true);
    const call = { tool: toolName, callId: "bostan-b5-14-native-run-report-create", arguments: {
      taskId: issueId, key: "bostan-verification", title: "Native verifier assessment",
      format: "json", body, baseRevisionId: null,
    } };
    const response = await authority.execute(call);
    expect(response).toMatchObject({ ok: true, status: 201 });
    const saved = await documentService(db).getIssueDocumentByKey(issueId, "bostan-verification");
    expect(saved).toMatchObject({ format: "json", body });
    const [revision] = await db.select({ agentId: documentRevisions.createdByAgentId,
      runId: documentRevisions.createdByRunId }).from(documentRevisions)
      .where(eq(documentRevisions.id, saved!.latestRevisionId));
    expect(revision).toEqual({ agentId: verifierId, runId });
    const repeated = await authority.execute(call);
    expect(repeated).toMatchObject({ ok: true, status: 201 });
    expect(await documentService(db).listIssueDocumentRevisions(issueId, "bostan-verification")).toHaveLength(1);
    const [run] = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, runId));
    expect(Object.keys((run.resultJson as Record<string, any>)?.apiToolReceipts ?? {})).toHaveLength(1);
  });

  it("rejects JSON other than reserved key without changing documents; run closure revokes native tool", async () => {
    await expect(authority.execute({ tool: "write_task_document", callId: "bostan-b5-14-wrong-key",
      arguments: { taskId: issueId, key: "unrelated", title: "No", format: "json",
        body, baseRevisionId: null } })).rejects.toMatchObject({ status: 400 });
    expect(await documentService(db).getIssueDocumentByKey(issueId, "unrelated")).toBeNull();
    await db.update(heartbeatRuns).set({ status: "succeeded", finishedAt: new Date() }).where(eq(heartbeatRuns.id, runId));
    await expect(authority.execute({ tool: "write_task_document", callId: "bostan-b5-14-revoked",
      arguments: { taskId: issueId, key: "bostan-verification", title: "No", format: "json",
        body, baseRevisionId: null } })).rejects.toThrow("paperclip_runner_tool_binding_not_authorized");
  });
});
