import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, issues } from "@paperclipai/db";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/error-handler.js";
import { parseTaskInsightWindow, readBostanTaskInsights
} from "../services/bostan-task-insights.js";
import { getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase } from "./helpers/bostan-postgres-test-backend.js";

describe("B4-10 analytics window admission", () => {
  it("admits only exact 7, 30, 90-day windows", () => {
    expect(parseTaskInsightWindow(undefined)).toBe(30);
    expect(parseTaskInsightWindow("7")).toBe(7);
    expect(parseTaskInsightWindow("90")).toBe(90);
    for (const v of ["", "0", "365", "7.0", 7, null, [], {}]) {
      expect(() => parseTaskInsightWindow(v)).toThrow();
    }
  });
});

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
suite("B4-10 private analytics with real PostgreSQL and HTTP actor guards", () => {
  let harness: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let companyId: string, foreignId: string;
  const now = new Date("2026-10-25T12:00:00Z");
  const age = (hours: number) => new Date(now.getTime() - hours * 3600_000);
  beforeAll(async () => {
    harness = await startBostanFeedbackPostgresTestDatabase("bostan-task-insights-");
    db = createDb(harness.connectionString);
  }, 120_000);
  afterEach(async () => {
    await db.execute(sql.raw("TRUNCATE TABLE companies CASCADE"));
  });
  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await harness?.cleanup();
  });

  async function seed() {
    companyId = randomUUID();
    foreignId = randomUUID();
    await db.insert(companies).values([
      { id: companyId, name: "Bostan Task Insights QA", issuePrefix: "TIS" },
      { id: foreignId, name: "Foreign Task Insights QA", issuePrefix: "FIS" },
    ]);
    const task = (updates: Record<string, unknown>) => ({
      id: randomUUID(), companyId,
      title: "Synthetic task visible only to test",
      status: "todo", visibility: "open", createdAt: age(12), ...updates,
    });
    await db.insert(issues).values([
      task({ status: "done", startedAt: age(6), completedAt: age(4) }),
      task({ status: "done", startedAt: age(8), completedAt: age(4) }),
      task({ status: "blocked" }),
      task({ status: "todo" }),
      task({ status: "done", createdAt: age(480),
        startedAt: age(479), completedAt: age(475) }),
      task({ status: "done", createdAt: age(12),
        startedAt: null, completedAt: age(2) }),
      task({ status: "done", visibility: "private",
        startedAt: age(2), completedAt: age(1) }),
      task({ status: "done", hiddenAt: age(1),
        startedAt: age(2), completedAt: age(1) }),
      task({ status: "done", harnessKind: "qa",
        startedAt: age(2), completedAt: age(1) }),
      task({ companyId: foreignId, status: "done",
        startedAt: age(2), completedAt: age(1) }),
    ]);
  }

  it("never aggregates hidden/internal/foreign/private rows under a restricted read scope", async () => {
    await seed();
    const visible = sql<boolean>`${issues.visibility} = 'open'`;
    const report = await readBostanTaskInsights(db, {
      companyId, days: 30, now, visible,
    });
    expect(report.current).toEqual({ visible: 6, open: 2, blocked: 1 });
    expect(report.flow).toEqual({
      created: 6, completed: 4, measuredCycles: 3, medianCycleHours: 4,
    });
    expect(report.grain).toBe("visible_operational_tasks");
    expect(report).not.toHaveProperty("completionRate");
    const all = await readBostanTaskInsights(db, {
      companyId, days: 30, now, visible: sql<boolean>`true`,
    });
    expect(all.current.visible).toBe(report.current.visible + 1);
    expect(all.flow.completed).toBe(report.flow.completed + 1);
  });

  it("accurately separates recent created and completed from current status", async () => {
    await seed();
    const report = await readBostanTaskInsights(db, {
      companyId, days: 7, now,
      visible: sql<boolean>`${issues.visibility} = 'open'`,
    });
    expect(report.current).toEqual({ visible: 6, open: 2, blocked: 1 });
    expect(report.flow).toEqual({
      created: 5, completed: 3, measuredCycles: 2, medianCycleHours: 3,
    });
  });

  it("exposes board-only company-scoped API with no-cache privacy", async () => {
    await seed();
    const board = { type: "board", source: "local_implicit",
      userId: "local", companyIds: [companyId] };
    const appFor = (actor: unknown) => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.actor = actor as typeof req.actor; next();
      });
      app.use("/api", issueRoutes(db, {} as never));
      app.use(errorHandler);
      return app;
    };
    const uri = (id: string) =>
      "/api/companies/" + id + "/bostan-analytics/task-insights";
    const allowed = await request(appFor(board)).get(uri(companyId) + "?days=7");
    expect(allowed.status).toBe(200);
    expect(allowed.body.schema).toBe("bostan.task-insights.v1");
    expect(allowed.headers["cache-control"]).toContain("no-store");
    expect((await request(appFor(board)).get(uri(companyId) + "?days=365")).status).toBe(400);
    expect((await request(appFor(board)).get(uri(companyId) + "?days=30&extra=1")).status).toBe(400);
    const agent = { type: "agent", source: "agent_jwt",
      companyId, agentId: randomUUID(), runId: randomUUID() };
    expect((await request(appFor(agent)).get(uri(companyId))).status).toBe(403);
    const tenantBoard = { type: "board", source: "session",
      userId: "member-local", companyIds: [companyId],
      memberships: [{ companyId, membershipRole: "member", status: "active" }] };
    expect((await request(appFor(tenantBoard)).get(uri(foreignId))).status).toBe(403);
  });
});
