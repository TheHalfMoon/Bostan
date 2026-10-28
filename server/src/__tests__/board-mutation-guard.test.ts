import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { boardMutationGuard } from "../middleware/board-mutation-guard.js";

function createApp(
  actorType: "board" | "agent",
  boardSource: "session" | "local_implicit" | "board_key" | "cloud_tenant" = "session",
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actorType === "board"
      ? { type: "board", userId: "board", source: boardSource }
      : { type: "agent", agentId: "agent-1" };
    next();
  });
  app.use(boardMutationGuard());
  app.post("/mutate", (_req, res) => {
    res.status(204).end();
  });
  app.get("/read", (_req, res) => {
    res.status(204).end();
  });
  return app;
}

describe("boardMutationGuard", () => {
  it("allows safe methods for board actor", async () => {
    const app = createApp("board");
    const res = await request(app).get("/read");
    expect([200, 204]).toContain(res.status);
  });

  it("blocks board mutations without trusted origin", () => {
    const middleware = boardMutationGuard();
    const req = {
      method: "POST",
      actor: { type: "board", userId: "board", source: "session" },
      header: () => undefined,
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Board mutation requires trusted browser origin",
    });
  });

  it("allows local implicit board mutations without origin", async () => {
    const app = createApp("board", "local_implicit");
    const res = await request(app).post("/mutate").send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("allows board bearer-key mutations without origin", async () => {
    const app = createApp("board", "board_key");
    const res = await request(app).post("/mutate").send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("allows trusted Cloud tenant mutations without origin", async () => {
    const app = createApp("board", "cloud_tenant");
    const res = await request(app).post("/mutate").send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("allows board mutations from trusted origin", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "http://localhost:3100")
      .send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("allows board mutations from trusted referer origin", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Referer", "http://localhost:3100/issues/abc")
      .send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("rejects an untrusted Origin even with a trusted Referer", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "https://attacker.example.invalid")
      .set("Referer", "http://localhost:3100/issues/abc")
      .send({ ok: true });
    expect(res.status).toBe(403);
  });

  it.each(["null", "not a valid origin"])(
    "rejects invalid or opaque Origin %s despite a trusted Referer",
    async (origin) => {
      const app = createApp("board");
      const res = await request(app)
        .post("/mutate")
        .set("Origin", origin)
        .set("Referer", "http://localhost:3100/issues/abc")
        .send({ ok: true });
      expect(res.status).toBe(403);
    },
  );

  it("prefers valid Origin over an unrelated Referer", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "http://localhost:3100")
      .set("Referer", "https://attacker.example.invalid/trap")
      .send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it.each([
    "http://localhost:3100/private",
    "http://localhost:3100/?next=/private",
    "http://localhost:3100#private",
    "http://user@localhost:3100",
    "http://localhost:3100/",
    "ftp://localhost:3100",
    "http://localhost:80@localhost:3100",
  ])("rejects noncanonical Origin %s even when Referer is trusted", async (badOrigin) => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Origin", badOrigin)
      .set("Referer", "http://localhost:3100/legitimate")
      .send({ ok: true });
    expect(res.status).toBe(403);
  });

  it("accepts a canonical mixed-case HTTPS Origin with a trusted Host", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Host", "private.example.invalid:42000")
      .set("Origin", "HTTPS://PRIVATE.EXAMPLE.INVALID:42000")
      .set("Referer", "https://attacker.example.invalid/bait")
      .send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("rejects HTTPS Origin on a direct HTTP request to the identical host", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Host", "private.example.invalid:42000")
      .set("Origin", "https://private.example.invalid:42000")
      .send({ ok: true });
    expect(res.status).toBe(403);
  });

  it("rejects HTTP Origin on a trusted-proxy HTTPS request to the identical host", async () => {
    const app = createApp("board");
    app.set("trust proxy", "loopback");
    const res = await request(app)
      .post("/mutate")
      .set("Host", "private.example.invalid:42000")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "http://private.example.invalid:42000")
      .send({ ok: true });
    expect(res.status).toBe(403);
  });

  it("allows HTTPS Origin on a trusted-proxy HTTPS request to the identical host", async () => {
    const app = createApp("board");
    app.set("trust proxy", "loopback");
    const res = await request(app)
      .post("/mutate")
      .set("Host", "private.example.invalid:42000")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://private.example.invalid:42000")
      .send({ ok: true });
    expect(res.status).toBe(204);
  });

  it("allows HTTPS branch-runtime mutations when forwarded MagicDNS host and non-standard port match", async () => {
    const app = createApp("board");
    app.set("trust proxy", "loopback");
    const res = await request(app)
      .post("/mutate")
      .set("Host", "127.0.0.1")
      .set("X-Forwarded-Host", "branch-runner.tail123.ts.net:42000")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://branch-runner.tail123.ts.net:42000")
      .send({ ok: true });
    expect([200, 204]).toContain(res.status);
  });

  it("ignores x-forwarded-host from an untrusted direct client", async () => {
    const app = createApp("board");
    const res = await request(app)
      .post("/mutate")
      .set("Host", "board.example.test")
      .set("X-Forwarded-Host", "attacker.example.test")
      .set("Origin", "https://attacker.example.test")
      .send({ ok: true });
    expect(res.status).toBe(403);
  });

  it("blocks board mutations when x-forwarded-host does not match origin", async () => {
    const middleware = boardMutationGuard();
    const req = {
      method: "POST",
      actor: { type: "board", userId: "board", source: "session" },
      header: (name: string) => {
        if (name === "host") return "127.0.0.1";
        if (name === "x-forwarded-host") return "10.90.10.20:3443";
        if (name === "origin") return "https://evil.example.com";
        return undefined;
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Board mutation requires trusted browser origin",
    });
  });

  it("does not block authenticated agent mutations", async () => {
    const middleware = boardMutationGuard();
    const req = {
      method: "POST",
      actor: { type: "agent", agentId: "agent-1" },
      header: () => undefined,
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
