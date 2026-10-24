import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { executionWorkspaces, toolInvocations, workspaceOperations, type Db } from "@paperclipai/db";
import { resolveDecisionSigningSecret } from "./decision-signing.js";
import { verifyBostanCompanyWorkspaceFile } from "./bostan-local-file-readback.js";

// A signed receipt is the SERVER's statement about its independent file
// readback at a point in time, not proof that a specific tool mutated it.
const SCHEMA = "bostan.local-file-readback-receipt.v1";
const receiptFields = z.object({
  schema: z.literal(SCHEMA),
  receiptId: z.string().uuid(),
  companyId: z.string().uuid(),
  issueId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  invocationId: z.string().uuid(),
  state: z.enum(["matches_expected_content", "content_mismatch", "file_missing",
    "unreadable_or_unsafe", "changed_during_read"]),
  contentReadbackMatched: z.boolean(),
  checkedAt: z.string().datetime(),
  requestHmacSha256: z.string().regex(/^[a-f0-9]{64}$/),
  independentEffectVerified: z.literal(false),
  autoRetrySafe: z.literal(false),
}).strict();

type ReceiptFields = z.infer<typeof receiptFields>;
function signedBytes(fields: ReceiptFields) {
  return JSON.stringify([
    SCHEMA, fields.receiptId, fields.companyId, fields.issueId,
    fields.workspaceId, fields.invocationId, fields.state,
    fields.contentReadbackMatched, fields.checkedAt, fields.requestHmacSha256,
    false, false,
  ]);
}
function hmac(domain: string, bytes: string) {
  return createHmac("sha256", resolveDecisionSigningSecret()).update(domain).update(bytes).digest("hex");
}

export async function recordBostanLocalFileReadback(input: Parameters<typeof verifyBostanCompanyWorkspaceFile>[0]) {
  // The source read itself is company+origin-issue+workspace scoped and must
  // finish BEFORE recording a host-owned statement about observed content.
  const observed = await verifyBostanCompanyWorkspaceFile(input);
  if (!observed) return null;
  const [scoped] = await input.db.select({
    issueId: executionWorkspaces.sourceIssueId, runId: toolInvocations.runId,
  }).from(toolInvocations)
    .innerJoin(executionWorkspaces, and(
      eq(executionWorkspaces.id, input.workspaceId),
      eq(executionWorkspaces.companyId, toolInvocations.companyId),
      eq(executionWorkspaces.sourceIssueId, toolInvocations.issueId),
    )).where(and(eq(toolInvocations.companyId, input.companyId), eq(toolInvocations.id, input.invocationId)));
  if (!scoped?.issueId) return null;
  const checkedAt = new Date().toISOString();
  // Neither the raw path nor the expected digest is persisted in the DB.
  // The request fingerprint is private-keyed to resist dictionary guessing.
  const requestHmacSha256 = hmac("bostan-local-file-readback-request-v1:", JSON.stringify([
    input.companyId, input.workspaceId, input.invocationId, input.relativePath,
    input.expectedSha256, input.expectedByteSize,
  ]));
  const fields: ReceiptFields = {
    schema: SCHEMA, receiptId: randomUUID(), companyId: input.companyId,
    issueId: scoped.issueId, workspaceId: input.workspaceId,
    invocationId: input.invocationId, state: observed.state,
    contentReadbackMatched: observed.contentReadbackMatched,
    checkedAt, requestHmacSha256, independentEffectVerified: false,
    autoRetrySafe: false,
  };
  const signatureHmacSha256 = hmac("bostan-local-file-readback-receipt-v1:", signedBytes(fields));
  await input.db.insert(workspaceOperations).values({
    id: fields.receiptId, companyId: input.companyId,
    issueId: scoped.issueId, executionWorkspaceId: input.workspaceId,
    heartbeatRunId: scoped.runId,
    phase: "bostan_local_artifact_readback",
    status: observed.contentReadbackMatched ? "succeeded" : "failed",
    startedAt: new Date(checkedAt), finishedAt: new Date(checkedAt),
    metadata: { ...fields, signatureHmacSha256 },
  });
  return { ...observed, invocationId: input.invocationId,
    workspaceId: input.workspaceId, independentEffectVerified: false,
    autoRetrySafe: false, receiptId: fields.receiptId };
}

export async function inspectBostanLocalReadbackReceipt(db: Db, companyId: string, receiptId: string) {
  const [row] = await db.select().from(workspaceOperations).where(and(
    eq(workspaceOperations.id, receiptId), eq(workspaceOperations.companyId, companyId),
    eq(workspaceOperations.phase, "bostan_local_artifact_readback"),
  ));
  if (!row) return null;
  const signature = (row.metadata as Record<string, unknown> | null)?.signatureHmacSha256;
  // The shared DB privacy trigger appends these two reserved provenance
  // fields to workspace operation metadata. They are neither receipt claims
  // nor signer-controlled content. Refuse every other unexpected field.
  const reservedDbKeys = new Set(["_runPrivacySources", "_issuePrivacySources"]);
  const signedClaimKeys = new Set(Object.keys(receiptFields.shape));
  const raw = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const hasUnexpected = Object.keys(raw).some(key =>
    key !== "signatureHmacSha256" && !signedClaimKeys.has(key) && !reservedDbKeys.has(key));
  const claimed = Object.fromEntries(Object.entries(raw)
    .filter(([key]) => signedClaimKeys.has(key)));
  const checked = receiptFields.safeParse(claimed);
  const record = checked.success ? checked.data : null;
  let authenticated = false;
  if (!hasUnexpected && record && typeof signature === "string" && /^[a-f0-9]{64}$/.test(signature)) {
    const expected = hmac("bostan-local-file-readback-receipt-v1:", signedBytes(record));
    authenticated = timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  }
  const valid = authenticated && record !== null &&
    record.companyId === companyId && record.receiptId === row.id &&
    record.issueId === row.issueId && record.workspaceId === row.executionWorkspaceId &&
    (record.contentReadbackMatched ? row.status === "succeeded" : row.status === "failed") &&
    record.contentReadbackMatched === (record.state === "matches_expected_content");
  return {
    receiptId: row.id,
    receiptIntegrityValid: Boolean(valid),
    readbackState: valid && record ? record.state : "unverifiable",
    observedAt: valid && record ? record.checkedAt : null,
    independentEffectVerified: false,
    autoRetrySafe: false,
  };
}
