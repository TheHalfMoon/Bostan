import { createDecipheriv, createHash, diffieHellman, generateKeyPairSync, hkdfSync, randomUUID, sign, createPublicKey, type KeyObject } from "node:crypto";
import { MemoryAuditSink } from "./audit.js";
import { createBroker } from "./broker.js";
import type { BrokerConfig } from "./config.js";
import { JWS_TYP, SEAL_ALGORITHM, type SealedEnvelope } from "./crypto.js";
import { createGoogleClient } from "./google.js";
import { MemoryStore } from "./store.js";

export const BROKER_ORIGIN = "https://broker.bostan.test";
export const INSTANCE_ORIGIN = "https://bostan.example.test";
export const OPERATOR_TOKEN = "operator-token-0123456789abcdefghijklmnop";
export const GOOGLE_CLIENT_SECRET = "fake-google-client-secret";

export function testConfig(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  return {
    publicOrigin: BROKER_ORIGIN,
    environment: "development",
    listenHost: "127.0.0.1",
    listenPort: 0,
    dataDir: "unused",
    masterKey: Buffer.alloc(32, 7),
    operatorToken: OPERATOR_TOKEN,
    trustProxy: false,
    allowedInstanceOrigins: null,
    google: { clientId: "fake-client.apps.googleusercontent.com", clientSecret: GOOGLE_CLIENT_SECRET, profiles: ["gmail.read", "gmail.draft", "drive.read", "workspace.all"] },
    ...overrides,
  };
}

/** In-memory stand-in for Google's token and revocation endpoints. */
export class FakeGoogle {
  readonly codes = new Map<string, { challenge: string; scopes: string[] }>();
  readonly refreshTokens = new Set<string>();
  readonly revoked: string[] = [];
  readonly calls: string[] = [];
  grantScopes: ((requested: string[]) => string[]) = (requested) => requested;
  omitRefreshToken = false;
  refreshFailure: null | "invalid_grant" | "server_error" = null;
  /** Runs while a refresh request is in flight at "Google". */
  onRefresh: (() => Promise<void> | void) | null = null;
  #counter = 0;

  /** Simulates the user approving consent at accounts.google.com. */
  approve(authorizationUrl: string): string {
    const url = new URL(authorizationUrl);
    const code = `fake-code-${++this.#counter}`;
    this.codes.set(code, { challenge: url.searchParams.get("code_challenge")!, scopes: url.searchParams.get("scope")!.split(" ") });
    return code;
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const form = new URLSearchParams(String(init?.body ?? ""));
    this.calls.push(`${url} ${form.get("grant_type") ?? ""}`.trim());
    if (url === "https://oauth2.googleapis.com/revoke") {
      this.revoked.push(form.get("token")!);
      this.refreshTokens.delete(form.get("token")!);
      return new Response(null, { status: 200 });
    }
    if (url !== "https://oauth2.googleapis.com/token") return new Response("not found", { status: 404 });
    if (form.get("client_secret") !== GOOGLE_CLIENT_SECRET) return Response.json({ error: "invalid_client" }, { status: 401 });
    if (form.get("grant_type") === "authorization_code") {
      const code = this.codes.get(form.get("code") ?? "");
      this.codes.delete(form.get("code") ?? "");
      const verifier = form.get("code_verifier") ?? "";
      if (!code || createHash("sha256").update(verifier).digest("base64url") !== code.challenge) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      const refresh = `google-refresh-${++this.#counter}`;
      if (!this.omitRefreshToken) this.refreshTokens.add(refresh);
      return Response.json({
        access_token: `google-access-${this.#counter}`,
        expires_in: 3599,
        token_type: "Bearer",
        scope: this.grantScopes(code.scopes).join(" "),
        ...(this.omitRefreshToken ? {} : { refresh_token: refresh }),
      });
    }
    if (form.get("grant_type") === "refresh_token") {
      await this.onRefresh?.();
      if (this.refreshFailure === "server_error") return Response.json({ error: "backend_error" }, { status: 503 });
      if (this.refreshFailure === "invalid_grant" || !this.refreshTokens.has(form.get("refresh_token") ?? "")) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      return Response.json({ access_token: `google-access-${++this.#counter}`, expires_in: 3599, token_type: "Bearer" });
    }
    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  };
}

export type TestInstance = {
  instanceId: string;
  signKey: KeyObject;
  sealKey: KeyObject;
  signPublicKey: string;
  sealPublicKey: string;
};

export function createTestInstance(): TestInstance {
  const signing = generateKeyPairSync("ed25519");
  const sealing = generateKeyPairSync("x25519");
  return {
    instanceId: `inst_${randomUUID()}`,
    signKey: signing.privateKey,
    sealKey: sealing.privateKey,
    signPublicKey: (signing.publicKey.export({ format: "jwk" }) as { x: string }).x,
    sealPublicKey: (sealing.publicKey.export({ format: "jwk" }) as { x: string }).x,
  };
}

export function signRequest(instance: TestInstance, claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "EdDSA", typ: JWS_TYP }): string {
  const input = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  return `${input}.${sign(null, Buffer.from(input), instance.signKey).toString("base64url")}`;
}

export function requestClaims(instance: TestInstance, path: string, op: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const iat = Math.floor(Date.now() / 1000);
  return { iss: instance.instanceId, aud: `${BROKER_ORIGIN}${path}`, sub: "user-1", cid: "company-1", env: "development", op, iat, exp: iat + 60, jti: randomUUID(), ...extra };
}

/** Opens a sealed envelope exactly as the instance's connector client does. */
export function openSealed(instance: TestInstance, envelope: SealedEnvelope, aadScopes: readonly string[]): Record<string, unknown> {
  const ephemeralRaw = Buffer.from(envelope.epk, "base64url");
  const recipientRaw = Buffer.from(instance.sealPublicKey, "base64url");
  const aad = Buffer.from([1, SEAL_ALGORITHM, envelope.purpose, instance.instanceId, "development", envelope.provider, envelope.profile, [...aadScopes].sort().join(" ")].join("\n"));
  const ephemeral = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b656e032100", "hex"), ephemeralRaw]), format: "der", type: "spki" });
  const info = envelope.provider === "google" && envelope.profile === "workspace.all" ? createHash("sha256").update(aad).digest() : aad;
  const key = Buffer.from(hkdfSync("sha256", diffieHellman({ privateKey: instance.sealKey, publicKey: ephemeral }), Buffer.concat([ephemeralRaw, recipientRaw]), info, 32));
  const combined = Buffer.from(envelope.ct, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"), { authTagLength: 16 });
  decipher.setAAD(aad);
  decipher.setAuthTag(combined.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(combined.subarray(0, -16)), decipher.final()]).toString("utf8")) as Record<string, unknown>;
}

export function createTestBroker(overrides: Partial<BrokerConfig> = {}) {
  const google = new FakeGoogle();
  const store = new MemoryStore();
  const audit = new MemoryAuditSink();
  const config = testConfig(overrides);
  const broker = createBroker({
    config,
    store,
    audit,
    google: config.google ? createGoogleClient({ ...config.google, fetch: google.fetch, sleep: async () => {} }) : null,
  });
  const call = (path: string, init: RequestInit = {}, remoteAddress = "203.0.113.10") =>
    broker.handle(new Request(`${BROKER_ORIGIN}${path}`, init), { remoteAddress });
  const postJson = (path: string, body: unknown) =>
    call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const postForm = (path: string, form: Record<string, string>, origin: string | null = BROKER_ORIGIN) =>
    call(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...(origin ? { origin } : {}) },
      body: new URLSearchParams(form).toString(),
    });
  return { broker, google, store, audit, config, call, postJson, postForm };
}

/** Enrolls an instance through the real request, operator approval and signed claim steps. */
export async function enroll(harness: ReturnType<typeof createTestBroker>, instance = createTestInstance()) {
  const returnState = "s".repeat(43);
  const started = await harness.postJson("/v1/connector/enrollments", {
    instanceId: instance.instanceId,
    environment: "development",
    origin: INSTANCE_ORIGIN,
    returnUri: `${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/enrollment-callback`,
    returnState,
    label: "Test instance",
    signPublicKey: instance.signPublicKey,
    sealPublicKey: instance.sealPublicKey,
  });
  const { enrollmentId } = await started.json() as { enrollmentId: string };
  const approved = await harness.postForm("/connections/enroll", { id: enrollmentId, operator_token: OPERATOR_TOKEN, decision: "approve" });
  const approvalCode = new URL(approved.headers.get("location")!).searchParams.get("approval_code")!;
  const completed = await harness.postJson("/v1/connector/enrollment-claims", {
    request: signRequest(instance, requestClaims(instance, "/v1/connector/enrollment-claims", "enroll", {
      sub: "self-hosted-admin", cid: "self-hosted", ah: createHash("sha256").update(approvalCode).digest("base64url"),
    })),
    enrollmentId,
    approvalCode,
  });
  if (completed.status !== 200) throw new Error(`enrollment failed: ${completed.status}`);
  return instance;
}
