import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, issues } from "@bostan/db";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/error-handler.js";
import { getBostanFeedbackPostgresTestSupport,
  startBostanFeedbackPostgresTestDatabase } from "./helpers/bostan-postgres-test-backend.js";

const support = await getBostanFeedbackPostgresTestSupport();
const suite = support.supported ? describe : describe.skip;
const png = readFileSync(new URL("./fixtures/bostan-ocr-synthetic.png", import.meta.url));
const image = { mimeType: "image/png", language: "eng", base64: png.toString("base64") };
const jpeg = readFileSync(new URL("./fixtures/bostan-ocr-synthetic.jpg", import.meta.url));
const arabicImage = { ...image, language: "ara",
  base64: readFileSync(new URL("./fixtures/bostan-ocr-synthetic-arabic.png", import.meta.url))
    .toString("base64") };

suite("B4-06 opt-in offline OCR preview route, native Postgres and tenant ACLs", () => {
  let database: Awaited<ReturnType<typeof startBostanFeedbackPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  let previous: string | undefined;
  beforeAll(async () => {
    database = await startBostanFeedbackPostgresTestDatabase("bostan-ocr-auth-");
    db = createDb(database.connectionString);
    previous = process.env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE;
    process.env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE = "1";
  }, 120_000);
  afterEach(async () => { await db.execute(sql.raw("TRUNCATE TABLE companies CASCADE")); });
  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await database?.cleanup();
    if (previous === undefined) delete process.env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE;
    else process.env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE = previous;
  });
  async function seed() {
    const companyId = randomUUID(), otherCompany = randomUUID(), issueId = randomUUID();
    await db.insert(companies).values([
      { id: companyId, name: "Bostan synthetic OCR company", issuePrefix: "OCR" },
      { id: otherCompany, name: "Bostan synthetic OCR outsider", issuePrefix: "OTR" },
    ]);
    await db.insert(issues).values({ id: issueId, companyId, title: "Synthetic OCR source task", status: "in_progress" });
    return { companyId, otherCompany, issueId };
  }
  const board = (companyId: string) => ({ type: "board", source: "local_implicit",
    userId: "local", companyIds: [companyId] });
  function appFor(actor: unknown) {
    const app = express();
    app.use(express.json({ limit: "400kb" }));
    app.use((req, _res, next) => { req.actor = actor as typeof req.actor; next(); });
    app.use("/api", issueRoutes(db, {} as never)); app.use(errorHandler);
    return app;
  }
  const uri = (companyId: string, issueId: string) =>
    "/api/companies/" + companyId + "/issues/" + issueId + "/bostan-evidence/ocr-preview";

  it("extracts synthetic OCR text only for an authorized board and never signs a citation", async () => {
    if (process.platform !== "darwin") return;
    const s = await seed();
    const resp = await request(appFor(board(s.companyId))).post(uri(s.companyId, s.issueId)).send(image);
    expect(resp.status).toBe(200);
    expect(resp.headers["cache-control"]).toContain("no-store");
    expect(resp.body.text).toContain("BOSTAN");
    expect(resp.body).toMatchObject({
      sourceContentIsUntrusted: true, provenanceVerified: false,
      factualRelevanceVerified: false, decisionCommitAuthorized: false,
      executionAuthorized: false, persistedAsDocument: false,
    });
    expect(resp.body).not.toHaveProperty("sourceSnapshotHmacSha256");
  });
  it("admits a real JPEG through the authenticated task OCR API", async () => {
    if (process.platform !== "darwin") return;
    const s = await seed();
    const result = await request(appFor(board(s.companyId)))
      .post(uri(s.companyId, s.issueId))
      .send({ ...image, mimeType: "image/jpeg", base64: jpeg.toString("base64") });
    expect(result.status).toBe(200);
    expect(result.body.text).toContain("BOSTAN");
    expect(result.body.persistedAsDocument).toBe(false);
  });
  it("refuses compressed image headers with hazardous pixel dimensions via actual HTTP before Tesseract", async () => {
    const s = await seed();
    const target = uri(s.companyId, s.issueId);
    const app = appFor(board(s.companyId));
    const bombPng = Buffer.from(png);
    bombPng.writeUInt32BE(12_000, 16);
    bombPng.writeUInt32BE(12_000, 20);
    const bombJpeg = Buffer.from(jpeg);
    let sof = -1;
    for (let i = 0; i < bombJpeg.length - 9; i++) {
      if (bombJpeg[i] === 0xff && [0xc0, 0xc1, 0xc2, 0xc3].includes(bombJpeg[i + 1])) {
        sof = i; break;
      }
    }
    expect(sof).toBeGreaterThan(0);
    bombJpeg.writeUInt16BE(6000, sof + 5);
    bombJpeg.writeUInt16BE(6000, sof + 7);
    for (const bad of [
      { ...image, base64: bombPng.toString("base64") },
      { ...image, mimeType: "image/jpeg", base64: bombJpeg.toString("base64") },
    ]) {
      const reply = await request(app).post(target).send(bad);
      expect(reply.status).toBe(400);
      expect(reply.headers["cache-control"]).toContain("no-store");
      expect(JSON.stringify(reply.body)).not.toContain("12000");
      expect(JSON.stringify(reply.body)).not.toContain("6000");
    }
  });
  it("returns Arabic OCR only to an authorized viewer, without treating it as a signed source", async () => {
    if (process.platform !== "darwin") return;
    const s = await seed();
    const res = await request(appFor(board(s.companyId)))
      .post(uri(s.companyId, s.issueId)).send(arabicImage);
    expect(res.status).toBe(200);
    expect(res.body.text).toContain("بستان");
    expect(res.body.persistedAsDocument).toBe(false);
    expect(res.body.provenanceVerified).toBe(false);
    expect(res.body.executionAuthorized).toBe(false);
  });
  it("refuses agents, cross-company boards and invisible tasks", async () => {
    const s = await seed();
    const route = uri(s.companyId, s.issueId);
    const outsider = { type: "board", source: "session", userId: "outside",
      companyIds: [s.otherCompany], memberships: [{
        companyId: s.otherCompany, membershipRole: "member", status: "active",
      }] };
    expect((await request(appFor(outsider)).post(route).send(image)).status).toBe(403);
    const agent = { type: "agent", source: "agent_jwt", companyId: s.companyId,
      agentId: randomUUID(), runId: randomUUID() };
    expect((await request(appFor(agent)).post(route).send(image)).status).toBe(403);
    expect((await request(appFor(board(s.companyId))).post(uri(s.companyId, randomUUID())).send(image)).status).toBe(404);
    await db.update(issues).set({ hiddenAt: new Date() }).where(eq(issues.id, s.issueId));
    expect((await request(appFor(board(s.companyId))).post(route).send(image)).status).toBe(404);
  });
  it("refuses unverified image input and fails closed when disabled", async () => {
    const s = await seed();
    const target = uri(s.companyId, s.issueId);
    const app = appFor(board(s.companyId));
    expect((await request(app).post(target).send({ ...image, mimeType: "application/pdf" })).status).toBe(400);
    expect((await request(app).post(target).send({ ...image, language: "ara;echo" })).status).toBe(400);
    expect((await request(app).post(target).send({ ...image, base64: "bad" })).status).toBe(400);
    expect((await request(app).post(target).send({ ...image, base64: "%%%notbase64" })).status).toBe(400);
    expect((await request(app).post(target).send({ ...image, extra: true })).status).toBe(400);
    process.env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE = "0";
    try {
      const denied = await request(app).post(target).send(image);
      expect(denied.status).toBe(404);
      expect(denied.headers["cache-control"]).toContain("no-store");
    } finally { process.env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE = "1"; }
  });
});
