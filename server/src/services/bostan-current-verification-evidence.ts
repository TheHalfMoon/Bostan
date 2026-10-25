import { z } from "zod";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { caseHandoffs, documentRevisions, documents, heartbeatRuns, issueDocuments, type cases, type issues, type Db } from "@paperclipai/db";
import { conflict } from "../errors.js";
import { checkBostanIssueDocumentSnapshot } from "./bostan-knowledge-evidence.js";

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type CaseRow = typeof cases.$inferSelect;
type IssueRow = typeof issues.$inferSelect;

const bostanVerifierReport = z.object({
  schema: z.literal("bostan.verification.report.v1"),
  verdict: z.literal("pass"),
  summary: z.string().trim().min(40).max(3_000),
  sources: z.array(z.object({
    documentId: z.string().uuid(),
    expectedSnapshotHmacSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).min(1).max(10),
}).strict().superRefine((report, context) => {
  if (new Set(report.sources.map(source => source.documentId)).size !== report.sources.length) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Review sources must be unique" });
  }
});

/** Opt-in cases cannot be closed straight from implementation. The
 * canonical handoff *delivery* receipt must identify a distinct agent who
 * now owns the verification task. Delivery is NOT review completion. */
export async function assertBostanCurrentVerificationEvidence(tx: Db | DbTransaction, caseRow: CaseRow, issue: IssueRow, verificationHandoffVersion = caseRow.handoffVersion) {
  if (caseRow.fields?.bostanIndependentVerificationRequired !== true) return;
  if (caseRow.phase !== "verification" || !issue.assigneeAgentId) {
    throw conflict("Independent verification has not been handed to a reviewer", {
      code: "bostan_verification_handoff_required",
    });
  }
  const [delivered] = await tx.select({ id: caseHandoffs.id, deliveredAt: caseHandoffs.deliveredAt }).from(caseHandoffs).where(and(
    eq(caseHandoffs.companyId, caseRow.companyId),
    eq(caseHandoffs.caseId, caseRow.id),
    eq(caseHandoffs.version, verificationHandoffVersion),
    eq(caseHandoffs.issueId, issue.id),
    eq(caseHandoffs.phase, "verification"),
    eq(caseHandoffs.destinationKind, "agent"),
    eq(caseHandoffs.state, "delivered"),
    eq(caseHandoffs.toAgentId, issue.assigneeAgentId),
    sql`${caseHandoffs.fromAgentId} is not null and ${caseHandoffs.fromAgentId} <> ${caseHandoffs.toAgentId}`,
  )).limit(1);
  if (!delivered?.deliveredAt) {
    throw conflict("Independent verifier handoff delivery has not been recorded", {
      code: "bostan_verification_handoff_required",
    });
  }
  // A queued/delivered assignment is NOT evidence that the verifier
  // executed anything. Require a real, finished successful run from the
  // current reviewer, bound to the exact company and case work task, with
  // its finish after the independent handoff was delivered. The source
  // heartbeat runtime, not a model-authored comment, owns run status.
  const successfulReviewerRuns = await tx.select({ id: heartbeatRuns.id, startedAt: heartbeatRuns.startedAt, finishedAt: heartbeatRuns.finishedAt }).from(heartbeatRuns).where(and(
    eq(heartbeatRuns.companyId, caseRow.companyId),
    eq(heartbeatRuns.agentId, issue.assigneeAgentId),
    eq(heartbeatRuns.status, "succeeded"),
    gte(heartbeatRuns.startedAt, delivered.deliveredAt),
    gte(heartbeatRuns.finishedAt, delivered.deliveredAt),
    lte(heartbeatRuns.finishedAt, new Date()),
    or(eq(heartbeatRuns.issueId, issue.id), eq(heartbeatRuns.nativeIssueId, issue.id),
      sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issue.id}`),
  )).orderBy(desc(heartbeatRuns.finishedAt)).limit(10).for("share");
  if (successfulReviewerRuns.length === 0) {
    throw conflict("Independent reviewer has not completed a successful task run", {
      code: "bostan_verifier_run_required",
    });
  }
  // A green agent run is not a review record. Require the current
  // version of a canonical, linked review document to be authored by the
  // *same successful verifier run*, not by the original implementer or a
  // different/old run. The private content is never copied into a case
  // field, comment or a second evidence store.
  const [reviewDocument] = await tx.select({
    id: documents.id, body: documents.latestBody, format: documents.format,
    revisionAt: documentRevisions.createdAt,
    runId: documentRevisions.createdByRunId,
  }).from(issueDocuments)
    .innerJoin(documents, and(eq(documents.id, issueDocuments.documentId),
      eq(documents.companyId, issueDocuments.companyId)))
    .innerJoin(documentRevisions, and(eq(documentRevisions.id, documents.latestRevisionId),
      eq(documentRevisions.documentId, documents.id),
      eq(documentRevisions.companyId, documents.companyId)))
    .where(and(
      eq(issueDocuments.companyId, caseRow.companyId),
      eq(issueDocuments.issueId, issue.id),
      eq(issueDocuments.key, "bostan-verification"),
      sql`${documents.sourceTrust} is null`,
      eq(documentRevisions.createdByAgentId, issue.assigneeAgentId),
      inArray(documentRevisions.createdByRunId, successfulReviewerRuns.map(run => run.id)),
      gte(documentRevisions.createdAt, delivered.deliveredAt),
    )).for("share").limit(1);
  const matchingRun = successfulReviewerRuns.find(run => run.id === reviewDocument?.runId);
  if (!reviewDocument || !matchingRun?.startedAt || !matchingRun.finishedAt ||
    reviewDocument.revisionAt < matchingRun.startedAt ||
    reviewDocument.revisionAt > matchingRun.finishedAt) {
    throw conflict("Current independent reviewer document has no completed-run provenance", {
      code: "bostan_verifier_document_required",
    });
  }
  // A free-form model claim does not bind the asserted review to any real
  // source. The current reviewer-authored JSON report must cite actual
  // CURRENT canonical issue documents by their B4 private snapshot HMACs.
  // This validates version/provenance, not model factual judgment.
  let rawReport: unknown;
  try { rawReport = JSON.parse(reviewDocument.body); } catch { rawReport = null; }
  const parsed = reviewDocument.format === "json"
    ? bostanVerifierReport.safeParse(rawReport) : { success: false as const };
  if (!parsed.success || parsed.data.sources.some(source => source.documentId === reviewDocument.id)) {
    throw conflict("Independent reviewer report is missing bounded linked evidence", {
      code: "bostan_verifier_report_invalid",
    });
  }
  for (const source of parsed.data.sources) {
    const current = await checkBostanIssueDocumentSnapshot({
      db: tx, companyId: caseRow.companyId, issueId: issue.id,
      documentId: source.documentId,
      expectedSnapshotHmacSha256: source.expectedSnapshotHmacSha256,
      issueReadCondition: sql<boolean>`true`, lockForShare: true,
    });
    if (!current?.snapshotCurrent) {
      throw conflict("Review report refers to missing or changed source evidence", {
        code: "bostan_verifier_source_stale",
      });
    }
  }
}
