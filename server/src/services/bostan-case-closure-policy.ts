import { conflict } from "../errors.js";

/**
 * Cases opt in to a governed independent review. Once opted in, the review
 * obligation cannot be dropped through a generic case PATCH/upsert, nor can
 * those generic routes claim a completed/approved case. Only the source task
 * completion + canonical case handoff lifecycle may finalize it.
 *
 * Intentionally called *inside* the original Cases mutation transaction.
 * This does not rewrite Cases, create a competing owner or approve effects.
 */
export function assertBostanCaseClosurePolicy(input: {
  currentFields?: Record<string, unknown> | null;
  nextFields?: Record<string, unknown> | null;
  currentStatus?: string | null;
  nextStatus?: string | null;
}) {
  const wasRequired = input.currentFields?.bostanIndependentVerificationRequired === true;
  const willBeRequired = input.nextFields?.bostanIndependentVerificationRequired === true;
  if (wasRequired && input.nextFields !== undefined && !willBeRequired) {
    throw conflict("Independent verification policy cannot be removed from an existing case", {
      code: "bostan_independent_review_policy_immutable",
    });
  }
  const requirement = wasRequired || willBeRequired;
  if (!requirement) return;
  const current = input.currentStatus ?? "draft";
  const next = input.nextStatus ?? current;
  if (["approved", "done"].includes(next) && next !== current) {
    throw conflict("Governed case approval and completion require the canonical independent-review handoff", {
      code: "bostan_canonical_case_completion_required",
    });
  }
  // A new opt-in policy cannot be attached retroactively to a case that
  // already claims approval or completion: that would imply nonexistent
  // provenance, even with no explicit status change in this mutation.
  if (!wasRequired && willBeRequired && ["approved", "done"].includes(current)) {
    throw conflict("A completed case cannot retroactively assert independent verification", {
      code: "bostan_canonical_case_completion_required",
    });
  }
}
