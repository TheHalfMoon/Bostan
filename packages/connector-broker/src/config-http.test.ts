import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { BrokerConfigError, loadBrokerConfig, parsePublicOrigin } from "./config.js";
import { createBrokerHttpServer } from "./http.js";

const secrets: Record<string, string> = {
  "/k": Buffer.alloc(32, 1).toString("base64url"),
  "/t": "t".repeat(40),
  "/g": "google-secret",
};
const read = (file: string) => secrets[file] ?? "";
const base = {
  BOSTAN_BROKER_PUBLIC_ORIGIN: "https://broker.example.test",
  BOSTAN_BROKER_ENVIRONMENT: "production",
  BOSTAN_BROKER_DATA_DIR: "/var/lib/bostan-broker",
  BOSTAN_BROKER_MASTER_KEY_FILE: "/k",
  BOSTAN_BROKER_OPERATOR_TOKEN_FILE: "/t",
};

describe("broker configuration", () => {
  it("loads a minimal configuration with Google disabled and loopback listening", () => {
    const config = loadBrokerConfig(base, read);
    expect(config).toMatchObject({ publicOrigin: "https://broker.example.test", listenHost: "127.0.0.1", listenPort: 8787, google: null, allowedInstanceOrigins: null });
  });

  it("enables only the Google profiles the operator lists", () => {
    const config = loadBrokerConfig({ ...base, BOSTAN_BROKER_GOOGLE_CLIENT_ID: "id", BOSTAN_BROKER_GOOGLE_CLIENT_SECRET_FILE: "/g", BOSTAN_BROKER_GOOGLE_PROFILES: "gmail.read,drive.read" }, read);
    expect(config.google).toEqual({ clientId: "id", clientSecret: "google-secret", profiles: ["gmail.read", "drive.read"] });
    expect(() => loadBrokerConfig({ ...base, BOSTAN_BROKER_GOOGLE_CLIENT_ID: "id", BOSTAN_BROKER_GOOGLE_CLIENT_SECRET_FILE: "/g", BOSTAN_BROKER_GOOGLE_PROFILES: "gmail.everything" }, read)).toThrow(BrokerConfigError);
    expect(() => loadBrokerConfig({ ...base, BOSTAN_BROKER_GOOGLE_CLIENT_ID: "id" }, read)).toThrow(BrokerConfigError);
  });

  it.each([
    "http://broker.example.test",
    "https://broker.example.test:8443",
    "https://broker.example.test/path",
    "https://user:pass@broker.example.test",
    "https://my.paperclip.app",
    "https://paperclip.ing",
  ])("refuses public origin %s", (origin) => {
    expect(() => parsePublicOrigin(origin)).toThrow(BrokerConfigError);
  });

  it("refuses weak keys and tokens", () => {
    expect(() => loadBrokerConfig({ ...base, BOSTAN_BROKER_MASTER_KEY_FILE: "/t" }, read)).toThrow(/32 random bytes/);
    expect(() => loadBrokerConfig({ ...base, BOSTAN_BROKER_OPERATOR_TOKEN_FILE: "/g" }, read)).toThrow(/at least 32/);
    expect(() => loadBrokerConfig({ ...base, BOSTAN_BROKER_ENVIRONMENT: "prod" }, read)).toThrow(BrokerConfigError);
  });
});

describe("HTTP adapter", () => {
  let close: (() => Promise<void>) | null = null;
  afterEach(async () => { await close?.(); close = null; });

  async function listen(handle: (request: Request) => Promise<Response>) {
    const server = createBrokerHttpServer({ publicOrigin: "https://broker.example.test", trustProxy: false, handle });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    close = () => new Promise<void>((resolve) => server.close(() => resolve()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("builds request URLs from the public origin, not the Host header", async () => {
    let seen = "";
    const url = await listen(async (request) => { seen = request.url; return new Response("ok"); });
    await fetch(`${url}/healthz?x=1`, { headers: { host: "attacker.test" } });
    expect(seen).toBe("https://broker.example.test/healthz?x=1");
  });

  it("refuses oversized bodies", async () => {
    const url = await listen(async () => new Response("ok"));
    const response = await fetch(`${url}/v1/connector/sessions`, { method: "POST", body: "x".repeat(70 * 1024) }).catch(() => null);
    expect(response === null || response.status === 413).toBe(true);
  });
});
