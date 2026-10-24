import { createHmac } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { budgetPolicies, heartbeatRuns, issues, type Db } from "@paperclipai/db";
import { addCents, unitsToCents, usdToUnits } from "@paperclipai/shared";
import { budgetPoliciesForRun, computeObservedSpends } from "./budgets.js";
import { resolveDecisionSigningSecret } from "./decision-signing.js";

/** Recheck a signed B2 recommendation at board-choice time. This is advice
 * only, so it does not allocate funds or grant an external effect. Callers
 * must hold the decision row inside a transaction before calling this. */
export async function isBostanRecommendationFresh(db: Db, decision: {
  companyId: string; originAgentId: string; originRunId: string;
  metadata: Record<string, unknown>;
}): Promise<boolean> {
  const metadata = decision.metadata;
  const evidenceIds = metadata.evidenceIssueIds;
  if (!Array.isArray(evidenceIds) || !evidenceIds.length || evidenceIds.length > 10 ||
      !evidenceIds.every(id => typeof id === "string" && z.string().uuid().safeParse(id).success) ||
      typeof metadata.evidenceSnapshotHmacSha256 !== "string" ||
      typeof metadata.boardBudgetPolicySnapshotHmacSha256 !== "string" ||
      typeof metadata.estimatedCostUsd !== "number" || !Number.isFinite(metadata.estimatedCostUsd) ||
      metadata.estimatedCostUsd < 0) return false;
  const referenced = await db.select({
    id: issues.id, status: issues.status, projectId: issues.projectId,
    updatedAt: issues.updatedAt, title: issues.title, description: issues.description,
  }).from(issues).where(and(eq(issues.companyId, decision.companyId), inArray(issues.id, evidenceIds))).for("share");
  if (referenced.length !== evidenceIds.length) return false;
  const evidenceHmac = createHmac("sha256", resolveDecisionSigningSecret())
    .update("bostan-evidence-issue-snapshot-v1:")
    .update(JSON.stringify([...referenced].sort((a, b) => a.id.localeCompare(b.id)).map(ref => ({
      id: ref.id, status: ref.status, projectId: ref.projectId,
      updatedAt: ref.updatedAt.toISOString(), title: ref.title, description: ref.description ?? null,
    }))))
    .digest("hex");
  if (evidenceHmac !== metadata.evidenceSnapshotHmacSha256) return false;
  const [run] = await db.select({ contextSnapshot: heartbeatRuns.contextSnapshot })
    .from(heartbeatRuns).where(and(eq(heartbeatRuns.id, decision.originRunId),
      eq(heartbeatRuns.companyId, decision.companyId), eq(heartbeatRuns.agentId, decision.originAgentId)));
  const originIssueId = typeof run?.contextSnapshot?.issueId === "string" ? run.contextSnapshot.issueId : null;
  if (!originIssueId) return false;
  const [origin] = await db.select({ projectId: issues.projectId }).from(issues)
    .where(and(eq(issues.id, originIssueId), eq(issues.companyId, decision.companyId))).for("share");
  if (!origin) return false;
  const policies = await db.select().from(budgetPolicies).where(and(
    eq(budgetPolicies.companyId, decision.companyId), eq(budgetPolicies.isActive, true),
    eq(budgetPolicies.hardStopEnabled, true), eq(budgetPolicies.metric, "billed_cents"),
    budgetPoliciesForRun(decision.companyId, decision.originAgentId, origin.projectId),
  )).for("share");
  const eligible = policies.filter(policy => policy.amount > 0);
  const observed = await computeObservedSpends(db, eligible);
  const estimated = unitsToCents(usdToUnits(metadata.estimatedCostUsd));
  const snapshot = eligible.map((policy, index) => {
    const used = addCents(observed[index].totalExact, observed[index].effectiveHeldCents);
    return { policyId: policy.id, scopeType: policy.scopeType, scopeId: policy.scopeId,
      windowKind: policy.windowKind, limitCents: policy.amount,
      observedCents: used, estimatedCents: estimated, projectedCents: addCents(used, estimated),
      enforcementVersion: policy.enforcementVersion };
  });
  const hmac = createHmac("sha256", resolveDecisionSigningSecret())
    .update("bostan-board-budget-snapshot-v1:")
    .update(JSON.stringify(snapshot.sort((a,b) => a.policyId.localeCompare(b.policyId))))
    .digest("hex");
  return hmac === metadata.boardBudgetPolicySnapshotHmacSha256;
}
