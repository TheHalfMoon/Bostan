import { createHash, randomUUID } from "node:crypto";
import { link, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, executionWorkspaces, issues, toolInvocations, workspaceOperations } from "@bostan/db";
import { toolGatewayRoutes } from "../routes/tool-gateway.js";
import { classifyBostanActionEvidence, readBostanActionEvidence } from "../services/bostan-action-evidence.js";
import { verifyBostanLocalFileContent } from "../services/bostan-local-file-readback.js";
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

describe("Bostan B3-02 independently reads local artifact content, not the tool result", () => {
  it("verifies the real bytes, and fails closed after an in-place content change", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bostan-b3-local-readback-"));
    try {
      const filename = path.join(root, "product.txt");
      const original = Buffer.from("first state produced by a synthetic actor");
      const sha = createHash("sha256").update(original).digest("hex");
      await writeFile(filename, original);
      const common = { trustedWorkspaceRoot: root, relativePath: "product.txt",
        expectedSha256: sha, expectedByteSize: original.length };
      expect(await verifyBostanLocalFileContent(common)).toMatchObject({ state: "matches_expected_content", contentReadbackMatched: true });
      await writeFile(filename, Buffer.from("alter state produced by a synthetic actor"));
      expect(await verifyBostanLocalFileContent(common)).toMatchObject({ state: "content_mismatch", contentReadbackMatched: false });
      expect(await verifyBostanLocalFileContent({ ...common, relativePath: "missing.txt" }))
        .toMatchObject({ state: "file_missing", contentReadbackMatched: false });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("refuses traversal, symlink final target and symlink parent directories", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bostan-b3-link-readback-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "bostan-b3-outside-"));
    try {
      const data = Buffer.from("secret must never leak");
      await writeFile(path.join(outside, "outside.txt"), data);
      await symlink(path.join(outside, "outside.txt"), path.join(root, "alias.txt"));
      await link(path.join(outside, "outside.txt"), path.join(root, "hardlink.txt"));
      await symlink(outside, path.join(root, "linked-dir"));
      await mkdir(path.join(root, "safe"));
      const common = { trustedWorkspaceRoot: root,
        expectedSha256: createHash("sha256").update(data).digest("hex"), expectedByteSize: data.length };
      for (const relativePath of ["../outside.txt", "/etc/passwd", "nested/../../outside.txt", "safe\\evil.txt", "", "."]) {
        expect(await verifyBostanLocalFileContent({ ...common, relativePath }))
          .toMatchObject({ state: "unreadable_or_unsafe", contentReadbackMatched: false });
      }
      for (const relativePath of ["alias.txt", "linked-dir/outside.txt", "hardlink.txt"]) {
        expect(await verifyBostanLocalFileContent({ ...common, relativePath }))
          .toMatchObject({ state: "unreadable_or_unsafe", contentReadbackMatched: false });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
  it("rejects unexpected byte lengths, overly large limits, malformed hashes and roots", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bostan-b3-size-readback-"));
    try {
      await writeFile(path.join(root, "output.txt"), "test");
      const base = { trustedWorkspaceRoot: root, relativePath: "output.txt",
        expectedSha256: createHash("sha256").update("test").digest("hex"), expectedByteSize: 4 };
      expect((await verifyBostanLocalFileContent({ ...base, expectedByteSize: 3 })).state).toBe("content_mismatch");
      expect((await verifyBostanLocalFileContent({ ...base, expectedByteSize: 9_000_000 })).state).toBe("unreadable_or_unsafe");
      expect((await verifyBostanLocalFileContent({ ...base, expectedSha256: "nothex" })).state).toBe("unreadable_or_unsafe");
      expect((await verifyBostanLocalFileContent({ ...base, trustedWorkspaceRoot: path.join(root, "unavailable") })).state).toBe("file_missing");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

suite("Bostan B3 board-only action status with real SQL", () => {
  let backend: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let companyId: string, otherCompany: string;
  beforeAll(async () => {
    backend = await startBostanFeedbackPostgresTestDatabase("bostan-b3-action-evidence-");
    db = createDb(backend.connectionString);
    process.env.PAPERCLIP_DECISION_SIGNING_SECRET = "bostan-test-only-signing-secret-0123456789";
  }, 120_000);
  afterEach(async () => { await db.execute(sql`TRUNCATE TABLE companies CASCADE`); });
  afterAll(async () => { await db?.$client?.end?.({ timeout: 0 }); await backend?.cleanup(); delete process.env.PAPERCLIP_DECISION_SIGNING_SECRET; });
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
  it("B3-02 confines a board-authorized HTTP file check to the invocation's own company issue workspace", async () => {
    await seed();
    const root = await mkdtemp(path.join(os.tmpdir(), "bostan-b3-db-readback-"));
    try {
      const content = Buffer.from("local output actually observed from independent filesystem open");
      await writeFile(path.join(root, "receipt.txt"), content);
      const issueId = randomUUID();
      await db.insert(issues).values({ id: issueId, companyId, title: "B3 readback origin", status: "in_progress", priority: "medium" });
      const [invocation] = await db.insert(toolInvocations).values({
        companyId, issueId, toolName: "synthetic_file_write", status: "succeeded", riskLevel: "write",
        resultHash: "not-an-independent-proof",
      }).returning();
      const [workspace] = await db.insert(executionWorkspaces).values({
        companyId, sourceIssueId: issueId, mode: "task", strategyType: "local", name: "B3 scoped workspace",
        status: "active", providerType: "local_fs", cwd: root,
      }).returning();
      const board = appWithActor({ type: "board", source: "local_implicit", userId: "local", companyIds: [companyId] });
      const payload = { companyId, workspaceId: workspace.id, invocationId: invocation.id,
        relativePath: "receipt.txt", expectedSha256: createHash("sha256").update(content).digest("hex"),
        expectedByteSize: content.length };
      const url = "/api/tool-gateway/bostan-local-file-readback";
      const observed = await request(board).post(url).send(payload);
      expect(observed.status).toBe(200);
      expect(observed.body).toMatchObject({ state: "matches_expected_content", contentReadbackMatched: true,
        independentEffectVerified: false, autoRetrySafe: false });
      expect(JSON.stringify(observed.body)).not.toContain(root);
      expect(JSON.stringify(observed.body)).not.toContain("not-an-independent-proof");
      expect(JSON.stringify(observed.body)).not.toContain(content.toString());
      expect(observed.body.receiptId).toMatch(/^[a-f0-9-]{36}$/);
      const receiptUrl = `/api/tool-gateway/bostan-local-file-readback/${observed.body.receiptId}?companyId=${companyId}`;
      const trustedReceipt = await request(board).get(receiptUrl);
      expect(trustedReceipt.status).toBe(200);
      expect(trustedReceipt.body).toMatchObject({ receiptIntegrityValid: true,
        readbackState: "matches_expected_content", independentEffectVerified: false });
      expect(JSON.stringify(trustedReceipt.body)).not.toContain(payload.expectedSha256);
      expect(JSON.stringify(trustedReceipt.body)).not.toContain("receipt.txt");
      const recheckUrl = `/api/tool-gateway/bostan-local-file-readback/${observed.body.receiptId}/recheck`;
      const wrongPath = await request(board).post(recheckUrl).send({ ...payload, relativePath: "different.txt" });
      expect(wrongPath.status).toBe(409);
      expect(wrongPath.body).toMatchObject({ reasonCode: "request_binding_mismatch" });
      const wrongHash = await request(board).post(recheckUrl).send({ ...payload,
        expectedSha256: createHash("sha256").update("fabricated digest").digest("hex") });
      expect(wrongHash.status).toBe(409);
      const firstFresh = await request(board).post(recheckUrl).send(payload);
      expect(firstFresh.status).toBe(200);
      expect(firstFresh.body).toMatchObject({ priorReceiptId: observed.body.receiptId,
        currentState: "matches_expected_content", currentContentReadbackMatched: true,
        independentEffectVerified: false, autoRetrySafe: false });
      expect(firstFresh.body.freshReceiptId).not.toBe(observed.body.receiptId);
      const freshReceipt = await request(board).get(
        `/api/tool-gateway/bostan-local-file-readback/${firstFresh.body.freshReceiptId}?companyId=${companyId}`);
      expect(freshReceipt.body).toMatchObject({ receiptIntegrityValid: true,
        readbackState: "matches_expected_content", independentEffectVerified: false });
      expect((await request(appWithActor({type: "agent", source: "agent_jwt", companyId,
        agentId: randomUUID(), runId: randomUUID()})).get(receiptUrl)).status).toBe(403);
      const [stored] = await db.select().from(workspaceOperations)
        .where(eq(workspaceOperations.id, observed.body.receiptId));
      expect(stored).toMatchObject({ companyId, phase: "bostan_local_artifact_readback", status: "succeeded" });
      expect(JSON.stringify(stored.metadata)).not.toContain(payload.expectedSha256);
      expect(JSON.stringify(stored.metadata)).not.toContain("receipt.txt");
      // The DB can be modified, but the host-issued HMAC is not forgeable
      // without the private signer. It must never be accepted after tampering.
      await db.update(workspaceOperations).set({
        metadata: { ...stored.metadata, state: "content_mismatch" },
      }).where(eq(workspaceOperations.id, stored.id));
      const forged = await request(board).get(receiptUrl);
      expect(forged.status).toBe(200);
      expect(forged.body).toMatchObject({ receiptIntegrityValid: false,
        readbackState: "unverifiable", independentEffectVerified: false });
      const forgedRecheck = await request(board).post(recheckUrl).send(payload);
      expect(forgedRecheck.status).toBe(409);
      expect(forgedRecheck.body).toMatchObject({ reasonCode: "invalid_prior_receipt" });
      await db.update(workspaceOperations).set({ metadata: { ...stored.metadata, injectedField: "should-fail" } })
        .where(eq(workspaceOperations.id, stored.id));
      const injected = await request(board).get(receiptUrl);
      expect(injected.body).toMatchObject({ receiptIntegrityValid: false,
        readbackState: "unverifiable" });
      const foreignReceipt = await request(board).get(
        `/api/tool-gateway/bostan-local-file-readback/${observed.body.receiptId}?companyId=${otherCompany}`);
      expect(foreignReceipt.status).toBe(404);
      // A second filesystem read observes mutation, independent of the prior
      // tool's reported result digest or the first readback response.
      await writeFile(path.join(root, "receipt.txt"), Buffer.from("independent content changed"));
      const changed = await request(board).post(url).send(payload);
      expect(changed.status).toBe(200);
      expect(changed.body).toMatchObject({ state: "content_mismatch",
        contentReadbackMatched: false, independentEffectVerified: false });
      const mismatchReceipt = await request(board).get(
        `/api/tool-gateway/bostan-local-file-readback/${changed.body.receiptId}?companyId=${companyId}`);
      expect(mismatchReceipt.body).toMatchObject({ receiptIntegrityValid: true,
        readbackState: "content_mismatch", independentEffectVerified: false });
      // The original signed fresh readback is immutable; its recheck must
      // independently read the changed file and produce a NEW signed receipt.
      const changedAgain = await request(board).post(
        `/api/tool-gateway/bostan-local-file-readback/${firstFresh.body.freshReceiptId}/recheck`).send(payload);
      expect(changedAgain.status).toBe(200);
      expect(changedAgain.body).toMatchObject({ currentState: "content_mismatch",
        currentContentReadbackMatched: false, independentEffectVerified: false });
      expect(changedAgain.body.freshReceiptId).not.toBe(firstFresh.body.freshReceiptId);
      const changedAgainProof = await request(board).get(
        `/api/tool-gateway/bostan-local-file-readback/${changedAgain.body.freshReceiptId}?companyId=${companyId}`);
      expect(changedAgainProof.body).toMatchObject({ receiptIntegrityValid: true,
        readbackState: "content_mismatch", independentEffectVerified: false });
      const crossTenantRecheck = await request(board).post(recheckUrl).send({ ...payload, companyId: otherCompany });
      expect(crossTenantRecheck.status).toBe(404);
      const agentRecheck = await request(appWithActor({ type: "agent", source: "agent_jwt", companyId,
        agentId: randomUUID(), runId: randomUUID() })).post(recheckUrl).send(payload);
      expect(agentRecheck.status).toBe(403);
      const other = await request(board).post(url).send({ ...payload, companyId: otherCompany });
      expect(other.status).toBe(404);
      const agent = appWithActor({ type: "agent", source: "agent_jwt", companyId, agentId: randomUUID(), runId: randomUUID() });
      expect((await request(agent).post(url).send(payload)).status).toBe(403);
      expect((await request(board).post(url).send({ ...payload, relativePath: "../receipt.txt" })).body)
        .toMatchObject({ state: "unreadable_or_unsafe", independentEffectVerified: false });
      // Workspace from a different source issue cannot be used as the root.
      const [wrong] = await db.insert(toolInvocations).values({ companyId,
        toolName: "synthetic_other_issue", status: "succeeded", riskLevel: "write" }).returning();
      expect((await request(board).post(url).send({ ...payload, invocationId: wrong.id })).status).toBe(404);
    } finally { await rm(root, { recursive: true, force: true }); }
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
