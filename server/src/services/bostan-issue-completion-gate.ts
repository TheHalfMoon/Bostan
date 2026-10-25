import { and, eq, sql } from "drizzle-orm";
import { caseHandoffs, cases, type Db } from "@paperclipai/db";
import { conflict } from "../errors.js";

type IssueCompletionDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * An opt-in independently reviewed Case owns its terminal completion.
 * Ordinary Issue Done cannot preempt the authenticated case-handoff intent;
 * evaluate while the Issue row is already locked by the original issue
 * mutation service. No new executor, case writer, or external approval path.
 */
export async function assertBostanIssueCompletionHandoff(db: IssueCompletionDb, input: {
  companyId: string;
  issueId: string;
  assigneeAgentId: string | null;
}) {
  const reviewed = await db.select({ id: cases.id, handoffVersion: cases.handoffVersion })
    .from(cases).where(and(
      eq(cases.companyId, input.companyId),
      eq(cases.workIssueId, input.issueId),
      sql`${cases.fields}->>'bostanIndependentVerificationRequired' = 'true'`,
    )).for("share");
  for (const record of reviewed) {
    const [authorized] = await db.select({ id: caseHandoffs.id }).from(caseHandoffs).where(and(
      eq(caseHandoffs.companyId, input.companyId),
      eq(caseHandoffs.caseId, record.id),
      eq(caseHandoffs.issueId, input.issueId),
      eq(caseHandoffs.version, record.handoffVersion),
      eq(caseHandoffs.destinationKind, "done"),
      eq(caseHandoffs.state, "awaiting_completion"),
      input.assigneeAgentId ? eq(caseHandoffs.fromAgentId, input.assigneeAgentId)
        : sql`false`,
    )).limit(1).for("share");
    if (!authorized) {
      throw conflict("Independent-review task must first receive a governed case terminal handoff", {
        code: "bostan_case_terminal_handoff_required",
      });
    }
  }
}
