import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { documents, issueDocuments, issues, type Db } from "@paperclipai/db";
import { resolveDecisionSigningSecret } from "./decision-signing.js";

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The existing task-document link is the source of truth for citations.
 * This read-only model never copies knowledge into a second index/ledger. */
export async function readBostanIssueDocumentEvidence(input: {
  db: Db | DbTransaction;
  companyId: string;
  issueId: string;
  documentId: string;
  issueReadCondition: SQL<boolean>;
  /** Only inside an existing board claim transaction; hold source rows. */
  lockForShare?: boolean;
}) {
  const sourceQuery = input.db.select({
    companyId: issueDocuments.companyId,
    issueId: issueDocuments.issueId,
    documentId: documents.id,
    key: issueDocuments.key,
    title: documents.title,
    format: documents.format,
    body: documents.latestBody,
    latestRevisionId: documents.latestRevisionId,
    latestRevisionNumber: documents.latestRevisionNumber,
    updatedAt: documents.updatedAt,
    sourceTrust: documents.sourceTrust,
  }).from(issueDocuments).innerJoin(documents, and(
    eq(documents.id, issueDocuments.documentId),
    eq(documents.companyId, issueDocuments.companyId),
  )).innerJoin(issues, and(
    eq(issues.id, issueDocuments.issueId),
    eq(issues.companyId, issueDocuments.companyId),
  )).where(and(
    eq(issueDocuments.companyId, input.companyId),
    eq(issueDocuments.issueId, input.issueId),
    eq(issueDocuments.documentId, input.documentId),
    isNull(issues.hiddenAt), isNull(issues.harnessKind),
    input.issueReadCondition,
  )).limit(1);
  const [source] = input.lockForShare ? await sourceQuery.for("share") : await sourceQuery;
  if (!source) return null;
  // A private, domain-separated fingerprint commits to the ACTUAL current
  // document body, origin task and revision. Raw HMAC input is not returned.
  // This is version provenance, NOT proof that the text is trustworthy.
  const sourceSnapshotHmacSha256 = createHmac("sha256", resolveDecisionSigningSecret())
    .update("bostan-company-issue-document-evidence-v1:")
    .update(JSON.stringify([
      source.companyId, source.issueId, source.documentId, source.key,
      source.title, source.format, source.body, source.latestRevisionId,
      source.latestRevisionNumber, source.updatedAt.toISOString(),
    ])).digest("hex");
  return {
    schema: "bostan.knowledge.document-evidence.v1" as const,
    companyId: source.companyId,
    issueId: source.issueId,
    documentId: source.documentId,
    documentKey: source.key,
    title: source.title,
    format: source.format,
    latestRevisionId: source.latestRevisionId,
    latestRevisionNumber: source.latestRevisionNumber,
    updatedAt: source.updatedAt.toISOString(),
    sourceSnapshotHmacSha256,
    // Deliberately bounded, read-only *untrusted* source content. Downstream
    // agents must not reinterpret source prose as instructions or tool consent.
    excerpt: source.body.slice(0, 1200),
    excerptTruncated: source.body.length > 1200,
    sourceTrust: source.sourceTrust,
    sourceContentIsUntrusted: true as const,
    provenanceVerified: true as const,
    factualRelevanceVerified: false as const,
    executionAuthorized: false as const,
  };
}

/** Fail closed on the *current*, authorized canonical source. This is
 * point-in-time citation freshness, not proof of factual truth or an
 * approval to execute the underlying source text. */
export async function checkBostanIssueDocumentSnapshot(input: Parameters<typeof readBostanIssueDocumentEvidence>[0] & {
  expectedSnapshotHmacSha256: string;
}) {
  const evidence = await readBostanIssueDocumentEvidence(input);
  if (!evidence) return null;
  const expected = input.expectedSnapshotHmacSha256;
  const current = evidence.sourceSnapshotHmacSha256;
  const matches = /^[a-f0-9]{64}$/.test(expected) &&
    timingSafeEqual(Buffer.from(current, "hex"), Buffer.from(expected, "hex"));
  return {
    schema: "bostan.knowledge.document-snapshot-freshness.v1" as const,
    companyId: input.companyId,
    issueId: input.issueId,
    documentId: input.documentId,
    snapshotCurrent: matches,
    // No source text, expected/current HMAC, private document titles or
    // attributes in this short advisory response.
    decisionCommitAuthorized: false as const,
    factualRelevanceVerified: false as const,
    sourceContentIsUntrusted: true as const,
    checkedAt: new Date().toISOString(),
  };
}

/** All-or-nothing, one MVCC snapshot of cited source commitments.
 * No index, stored dossier, future-state guarantee or action permission. */
export async function checkBostanDocumentSnapshotBatch(input: {
  db: Db;
  companyId: string;
  issueReadCondition: SQL<boolean>;
  sources: Array<{ issueId: string; documentId: string; expectedSnapshotHmacSha256: string }>;
}) {
  if (input.sources.length === 0 || input.sources.length > 10) throw new Error("Bostan citation set size is invalid");
  const pairs = new Set(input.sources.map(source => `${source.issueId}:${source.documentId}`));
  if (pairs.size !== input.sources.length) throw new Error("Bostan citation set must be unique");
  // Multi-statement checks must see one stable PostgreSQL source snapshot:
  // prevent mixed-version verdicts across the cited document set.
  const allCurrent = await input.db.transaction(async (tx) => {
    for (const source of input.sources) {
      const current = await checkBostanIssueDocumentSnapshot({
        db: tx, companyId: input.companyId,
        issueReadCondition: input.issueReadCondition,
        ...source,
      });
      if (!current?.snapshotCurrent) return false;
    }
    return true;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  return {
    schema: "bostan.knowledge.citation-set-freshness.v1" as const,
    companyId: input.companyId,
    citationsChecked: input.sources.length,
    allSnapshotsCurrent: allCurrent,
    factualRelevanceVerified: false as const,
    decisionCommitAuthorized: false as const,
    sourceContentIsUntrusted: true as const,
    checkedAt: new Date().toISOString(),
  };
}
