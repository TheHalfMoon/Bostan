import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues } from "@paperclipai/db";

export type TaskInsightWindow = 7 | 30 | 90;
export function parseTaskInsightWindow(value: unknown): TaskInsightWindow {
  if (value === undefined || value === "30") return 30;
  if (value === "7") return 7;
  if (value === "90") return 90;
  throw new Error("Expected task insights window 7, 30 or 90 days");
}

/** Aggregate authorized operational tasks only; never read raw task text. */
export async function readBostanTaskInsights(db: Db, params: {
  companyId: string; days: TaskInsightWindow; visible: SQL<boolean>; now?: Date;
}) {
  const now = params.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid task insights clock");
  const from = new Date(now.getTime() - params.days * 86400000);
  // postgres.js expects bindable scalar values in raw SQL fragments. Explicit
  // ISO UTC timestamps keep the time-window boundary unambiguous.
  const fromIso = from.toISOString();
  const nowIso = now.toISOString();
  const doneWindow = sql`(${issues.status} = 'done'
    and ${issues.completedAt} >= ${fromIso}::timestamptz and ${issues.completedAt} <= ${nowIso}::timestamptz)`;
  const measured = sql`${doneWindow} and ${issues.startedAt} is not null
    and ${issues.completedAt} >= ${issues.startedAt}`;

  const [row] = await db.select({
    visibleTasks: sql<number>`count(*)::integer`,
    open: sql<number>`count(*) filter(where ${issues.status} not in ('done','cancelled'))::integer`,
    blocked: sql<number>`count(*) filter(where ${issues.status} = 'blocked')::integer`,
    created: sql<number>`count(*) filter(where ${issues.createdAt} >= ${fromIso}::timestamptz and ${issues.createdAt} <= ${nowIso}::timestamptz)::integer`,
    completed: sql<number>`count(*) filter(where ${doneWindow})::integer`,
    measuredCycles: sql<number>`count(*) filter(where ${measured})::integer`,
    medianCycleHours: sql<number | null>`percentile_cont(0.5) within group(
      order by extract(epoch from (${issues.completedAt} - ${issues.startedAt})) / 3600
    ) filter(where ${measured})`,
  }).from(issues).where(and(
    eq(issues.companyId, params.companyId),
    isNull(issues.hiddenAt), isNull(issues.harnessKind), params.visible,
  ));
  const count = (n: number | string | null | undefined) => Number(n ?? 0);
  return {
    schema: "bostan.task-insights.v1" as const,
    asOf: now.toISOString(), windowStart: from.toISOString(), days: params.days,
    grain: "visible_operational_tasks" as const,
    current: { visible: count(row?.visibleTasks), open: count(row?.open), blocked: count(row?.blocked) },
    flow: {
      created: count(row?.created), completed: count(row?.completed),
      measuredCycles: count(row?.measuredCycles),
      medianCycleHours: row?.medianCycleHours == null ? null
        : Number(Number(row.medianCycleHours).toFixed(2)),
    },
  };
}
