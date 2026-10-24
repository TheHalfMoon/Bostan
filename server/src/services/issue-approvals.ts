import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvals, issueApprovals, issues } from "@paperclipai/db";
import { conflict, notFound, unprocessable } from "../errors.js";
import { redactEventPayload } from "../redaction.js";

interface LinkActor {
  agentId?: string | null;
  userId?: string | null;
}

export function issueApprovalService(db: Db) {
  async function getIssue(issueId: string) {
    return db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
  }

  async function getApproval(approvalId: string) {
    return db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .then((rows) => rows[0] ?? null);
  }

  async function assertIssueAndApprovalSameCompany(issueId: string, approvalId: string) {
    const issue = await getIssue(issueId);
    if (!issue) throw notFound("Issue not found");

    const approval = await getApproval(approvalId);
    if (!approval) throw notFound("Approval not found");

    if (issue.companyId !== approval.companyId) {
      throw unprocessable("Issue and approval must belong to the same company");
    }

    return { issue, approval };
  }

  return {
    /**
     * The gateway's formal approval and task link are one unit: no orphan
     * pending approval and no link inserted after the agent commits Done.
     * Matches the issue-row lock ordering of B1-01/B1-03.
     */
    createPendingToolApproval: async (input: {
      companyId: string;
      issueId: string;
      requestedByAgentId: string | null;
      payload: typeof approvals.$inferInsert.payload;
    }): Promise<string> => {
      return db.transaction(async tx => {
        const [task] = await tx.select({
          id: issues.id, companyId: issues.companyId, status: issues.status,
        }).from(issues)
          .where(and(eq(issues.id, input.issueId), eq(issues.companyId, input.companyId)))
          .for("update");
        if (!task) throw notFound("Issue not found");
        if (task.status === "done" || task.status === "cancelled") {
          throw conflict("Cannot request approval for a completed task", {
            code: "issue_terminal_approval_link", issueId: input.issueId,
          });
        }
        const [approval] = await tx.insert(approvals).values({
          companyId: input.companyId,
          type: "request_board_approval",
          status: "pending",
          requestedByAgentId: input.requestedByAgentId,
          payload: input.payload,
        }).returning({ id: approvals.id });
        await tx.insert(issueApprovals).values({
          companyId: input.companyId,
          issueId: input.issueId,
          approvalId: approval.id,
          linkedByAgentId: input.requestedByAgentId,
        });
        return approval.id;
      });
    },
    listApprovalsForIssue: async (issueId: string) => {
      const issue = await getIssue(issueId);
      if (!issue) throw notFound("Issue not found");

      const result = await db
        .select({
          id: approvals.id,
          companyId: approvals.companyId,
          type: approvals.type,
          requestedByAgentId: approvals.requestedByAgentId,
          requestedByUserId: approvals.requestedByUserId,
          status: approvals.status,
          payload: approvals.payload,
          decisionNote: approvals.decisionNote,
          decidedByUserId: approvals.decidedByUserId,
          decidedAt: approvals.decidedAt,
          createdAt: approvals.createdAt,
          updatedAt: approvals.updatedAt,
        })
        .from(issueApprovals)
        .innerJoin(approvals, eq(issueApprovals.approvalId, approvals.id))
        .where(eq(issueApprovals.issueId, issueId))
        .orderBy(desc(issueApprovals.createdAt));
      return result.map((approval) => ({
        ...approval,
        payload: redactEventPayload(approval.payload) ?? {},
      }));
    },

    listIssuesForApproval: async (approvalId: string) => {
      const approval = await getApproval(approvalId);
      if (!approval) throw notFound("Approval not found");

      return db
        .select({
          id: issues.id,
          companyId: issues.companyId,
          projectId: issues.projectId,
          goalId: issues.goalId,
          parentId: issues.parentId,
          title: issues.title,
          description: issues.description,
          status: issues.status,
          priority: issues.priority,
          assigneeAgentId: issues.assigneeAgentId,
          createdByAgentId: issues.createdByAgentId,
          createdByUserId: issues.createdByUserId,
          issueNumber: issues.issueNumber,
          identifier: issues.identifier,
          requestDepth: issues.requestDepth,
          billingCode: issues.billingCode,
          startedAt: issues.startedAt,
          completedAt: issues.completedAt,
          cancelledAt: issues.cancelledAt,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
        })
        .from(issueApprovals)
        .innerJoin(issues, eq(issueApprovals.issueId, issues.id))
        .where(eq(issueApprovals.approvalId, approvalId))
        .orderBy(desc(issueApprovals.createdAt));
    },

    link: async (issueId: string, approvalId: string, actor?: LinkActor): Promise<typeof issueApprovals.$inferSelect | null> => {
      return db.transaction(async tx => {
        // Lock before deciding: a concurrent agent Done and link creation must
        // serialize on the same issue row. Checking outside this transaction
        // permitted a pending approval to appear after Done had committed.
        const [issue] = await tx.select({ id: issues.id, companyId: issues.companyId, status: issues.status })
          .from(issues).where(eq(issues.id, issueId)).for("update");
        if (!issue) throw notFound("Issue not found");
        const [approval] = await tx.select({ id: approvals.id, companyId: approvals.companyId, status: approvals.status })
          .from(approvals).where(eq(approvals.id, approvalId)).for("share");
        if (!approval) throw notFound("Approval not found");
        if (issue.companyId !== approval.companyId) {
          throw unprocessable("Issue and approval must belong to the same company");
        }
        if (["done", "cancelled"].includes(issue.status)
          && ["pending", "revision_requested"].includes(approval.status)) {
          throw conflict("Cannot attach unresolved approval to a completed task", {
            code: "issue_terminal_approval_link", issueId, approvalId,
          });
        }
        await tx.insert(issueApprovals).values({
          companyId: issue.companyId, issueId, approvalId,
          linkedByAgentId: actor?.agentId ?? null,
          linkedByUserId: actor?.userId ?? null,
        }).onConflictDoNothing();
        return tx.select().from(issueApprovals)
          .where(and(eq(issueApprovals.issueId, issueId), eq(issueApprovals.approvalId, approvalId)))
          .then((rows) => rows[0] ?? null);
      });
    },

    unlink: async (issueId: string, approvalId: string) => {
      await assertIssueAndApprovalSameCompany(issueId, approvalId);
      await db
        .delete(issueApprovals)
        .where(and(eq(issueApprovals.issueId, issueId), eq(issueApprovals.approvalId, approvalId)));
    },

    linkManyForApproval: async (approvalId: string, issueIds: string[], actor?: LinkActor): Promise<void> => {
      if (issueIds.length === 0) return;
      return db.transaction(async tx => {
        // Stable row order prevents two overlapping bulk link requests from
        // taking issue locks in opposite orders. All-or-nothing validation
        // forbids half-linked approvals when one task closes concurrently.
        const uniqueIssueIds = Array.from(new Set(issueIds)).sort();
        const rows = await tx.select({ id: issues.id, companyId: issues.companyId, status: issues.status })
          .from(issues).where(inArray(issues.id, uniqueIssueIds))
          .orderBy(issues.id).for("update");
        if (rows.length !== uniqueIssueIds.length) throw notFound("One or more issues not found");
        const [approval] = await tx.select({ id: approvals.id, companyId: approvals.companyId, status: approvals.status })
          .from(approvals).where(eq(approvals.id, approvalId)).for("share");
        if (!approval) throw notFound("Approval not found");
        for (const issue of rows) {
          if (issue.companyId !== approval.companyId) {
            throw unprocessable("Issue and approval must belong to the same company");
          }
          if (["done", "cancelled"].includes(issue.status)
            && ["pending", "revision_requested"].includes(approval.status)) {
            throw conflict("Cannot attach unresolved approval to a completed task", {
              code: "issue_terminal_approval_link", issueId: issue.id, approvalId,
            });
          }
        }
        await tx.insert(issueApprovals).values(uniqueIssueIds.map(issueId => ({
          companyId: approval.companyId, issueId, approvalId,
          linkedByAgentId: actor?.agentId ?? null,
          linkedByUserId: actor?.userId ?? null,
        }))).onConflictDoNothing();
      });
    },
  };
}
