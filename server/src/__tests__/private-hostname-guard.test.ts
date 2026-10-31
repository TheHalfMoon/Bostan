import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { connect } from "node:net";
import { parsePrivateHostHeader, privateHostnameGuard } from "../middleware/private-hostname-guard.js";

const unknownHostname = "blocked-host.invalid";

function createApp(opts: { enabled: boolean; allowedHostnames?: string[]; bindHost?: string }) {
  const app = express();
  app.use(
    privateHostnameGuard({
      enabled: opts.enabled,
      allowedHostnames: opts.allowedHostnames ?? [],
      bindHost: opts.bindHost ?? "0.0.0.0",
    }),
  );
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.get("/dashboard", (_req, res) => {
    res.status(200).send("ok");
  });
  return app;
}

describe("privateHostnameGuard", () => {

  // Raw HTTP is required here: Supertest/Node's client normally canonicalizes
  // Host, while Node's server keeps the first Host in req.headers and exposes
  // every duplicate in req.rawHeaders. Both must be treated as ambiguous.
  async function rawHttpStatus(hostLines: string[]): Promise<number> {
    const app = createApp({ enabled: true });
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing test listener");
      return await new Promise<number>((resolve, reject) => {
        const client = connect(address.port, "127.0.0.1");
        let response = "";
        client.setTimeout(3_000, () => client.destroy(new Error("raw HTTP test timeout")));
        client.once("connect", () => {
          client.write(
            "GET /api/health HTTP/1.1\r\n" +
            hostLines.join("\r\n") +
            "\r\nConnection: close\r\n\r\n",
          );
        });
        client.on("data", (chunk) => { response += chunk.toString(); });
        client.once("error", reject);
        client.once("end", () => {
          const status = /^HTTP\/1\.1 (\d{3})/.exec(response);
          if (!status) reject(new Error("missing HTTP status"));
          else resolve(Number(status[1]));
        });
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  it.each([
    ["allowed Host first", ["Host: localhost:3100", "Host: blocked-host.invalid:3100"]],
    ["allowed Host second", ["Host: blocked-host.invalid:3100", "hOSt: localhost:3100"]],
    ["identical repeated Host", ["Host: localhost:3100", "HOST: localhost:3100"]],
  ])("rejects duplicate raw HTTP Host fields (%s)", async (_label, lines) => {
    expect(await rawHttpStatus(lines)).toBe(403);
  });

  it("admits one raw HTTP Host field", async () => {
    expect(await rawHttpStatus(["Host: localhost:3100"])).toBe(200);
  });


  it("rejects spoofed X-Forwarded-Host when the actual Host is forbidden", async () => {
    const app = createApp({ enabled: true });
    const res = await request(app)
      .get("/api/health")
      .set("Host", "blocked-host.invalid:3100")
      .set("X-Forwarded-Host", "localhost:3100");
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("BOSTAN_ALLOWED_HOSTNAMES=<host>");
  });

  it("does not use an allowed X-Forwarded-Host to override a denied Host", async () => {
    const app = createApp({ enabled: true, allowedHostnames: ["approved.internal"] });
    const res = await request(app)
      .get("/api/health")
      .set("Host", "blocked-host.invalid:3100")
      .set("X-Forwarded-Host", "approved.internal:3100");
    expect(res.status).toBe(403);
  });

  it.each([
    "malicious@localhost:3100",
    "localhost:3100/private",
    "local%68ost:3100",
    "localhost:00080",
    "localhost:0",
    "localhost:65536",
    "[::1]x:3100",
  ])("refuses an ambiguous or malformed Host authority (%s)", async (authority) => {
    expect(parsePrivateHostHeader(authority)).toBeNull();
    const app = createApp({ enabled: true });
    const res = await request(app).get("/api/health").set("Host", authority);
    expect(res.status).toBe(403);
  });

  it.each([
    "127.1:3100",
    "0177.0.0.1:3100",
    "0x7f000001:3100",
    "2130706433:3100",
    "127.000.000.001:3100",
    "127.0.0.1.:3100",
  ])("rejects URL-normalized noncanonical IPv4 Host (%s)", async (authority) => {
    // WHATWG URL turns these spellings into 127.0.0.1; a private Host
    // authority must not gain loopback admission through that normalization.
    expect(parsePrivateHostHeader(authority)).toBeNull();
    const app = createApp({ enabled: true });
    const res = await request(app).get("/api/health").set("Host", authority);
    expect(res.status).toBe(403);
  });

  it("admits canonical dotted-decimal IPv4 loopback Host", async () => {
    const app = createApp({ enabled: true });
    const res = await request(app).get("/api/health").set("Host", "127.0.0.1:3100");
    expect(res.status).toBe(200);
    expect(parsePrivateHostHeader("127.0.0.1:3100")).toBe("127.0.0.1");
  });

  it("admits canonical bracketed IPv6 loopback Host", async () => {
    const app = createApp({ enabled: true });
    const res = await request(app).get("/api/health").set("Host", "[::1]:3100");
    expect(res.status).toBe(200);
    expect(parsePrivateHostHeader("[::1]:3100")).toBe("::1");
  });

  it("admits configured ordinary Host while disregarding forged forwarded values", async () => {
    const app = createApp({ enabled: true, allowedHostnames: ["approved.internal"] });
    const res = await request(app)
      .get("/api/health")
      .set("Host", "approved.internal:3100")
      .set("X-Forwarded-Host", "blocked-host.invalid:3100");
    expect(res.status).toBe(200);
  });

  it("rejects a missing Host even when forwarded host claims localhost", () => {
    const middleware = privateHostnameGuard({ enabled: true, allowedHostnames: [], bindHost: "0.0.0.0" });
    const req = {
      path: "/api/health",
      header: (name: string) => name.toLowerCase() === "x-forwarded-host" ? "localhost" : undefined,
      accepts: () => "json",
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), type: vi.fn(), send: vi.fn() } as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows requests when disabled", async () => {
    const app = createApp({ enabled: false });
    const res = await request(app).get("/api/health").set("Host", "dotta-macbook-pro:3100");
    expect(res.status).toBe(200);
  });

  it("allows loopback hostnames", async () => {
    const app = createApp({ enabled: true });
    const res = await request(app).get("/api/health").set("Host", "localhost:3100");
    expect(res.status).toBe(200);
  });

  it("allows explicitly configured hostnames", async () => {
    const app = createApp({ enabled: true, allowedHostnames: ["dotta-macbook-pro"] });
    const res = await request(app).get("/api/health").set("Host", "dotta-macbook-pro:3100");
    expect(res.status).toBe(200);
  });

  it("blocks unknown hostnames with a static remediation command", async () => {
    const app = createApp({ enabled: true, allowedHostnames: ["some-other-host"] });
    const res = await request(app).get("/api/health").set("Host", `${unknownHostname}:3100`);
    expect(res.status).toBe(403);
    // The remediation command carries a static `<host>` placeholder. It never
    // interpolates the request Host header into the command.
    expect(res.body?.error).toContain("configure BOSTAN_ALLOWED_HOSTNAMES=<host>");
    expect(res.body?.error).not.toContain(unknownHostname);
  });

  it("blocks unknown hostnames on page routes with a static plain-text remediation command", async () => {
    const middleware = privateHostnameGuard({
      enabled: true,
      allowedHostnames: ["some-other-host"],
      bindHost: "0.0.0.0",
    });
    const req = {
      path: "/dashboard",
      header: (name: string) => (name.toLowerCase() === "host" ? `${unknownHostname}:3100` : undefined),
      accepts: () => "html",
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("configure BOSTAN_ALLOWED_HOSTNAMES=<host>"),
    );
    expect(res.send).not.toHaveBeenCalledWith(expect.stringContaining(unknownHostname));
  }, 20_000);

  it("does not reflect a hostile Host header into the remediation command", async () => {
    // An unauthenticated requester can send an invalid Host header that holds
    // shell metacharacters. `extractHostname` falls back to the raw header when
    // URL parsing fails. The 403 guidance must not echo that value, so an
    // operator or an agent cannot paste an attacker-controlled span into a
    // shell. Use a harmless, nonexistent command name inside the span.
    const hostileHost = "evil$(echo marker)host";
    const app = createApp({ enabled: true, allowedHostnames: ["some-other-host"] });
    const res = await request(app).get("/api/health").set("Host", hostileHost);
    expect(res.status).toBe(403);
    expect(res.body?.error).toContain("configure BOSTAN_ALLOWED_HOSTNAMES=<host>");
    expect(res.body?.error).not.toContain("evil");
    expect(res.body?.error).not.toContain("$(");
    expect(res.body?.error).not.toContain("marker");
  });
});
