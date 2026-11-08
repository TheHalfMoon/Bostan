import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card } from "./ui/card";

export type TaskInsights = {
  schema: "bostan.task-insights.v1";
  days: 7 | 30 | 90;
  windowStart: string;
  asOf: string;
  grain: "visible_operational_tasks";
  current: { visible: number; open: number; blocked: number };
  flow: {
    created: number; completed: number;
    measuredCycles: number; medianCycleHours: number | null;
  };
};

export function describeTaskCycle(value: number | null, sample: number): string {
  if (value == null || sample === 0) return "Not enough completed tasks";
  if (!Number.isFinite(value) || value < 0) return "Unavailable";
  return Math.round(value * 10) / 10 + " hours";
}

export function BostanTaskInsights({ companyId }: { companyId: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["bostan-task-insights", companyId, days],
    queryFn: () => api.get<TaskInsights>(
      "/companies/" + companyId + "/bostan-analytics/task-insights?days=" + days,
    ),
    enabled: Boolean(companyId),
    staleTime: 30_000,
    retry: false,
  });
  const valid = data?.schema === "bostan.task-insights.v1" &&
    data.days === days && data.grain === "visible_operational_tasks";

  return (
    <Card elevation="low" className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Task insights</h2>
          <p className="text-xs text-muted-foreground">
            Authorized operational tasks only. Created and completed are separate counts, not a completion rate.
          </p>
        </div>
        <div role="group" aria-label="Task insights time window" className="flex gap-1">
          {([7, 30, 90] as const).map(value => (
            <button key={value} type="button"
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={"rounded-md border px-3 py-1 text-xs " +
                (days === value ? "bg-accent text-foreground" : "text-muted-foreground")}>
              {value} days
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-muted-foreground">
        Task insights are unavailable for this account.
      </p>}
      {isLoading && <p role="status" className="text-sm text-muted-foreground">
        Calculating authorized task metrics…
      </p>}
      {data && !valid && <p role="alert" className="text-sm text-destructive">
        Task insight response did not match the requested period.
      </p>}
      {valid && data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">{data.flow.created}</p>
            <p className="text-xs text-muted-foreground">Tasks created in period</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">{data.flow.completed}</p>
            <p className="text-xs text-muted-foreground">Tasks completed in period</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">
              {describeTaskCycle(data.flow.medianCycleHours, data.flow.measuredCycles)}
            </p>
            <p className="text-xs text-muted-foreground">
              Median start-to-completion ({data.flow.measuredCycles} measured tasks)
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
