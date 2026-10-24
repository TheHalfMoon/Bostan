import { and, eq } from "drizzle-orm";
import { toolInvocations, type Db } from "@paperclipai/db";

/** A tool's upstream success is NOT an independent proof of external effects.
 * No provider readback exists in this first Action Fabric status wave. */
export function classifyBostanActionEvidence(row: Pick<typeof toolInvocations.$inferSelect,
  "id" | "companyId" | "status" | "riskLevel" | "resultHash" | "completedAt">) {
  const potentiallySideEffectful = !row.riskLevel || !["low", "read"].includes(row.riskLevel);
  const pending = ["pending", "authorized", "awaiting_approval", "executing"].includes(row.status);
  const nondispatched = ["denied", "rate_limited"].includes(row.status);
  const ambiguous = row.status === "timed_out" ||
    (potentiallySideEffectful && ["failed", "cancelled"].includes(row.status));
  const needsReadback = row.status === "succeeded" && potentiallySideEffectful;
  const assessment = pending ? "in_progress" : nondispatched ? "not_dispatched" :
    ambiguous ? "external_outcome_unknown" : needsReadback ? "readback_required" :
    row.status === "succeeded" ? "reported_result_unverified" : "failed_or_cancelled";
  return {
    invocationId: row.id,
    companyId: row.companyId,
    invocationStatus: row.status,
    riskLevel: row.riskLevel,
    assessment,
    hasResultDigest: Boolean(row.resultHash),
    completedAt: row.completedAt?.toISOString() ?? null,
    independentEffectVerified: false,
    autoRetrySafe: false,
    nextAction: ambiguous ? "operator_reconcile_before_any_retry"
      : needsReadback ? "independent_provider_state_readback_required"
      : pending ? "await_terminal_receipt"
      : "no_verified_external_effect_claim",
    note: "A recorded gateway result is not independent proof that an external change occurred.",
  };
}

export async function readBostanActionEvidence(db: Db, companyId: string, invocationId: string) {
  const [row] = await db.select({
    id: toolInvocations.id,
    companyId: toolInvocations.companyId,
    status: toolInvocations.status,
    riskLevel: toolInvocations.riskLevel,
    resultHash: toolInvocations.resultHash,
    completedAt: toolInvocations.completedAt,
  }).from(toolInvocations).where(and(eq(toolInvocations.id, invocationId), eq(toolInvocations.companyId, companyId)));
  return row ? classifyBostanActionEvidence(row) : null;
}
