import { createHmac } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { budgetPolicies, heartbeatRuns, issues, type Db } from "@paperclipai/db";
import { addCents, compareCents, unitsToCents, usdToUnits } from "@paperclipai/shared";
import { budgetPoliciesForRun, computeObservedSpends } from "./budgets.js";
import { unprocessable } from "../errors.js";
import { authorizationService, type AuthorizationActor } from "./authorization.js";
import { decisionService, type DecisionServiceOptions } from "./decisions.js";
import { resolveDecisionSigningSecret } from "./decision-signing.js";

// Bostan B2 extends the imported, signed, company-scoped decision authority.
// A recommendation is NEVER permission to dispatch tools or to modify tasks.
export const bostanRecommendationSchema = z.object({
  title: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(4_000),
  alternatives: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,59}$/),
    label: z.string().trim().min(1).max(240),
    rationale: z.string().trim().min(1).max(1_000),
  }).strict()).min(2).max(6),
  recommendedOptionId: z.string().regex(/^[a-z][a-z0-9_-]{0,59}$/),
  confidence: z.number().finite().min(0).max(1), // Self-reported; NOT calibrated accuracy
  estimatedCostUsd: z.number().finite().min(0).max(1_000_000),
  costCeilingUsd: z.number().finite().min(0).max(1_000_000),
  evidenceIssueIds: z.array(z.string().uuid()).min(1).max(10),
  idempotencyKey: z.string().trim().min(1).max(500),
}).strict().superRefine((value, context) => {
  if (new Set(value.evidenceIssueIds).size !== value.evidenceIssueIds.length) {
    context.addIssue({ code: "custom", message: "Evidence issue IDs must be unique", path: ["evidenceIssueIds"] });
  }
  if (new Set(value.alternatives.map(option => option.id)).size !== value.alternatives.length) {
    context.addIssue({ code: "custom", message: "Alternative IDs must be unique", path: ["alternatives"] });
  }
  if (!value.alternatives.some(option => option.id === value.recommendedOptionId)) {
    context.addIssue({ code: "custom", message: "Recommended choice must exist", path: ["recommendedOptionId"] });
  }
});
export type BostanRecommendationInput = z.infer<typeof bostanRecommendationSchema>;
const REPORTED_CONFIDENCE_FLOOR = 0.75;

export async function createBostanRecommendation(input: {
  db: Db;
  serviceOptions: DecisionServiceOptions;
  companyId: string;
  actor: AuthorizationActor;
  agentId: string;
  runId: string;
  body: BostanRecommendationInput;
}) {
  const recommendation = bostanRecommendationSchema.parse(input.body);
  const references = await input.db.select({
    id: issues.id, companyId: issues.companyId, status: issues.status,
    projectId: issues.projectId, updatedAt: issues.updatedAt,
    title: issues.title, description: issues.description,
  })
    .from(issues).where(and(eq(issues.companyId, input.companyId), inArray(issues.id, recommendation.evidenceIssueIds)));
  if (references.length !== recommendation.evidenceIssueIds.length) {
    throw unprocessable("Every evidence issue must belong to this company and be accessible");
  }
  const authorization = authorizationService(input.db);
  for (const issue of references) {
    const access = await authorization.decide({
      actor: input.actor, action: "issue:read",
      resource: { type: "issue", companyId: issue.companyId, issueId: issue.id, status: issue.status, projectId: issue.projectId },
    });
    if (!access.allowed) throw unprocessable("Every evidence issue must belong to this company and be accessible");
  }
  // Evidence issue identities alone are not a provenance receipt: record an
  // opaque content-and-version fingerprint so an idempotent recommendation
  // cannot silently reuse claims after any cited issue changes. Raw issue
  // titles/descriptions must not be projected into this agent-visible row.
  // This does NOT certify that the cited data supports the recommendation.
  const evidenceSnapshotHmacSha256 = createHmac("sha256", resolveDecisionSigningSecret())
    .update("bostan-evidence-issue-snapshot-v1:")
    .update(JSON.stringify([...references]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(ref => ({
        id: ref.id, status: ref.status, projectId: ref.projectId,
        updatedAt: ref.updatedAt.toISOString(), title: ref.title,
        description: ref.description ?? null,
      }))))
    .digest("hex");
  // The estimated USD amount is not a reservation. For *advice* evaluate
  // already configured, authenticated board budget policies as an additional
  // abstention guard. The agent's own declared ceiling can NEVER raise them.
  // The actual provider gateway remains authoritative for spend admission.
  const [run] = await input.db.select({ context: heartbeatRuns.contextSnapshot })
    .from(heartbeatRuns).where(and(
      eq(heartbeatRuns.id, input.runId),
      eq(heartbeatRuns.companyId, input.companyId),
      eq(heartbeatRuns.agentId, input.agentId),
    ));
  const originIssueId = typeof run?.context?.issueId === "string" ? run.context.issueId : null;
  if (!originIssueId) throw unprocessable("Recommendation requires an active, company-scoped origin task");
  const [origin] = await input.db.select({ projectId: issues.projectId }).from(issues)
    .where(and(eq(issues.id, originIssueId), eq(issues.companyId, input.companyId)));
  if (!origin) throw unprocessable("Recommendation origin task does not belong to this company");
  const policies = await input.db.select().from(budgetPolicies).where(and(
    eq(budgetPolicies.companyId, input.companyId),
    eq(budgetPolicies.isActive, true),
    eq(budgetPolicies.hardStopEnabled, true),
    eq(budgetPolicies.metric, "billed_cents"),
    budgetPoliciesForRun(input.companyId, input.agentId, origin.projectId),
  ));
  const enforceablePolicies = policies.filter(policy => policy.amount > 0);
  const observations = await computeObservedSpends(input.db, enforceablePolicies);
  const estimatedCents = unitsToCents(usdToUnits(recommendation.estimatedCostUsd));
  const reasons: string[] = [];
  if (recommendation.confidence < REPORTED_CONFIDENCE_FLOOR) reasons.push("low_self_reported_confidence");
  if (recommendation.estimatedCostUsd > recommendation.costCeilingUsd) reasons.push("cost_ceiling_exceeded");
  const policySnapshots = enforceablePolicies.map((policy, index) => {
    const observed = observations[index];
    const usedWithHolds = addCents(observed.totalExact, observed.effectiveHeldCents);
    const projected = addCents(usedWithHolds, estimatedCents);
    const unpriced = observed.unpricedEventCount > 0 || observed.unknownBrowserRunCount > 0 ||
      (observed.pendingRunCount - observed.recoveringRunCount) > 0;
    const ceilingExceeded = compareCents(projected, policy.amount) > 0 ||
      compareCents(usedWithHolds, policy.amount) >= 0;
    if (ceilingExceeded && !reasons.includes("board_budget_capacity_exceeded")) reasons.push("board_budget_capacity_exceeded");
    if (unpriced && policy.unpricedUsagePolicy !== "allow" && !reasons.includes("board_budget_accounting_unknown")) reasons.push("board_budget_accounting_unknown");
    return {
      policyId: policy.id, scopeType: policy.scopeType, scopeId: policy.scopeId,
      windowKind: policy.windowKind, limitCents: policy.amount,
      observedCents: usedWithHolds, estimatedCents, projectedCents: projected,
      enforcementVersion: policy.enforcementVersion,
    };
  });
  // A recommendation API response is also visible to its origin agent.
  // Never return the board's private policy amounts or observed spend in
  // decisions metadata. Bind idempotency to an opaque, sorted snapshot hash.
  // A changed board budget cannot reuse the stale recommendation under the
  // same idempotency key, even when the decision category is unchanged.
  const policySnapshotHmacSha256 = createHmac("sha256", resolveDecisionSigningSecret())
    .update("bostan-board-budget-snapshot-v1:")
    .update(JSON.stringify([...policySnapshots].sort((left, right) => left.policyId.localeCompare(right.policyId))))
    .digest("hex");
  const abstained = reasons.length > 0;
  const options = abstained
    ? [{ id: "request_evidence", label: "Request more evidence", effects: [] }, { id: "defer", label: "Defer decision", effects: [] }]
    : recommendation.alternatives.map(option => ({ id: option.id, label: option.label, description: option.rationale, effects: [] }));
  const body = [
    recommendation.rationale,
    "",
    `Self-reported confidence (not calibrated): ${recommendation.confidence.toFixed(3)}`,
    `Estimated cost: USD ${recommendation.estimatedCostUsd.toFixed(2)}; agent-declared ceiling: USD ${recommendation.costCeilingUsd.toFixed(2)}`,
    `Applicable active board hard-stop budget policies: ${policySnapshots.length}. Actual provider admission is always separate.`,
    `Opaque board-budget snapshot: ${policySnapshotHmacSha256}`,
    `Recommendation: ${abstained ? "ABSTAIN / HUMAN REVIEW" : recommendation.recommendedOptionId}`,
    ...reasons.map(reason => `Abstention: ${reason}`),
    "",
    "Evidence issue references (existence/access verified, relevance NOT independently verified):",
    ...recommendation.evidenceIssueIds.map(id => `- ${id}`),
    `Opaque evidence content snapshot: ${evidenceSnapshotHmacSha256}`,
    "",
    "This is advice, not approval for tool execution, spending, account access or task completion.",
  ].join("\n");
  return decisionService(input.db, input.serviceOptions).create({
    companyId: input.companyId,
    actor: input.actor,
    agentId: input.agentId,
    runId: input.runId,
    title: recommendation.title,
    body,
    ruleKey: "bostan.decision_recommendation.v1",
    idempotencyKey: recommendation.idempotencyKey,
    continuationPolicy: "wake_origin_agent",
    options,
    metadata: {
      kind: "bostan_evidence_recommendation_v1",
      evidenceIssueIds: recommendation.evidenceIssueIds,
      evidenceSnapshotHmacSha256,
      evidenceIssueCount: references.length,
      evidenceRelevanceVerified: false,
      recommendedOptionId: abstained ? null : recommendation.recommendedOptionId,
      selfReportedConfidence: recommendation.confidence,
      calibrated: false,
      estimatedCostUsd: recommendation.estimatedCostUsd,
      costCeilingUsd: recommendation.costCeilingUsd,
      abstained,
      abstentionReasons: reasons,
      checkedBoardBudgetPolicyCount: policySnapshots.length,
      boardBudgetPolicySnapshotHmacSha256: policySnapshotHmacSha256,
      boardBudgetPolicySnapshotOnly: true,
      permitsEffects: false,
    },
  });
}
