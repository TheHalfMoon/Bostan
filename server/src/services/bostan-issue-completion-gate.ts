import { and, eq, sql } from "drizzle-orm";
import { caseHandoffs, cases, type issues, type Db } from "@paperclipai/db";
import { conflict } from "../errors.js";
import { assertBostanCurrentVerificationEvidence } from "./bostan-current-verification-evidence.js";

type IssueCompletionDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * An opt-in independently reviewed Case owns its terminal completion.
 * Ordinary Issue Done cannot preempt the authenticated case-handoff intent;
 * evaluate while the Issue row is already locked by the original issue
 * mutation service. No new executor, case writer, or external approval path.
 */
export async function assertBostanIssueCompletionHandoff(db: IssueCompletionDb, input: {
  issue: typeof issues.$inferSelect;
}) {
  const reviewed = await db.select()
    .from(cases).where(and(
      eq(cases.companyId, input.issue.companyId),
      eq(cases.workIssueId, input.issue.id),
      sql`${cases.fields}->>'bostanIndependentVerificationRequired' = 'true'`,
    )).for("share");
  for (const record of reviewed) {
    const [authorized] = await db.select({ id: caseHandoffs.id }).from(caseHandoffs).where(and(
      eq(caseHandoffs.companyId, input.issue.companyId),
      eq(caseHandoffs.caseId, record.id),
      eq(caseHandoffs.issueId, input.issue.id),
      eq(caseHandoffs.version, record.handoffVersion),
      eq(caseHandoffs.destinationKind, "done"),
      eq(caseHandoffs.state, "awaiting_completion"),
      input.issue.assigneeAgentId ? eq(caseHandoffs.fromAgentId, input.issue.assigneeAgentId)
        : sql`false`,
    )).limit(1).for("share");
    if (!authorized) {
      throw conflict("Independent-review task must first receive a governed case terminal handoff", {
        code: "bostan_case_terminal_handoff_required",
      });
    }

    // A previously accepted terminal intent alone is not current evidence.
    // Revalidate report provenance and EVERY B4 source commitment within
    // the original locked Issue Done transaction, before any status write.
    await assertBostanCurrentVerificationEvidence(db, record, input.issue, record.handoffVersion - 1);
  }
}
