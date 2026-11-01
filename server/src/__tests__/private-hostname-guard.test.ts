import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { connect } from "node:net";
import { createPaperclipHttpServer } from "../http/server.js";
import { isPrivateUpgradeHostAllowed, parsePrivateHostHeader, privateHostnameGuard } from "../middleware/private-hostname-guard.js";

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
  async function rawHttpStatus(hostLines: string[], requestTarget = "/api/health"): Promise<number> {
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
            `GET ${requestTarget} HTTP/1.1\r\n` +
            hostLines.join("\r\n") +
            "\r\nConnection: close\r\n\r\n",
            "latin1",
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

  // Node accepts proxy-style absolute-form request targets. Bostan is an
  // origin server: an allowed Host must not authorize a different authority
  // in the request line, even if Express routes the parsed pathname.
  it.each([
    "http://blocked-host.invalid/api/health",
    "http://localhost:3100/api/health",
    "https://blocked-host.invalid/api/health",
  ])("rejects absolute-form HTTP request target (%s)", async (requestTarget) => {
    expect([400, 403]).toContain(await rawHttpStatus(["Host: localhost:3100"], requestTarget));
  });

  it.each(["//blocked-host.invalid/api/health", "//%"])(
    "refuses ambiguous network-path request targets (%s)", async (requestTarget) => {
      expect([400, 403]).toContain(await rawHttpStatus(["Host: localhost:3100"], requestTarget));
    },
  );

  it("keeps normal origin-form paths and query strings working", async () => {
    expect(await rawHttpStatus(["Host: localhost:3100"], "/api/health?source=qa")).toBe(200);
  });

  it.each([
    { label: "allowed Host first", lines: ["Host: localhost:3100", "Host: blocked-host.invalid:3100"] },
    { label: "allowed Host second", lines: ["Host: blocked-host.invalid:3100", "hOSt: localhost:3100"] },
    { label: "identical repeated Host", lines: ["Host: localhost:3100", "HOST: localhost:3100"] },
  ])("rejects duplicate raw HTTP Host fields ($label)", async ({ lines }) => {
    // Node versions may reject a duplicate Host in the HTTP parser (400)
    // before Express receives it; either parser refusal or guard 403 is safe.
    expect([400, 403]).toContain(await rawHttpStatus(lines));
  });

  it("admits one raw HTTP Host field", async () => {
    expect(await rawHttpStatus(["Host: localhost:3100"])).toBe(200);
  });

  it.each([
    "\u00a0localhost:3100",
    "localhost:3100\u00a0",
  ])("refuses Latin-1 obs-text whitespace in raw Host authority (%s)", async (authority) => {
    // Node preserves HTTP obs-text 0xA0 in req.rawHeaders. String.trim()
    // must not turn that attacker-controlled value into allowed localhost.
    expect(parsePrivateHostHeader(authority)).toBeNull();
    expect(await rawHttpStatus([`Host: ${authority}`])).toBe(403);
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
      url: "/api/health",
      rawHeaders: ["X-Forwarded-Host", "localhost"],
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
      url: "/dashboard",
      rawHeaders: ["Host", `${unknownHostname}:3100`],
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


describe("private WebSocket upgrade authority admission", () => {
  const privateOpts = { enabled: true, allowedHostnames: ["approved.internal"], bindHost: "0.0.0.0" };
  const target = "/api/companies/00000000-0000-4000-8000-000000000001/events/ws";

  it.each([
    { label: "unknown Host", rawHeaders: ["Host", "blocked.invalid:3100"], url: target },
    { label: "forged forwarded Host", rawHeaders: ["Host", "blocked.invalid", "X-Forwarded-Host", "localhost"], url: target },
    { label: "duplicate Host", rawHeaders: ["Host", "localhost", "Host", "blocked.invalid"], url: target },
    { label: "missing Host", rawHeaders: ["X-Forwarded-Host", "localhost"], url: target },
    { label: "absolute-form target", rawHeaders: ["Host", "localhost"], url: "http://blocked.invalid/api/companies/00000000-0000-4000-8000-000000000001/events/ws" },
    { label: "network-path target", rawHeaders: ["Host", "localhost"], url: "//%" },
  ])("refuses $label before WebSocket authentication", ({ rawHeaders, url }) => {
    expect(isPrivateUpgradeHostAllowed({ rawHeaders, url }, privateOpts)).toBe(false);
  });

  it("allows a single loopback or explicitly configured Host", () => {
    expect(isPrivateUpgradeHostAllowed({ rawHeaders: ["Host", "localhost:3100"], url: target }, privateOpts)).toBe(true);
    expect(isPrivateUpgradeHostAllowed({ rawHeaders: ["Host", "approved.internal:3100"], url: target }, privateOpts)).toBe(true);
  });

  it.each([
    { label: "foreign browser Origin", rawHeaders: ["Host", "localhost:3100", "Origin", "https://blocked.invalid"], allowed: false },
    { label: "null Origin", rawHeaders: ["Host", "localhost:3100", "Origin", "null"], allowed: false },
    { label: "userinfo-folded Origin", rawHeaders: ["Host", "localhost:3100", "Origin", "http://evil@localhost:3100"], allowed: false },
    { label: "numeric IPv4 alias Origin", rawHeaders: ["Host", "127.0.0.1:3100", "Origin", "http://0x7f000001"], allowed: false },
    { label: "duplicate Origin", rawHeaders: ["Host", "localhost:3100", "Origin", "http://localhost", "Origin", "https://blocked.invalid"], allowed: false },
    { label: "same host different dev port", rawHeaders: ["Host", "localhost:3100", "Origin", "http://localhost:5173"], allowed: true },
    { label: "equivalent loopback host", rawHeaders: ["Host", "127.0.0.1:3100", "Origin", "http://localhost:5173"], allowed: true },
    { label: "nonbrowser client without Origin", rawHeaders: ["Host", "localhost:3100"], allowed: true },
  ])("enforces browser Origin admission for $label", ({ rawHeaders, allowed }) => {
    expect(isPrivateUpgradeHostAllowed({ rawHeaders, url: target }, privateOpts)).toBe(allowed);
  });

  it("preserves public-mode WebSocket compatibility", () => {
    expect(isPrivateUpgradeHostAllowed({ rawHeaders: ["Host", "blocked.invalid"], url: target }, { ...privateOpts, enabled: false })).toBe(true);
  });
});


describe("private HTTP listener WebSocket upgrade admission", () => {
  async function probeUpgrade(host: string, enabled: boolean, requestTarget = "/api/companies/00000000-0000-4000-8000-000000000001/events/ws", origin?: string) {
    const server = createPaperclipHttpServer((_req, res) => res.end("HTTP only"), {
      apiUrl: "http://127.0.0.1:3100",
      privateHostAdmission: { enabled, allowedHostnames: [], bindHost: "0.0.0.0" },
    });
    let downstream = 0;
    server.on("upgrade", (req, socket) => {
      if ((req as typeof req & { paperclipWebSocketHandled?: boolean }).paperclipWebSocketHandled) return;
      downstream += 1;
      socket.end("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing listener");
      const response = await new Promise<string>((resolve, reject) => {
        const client = connect(address.port, "127.0.0.1");
        let data = "";
        client.setTimeout(3_000, () => client.destroy(new Error("upgrade test timeout")));
        client.once("connect", () => client.write(
          `GET ${requestTarget} HTTP/1.1\r\n` +
          `Host: ${host}\r\n` +
          (origin === undefined ? "" : `Origin: ${origin}\r\n`) +
          `Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGVzdC1rZXk=\r\nSec-WebSocket-Version: 13\r\n\r\n`,
        ));
        client.on("data", (chunk) => { data += chunk.toString(); });
        client.once("error", reject);
        client.once("close", () => resolve(data));
      });
      return { response, downstream };
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  it("refuses foreign browser Origin before any private WebSocket handler", async () => {
    const result = await probeUpgrade("localhost:3100", true, undefined, "https://blocked.invalid");
    expect(result.downstream).toBe(0);
    expect(result.response).not.toContain("101 Switching Protocols");
  });

  it("admits a same-host browser Origin on a development port", async () => {
    const result = await probeUpgrade("localhost:3100", true, undefined, "http://localhost:5173");
    expect(result.downstream).toBe(1);
    expect(result.response).toContain("101 Switching Protocols");
  });

  it("refuses a forbidden private Host before any WebSocket listener handles it", async () => {
    const result = await probeUpgrade("blocked.invalid", true);
    expect(result.downstream).toBe(0);
    expect(result.response).not.toContain("101 Switching Protocols");
  });

  it("rejects malformed absolute-form upgrades before runner URL parsing", async () => {
    const result = await probeUpgrade("blocked.invalid", true, "http://%");
    expect(result.downstream).toBe(0);
    expect(result.response).not.toContain("101 Switching Protocols");
  });

  it("refuses ambiguous network-path upgrades before URL parsing", async () => {
    const result = await probeUpgrade("localhost:3100", true, "//%");
    expect(result.downstream).toBe(0);
  });

  it("retains a valid loopback upgrade and public-mode compatibility", async () => {
    const local = await probeUpgrade("localhost:3100", true);
    expect(local.downstream).toBe(1);
    expect(local.response).toContain("101 Switching Protocols");
    const publicMode = await probeUpgrade("blocked.invalid", false);
    expect(publicMode.downstream).toBe(1);
    expect(publicMode.response).toContain("101 Switching Protocols");
  });
});
