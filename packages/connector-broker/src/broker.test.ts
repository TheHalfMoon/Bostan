import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GOOGLE_WORKSPACE_CONNECTOR_PROFILES } from "@bostan/shared";
import type { SealedEnvelope } from "./crypto.js";
import {
  BROKER_ORIGIN,
  createTestBroker,
  createTestInstance,
  enroll,
  INSTANCE_ORIGIN,
  openSealed,
  OPERATOR_TOKEN,
  requestClaims,
  signRequest,
  type TestInstance,
} from "./test-support.js";

const GMAIL_DRAFT = [...GOOGLE_WORKSPACE_CONNECTOR_PROFILES["gmail.draft"].scopes];
const CALLBACK = `${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/callback`;
const RETURN_STATE = "instance-oauth-state-0123456789";
const hash = (value: string) => createHash("sha256").update(value).digest("base64url");

type Harness = ReturnType<typeof createTestBroker>;

async function signed(harness: Harness, instance: TestInstance, path: string, op: string, extra: Record<string, unknown> = {}, secret?: { field: string; value: string }) {
  return harness.postJson(path, {
    request: signRequest(instance, requestClaims(instance, path, op, { ...extra, ...(secret ? { sh: hash(secret.value) } : {}) })),
    ...(secret ? { [secret.field]: secret.value } : {}),
  });
}

const gmailDraft = { prv: "google", prf: "gmail.draft", scp: GMAIL_DRAFT };

async function startSession(harness: Harness, instance: TestInstance, extra: Record<string, unknown> = {}) {
  return signed(harness, instance, "/v1/connector/sessions", "session", { ...gmailDraft, ruri: CALLBACK, rst: RETURN_STATE, ...extra });
}

/** Drives a session through confirmation, Google consent and the broker callback. */
async function authorize(harness: Harness, instance: TestInstance, extra: Record<string, unknown> = {}) {
  const session = await startSession(harness, instance, extra);
  expect(session.status).toBe(200);
  const { confirmationUrl } = await session.json() as { confirmationUrl: string };
  const sessionId = new URL(confirmationUrl).searchParams.get("session")!;
  const toGoogle = await harness.postForm("/connections/confirm", { session: sessionId, decision: "continue" });
  expect(toGoogle.status).toBe(303);
  const authorizationUrl = toGoogle.headers.get("location")!;
  const code = harness.google.approve(authorizationUrl);
  const state = new URL(authorizationUrl).searchParams.get("state")!;
  const callback = await harness.call(`/oauth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`);
  return { authorizationUrl, state, callback, location: new URL(callback.headers.get("location") ?? "about:blank") };
}

async function claim(harness: Harness, instance: TestInstance, claimId: string, extra: Record<string, unknown> = {}) {
  return signed(harness, instance, "/v1/connector/claims", "claim", { ...gmailDraft, cl: claimId, rid: RETURN_STATE, ...extra });
}

async function connected(harness: Harness) {
  const instance = await enroll(harness);
  const { location } = await authorize(harness, instance);
  const response = await claim(harness, instance, location.searchParams.get("claim_id")!);
  const credentials = openSealed(instance, (await response.json() as { sealed: SealedEnvelope }).sealed, GMAIL_DRAFT);
  return { instance, credentials };
}

describe("enrollment", () => {
  it("requires operator approval and a signed claim bound to the approval code", async () => {
    const harness = createTestBroker();
    const instance = createTestInstance();
    const started = await harness.postJson("/v1/connector/enrollments", {
      instanceId: instance.instanceId, environment: "development", origin: INSTANCE_ORIGIN,
      returnUri: `${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/enrollment-callback`, returnState: "r".repeat(43),
      label: "<script>alert(1)</script>", signPublicKey: instance.signPublicKey, sealPublicKey: instance.sealPublicKey,
    });
    expect(started.status).toBe(201);
    const body = await started.json() as { enrollmentId: string; verificationUrl: string };
    expect(body.verificationUrl).toBe(`${BROKER_ORIGIN}/connections/enroll?id=${body.enrollmentId}`);

    const pageResponse = await harness.call(`/connections/enroll?id=${body.enrollmentId}`);
    const html = await pageResponse.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(pageResponse.headers.get("content-security-policy")).toContain(`form-action 'self' ${INSTANCE_ORIGIN}`);

    expect((await harness.postForm("/connections/enroll", { id: body.enrollmentId, operator_token: "wrong", decision: "approve" })).status).toBe(403);
    expect((await harness.postForm("/connections/enroll", { id: body.enrollmentId, operator_token: OPERATOR_TOKEN, decision: "approve" }, null)).status).toBe(403);
    expect((await harness.postForm("/connections/enroll", { id: body.enrollmentId, operator_token: OPERATOR_TOKEN, decision: "approve" }, "https://evil.test")).status).toBe(403);

    const approved = await harness.postForm("/connections/enroll", { id: body.enrollmentId, operator_token: OPERATOR_TOKEN, decision: "approve" });
    expect(approved.status).toBe(303);
    const location = new URL(approved.headers.get("location")!);
    expect(`${location.origin}${location.pathname}`).toBe(`${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/enrollment-callback`);
    expect(location.searchParams.get("state")).toBe("r".repeat(43));
    const approvalCode = location.searchParams.get("approval_code")!;

    const claimPath = "/v1/connector/enrollment-claims";
    const claimFor = (code: string, signer = instance) => harness.postJson(claimPath, {
      request: signRequest(signer, requestClaims(instance, claimPath, "enroll", { sub: "self-hosted-admin", cid: "self-hosted", ah: hash(code) })),
      enrollmentId: body.enrollmentId,
      approvalCode: code,
    });
    expect((await claimFor("not-the-code")).status).toBe(403);
    expect((await claimFor(approvalCode, createTestInstance())).status).toBe(401);
    const completed = await claimFor(approvalCode);
    expect(completed.status).toBe(200);
    expect(await completed.json()).toEqual({ id: instance.instanceId, environment: "development", origins: [INSTANCE_ORIGIN] });
    expect((await claimFor(approvalCode)).status).toBe(403);
    expect(harness.audit.records.map((entry) => entry.event)).toEqual(expect.arrayContaining(["enrollment.requested", "enrollment.approved", "enrollment.completed"]));
  });

  it("rejects malformed, foreign-environment and disallowed enrollment requests", async () => {
    const harness = createTestBroker({ allowedInstanceOrigins: [INSTANCE_ORIGIN] });
    const instance = createTestInstance();
    const base = {
      instanceId: instance.instanceId, environment: "development", origin: INSTANCE_ORIGIN,
      returnUri: `${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/enrollment-callback`, returnState: "r".repeat(43),
      signPublicKey: instance.signPublicKey, sealPublicKey: instance.sealPublicKey,
    };
    const status = async (body: Record<string, unknown>) => (await harness.postJson("/v1/connector/enrollments", body)).status;
    expect(await status({ ...base, environment: "production" })).toBe(403);
    expect(await status({ ...base, origin: "http://bostan.example.test", returnUri: "http://bostan.example.test/api/tools/oauth/cloud-connector/enrollment-callback" })).toBe(400);
    expect(await status({ ...base, origin: "https://other.example.test", returnUri: "https://other.example.test/api/tools/oauth/cloud-connector/enrollment-callback" })).toBe(403);
    expect(await status({ ...base, returnUri: `${INSTANCE_ORIGIN}/elsewhere` })).toBe(400);
    expect(await status({ ...base, signPublicKey: "short" })).toBe(400);
    expect(await status({ ...base, instanceId: "../etc" })).toBe(400);
  });

  it("accepts loopback HTTP instances for local desktop installs", async () => {
    const harness = createTestBroker();
    const instance = createTestInstance();
    const response = await harness.postJson("/v1/connector/enrollments", {
      instanceId: instance.instanceId, environment: "development", origin: "http://localhost:3100",
      returnUri: "http://localhost:3100/api/tools/oauth/cloud-connector/enrollment-callback", returnState: "r".repeat(43),
      signPublicKey: instance.signPublicKey, sealPublicKey: instance.sealPublicKey,
    });
    expect(response.status).toBe(201);
  });

  it("rate limits enrollment requests per address", async () => {
    const harness = createTestBroker();
    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) statuses.push((await harness.postJson("/v1/connector/enrollments", {})).status);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("signed request verification", () => {
  it("reports capabilities only to enrolled instances", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const status = await signed(harness, instance, "/v1/connector/instance-status", "status", { sub: "instance-status", cid: "instance-status" });
    expect(await status.json()).toEqual({ status: "active", active: true, protocolVersion: 1, providers: ["google"], profiles: ["gmail.read", "gmail.draft", "drive.read", "workspace.all"] });
    const stranger = await signed(harness, createTestInstance(), "/v1/connector/instance-status", "status", { sub: "instance-status", cid: "instance-status" });
    expect(stranger.status).toBe(401);
  });

  it.each([
    ["wrong audience", { aud: `${BROKER_ORIGIN}/v1/connector/claims` }, 401, "AUDIENCE_MISMATCH"],
    ["wrong operation", { op: "claim" }, 400, "OPERATION_MISMATCH"],
    ["wrong environment", { env: "production" }, 403, "ENVIRONMENT_MISMATCH"],
    ["expired", { iat: 1_000, exp: 1_060 }, 401, "REQUEST_EXPIRED"],
    ["too long-lived", { exp: Math.floor(Date.now() / 1000) + 3_600 }, 401, "REQUEST_EXPIRED"],
    ["profile not enabled", { prf: "calendar.write", scp: [...GOOGLE_WORKSPACE_CONNECTOR_PROFILES["calendar.write"].scopes] }, 403, "PROFILE_NOT_AVAILABLE"],
    ["broadened scopes", { scp: [...GMAIL_DRAFT, "https://www.googleapis.com/auth/gmail.modify"] }, 403, "PROFILE_NOT_ELIGIBLE"],
    ["foreign return origin", { ruri: "https://attacker.test/api/tools/oauth/cloud-connector/callback" }, 403, "RETURN_ORIGIN_NOT_ENROLLED"],
    ["return path", { ruri: `${INSTANCE_ORIGIN}/somewhere` }, 400, "INVALID_RETURN_URI"],
    ["return query", { ruri: `${CALLBACK}?next=https://attacker.test` }, 400, "INVALID_RETURN_URI"],
  ])("rejects a session request with %s", async (_label, override, status, code) => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const response = await harness.postJson("/v1/connector/sessions", {
      request: signRequest(instance, { ...requestClaims(instance, "/v1/connector/sessions", "session", { ...gmailDraft, ruri: CALLBACK, rst: RETURN_STATE }), ...override }),
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });

  it("rejects forged signatures, unsupported algorithms and replays", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const claims = requestClaims(instance, "/v1/connector/sessions", "session", { ...gmailDraft, ruri: CALLBACK, rst: RETURN_STATE });
    const forger = { ...createTestInstance(), instanceId: instance.instanceId };
    expect((await harness.postJson("/v1/connector/sessions", { request: signRequest(forger, claims) })).status).toBe(401);
    expect((await harness.postJson("/v1/connector/sessions", { request: signRequest(instance, claims, { alg: "none", typ: "paperclip-cloud-connector-request+jwt" }) })).status).toBe(400);
    expect((await harness.postJson("/v1/connector/sessions", { request: "not.a.jws!" })).status).toBe(400);
    const token = signRequest(instance, claims);
    expect((await harness.postJson("/v1/connector/sessions", { request: token })).status).toBe(200);
    const replay = await harness.postJson("/v1/connector/sessions", { request: token });
    expect(await replay.json()).toEqual({ error: "REQUEST_REPLAYED" });
  });

  it("refuses unsupported broker operations", async () => {
    const harness = createTestBroker();
    expect((await harness.postJson("/v1/connector/events/lease", {})).status).toBe(404);
    expect((await harness.postJson("/v1/connector/github-apps", {})).status).toBe(404);
  });
});

describe("Google authorization", () => {
  it("issues sealed credentials whose refresh token is an opaque broker handle", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const { authorizationUrl, location } = await authorize(harness, instance);
    const authorization = new URL(authorizationUrl);
    expect(`${authorization.origin}${authorization.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("redirect_uri")).toBe(`${BROKER_ORIGIN}/oauth/google/callback`);
    expect(authorization.searchParams.get("scope")!.split(" ").sort()).toEqual([...GMAIL_DRAFT].sort());
    expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
    expect(location.searchParams.get("state")).toBe(RETURN_STATE);

    const response = await claim(harness, instance, location.searchParams.get("claim_id")!);
    expect(response.status).toBe(200);
    const sealed = (await response.json() as { sealed: SealedEnvelope }).sealed;
    expect(sealed).toMatchObject({ v: 1, alg: "X25519-HKDF-SHA256-A256GCM", purpose: "initial", provider: "google", profile: "gmail.draft" });
    const credentials = openSealed(instance, sealed, GMAIL_DRAFT);
    expect(credentials).toMatchObject({
      v: 1, accessToken: expect.stringMatching(/^google-access-/), tokenType: "Bearer", subject: "user-1", companyId: "company-1",
      instanceId: instance.instanceId, environment: "development", provider: "google", profile: "gmail.draft", appSlug: "gmail",
    });
    expect(credentials.refreshToken).toMatch(/^brk_rt_/);
    expect([...credentials.scopes as string[]].sort()).toEqual([...GMAIL_DRAFT].sort());

    const persisted = JSON.stringify(harness.store.read());
    expect(persisted).not.toMatch(/google-(access|refresh)-/);
    expect(persisted).not.toContain(credentials.refreshToken as string);
    expect(persisted).not.toContain(RETURN_STATE);
    const audit = JSON.stringify(harness.audit.records);
    expect(audit).not.toMatch(/google-(access|refresh)-|brk_rt_|user-1/);
  });

  it("does not let a callback or claim be reused or redeemed by another binding", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const { state, location } = await authorize(harness, instance);
    const replayed = await harness.call(`/oauth/google/callback?state=${encodeURIComponent(state)}&code=fake-code-1`);
    expect(replayed.status).toBe(400);
    const claimId = location.searchParams.get("claim_id")!;
    expect((await claim(harness, instance, claimId, { rid: "another-state-0123456789" })).status).toBe(403);
    expect((await claim(harness, instance, claimId, { cid: "company-2" })).status).toBe(403);
    expect((await claim(harness, instance, claimId, { sub: "user-2" })).status).toBe(403);
    expect((await claim(harness, instance, claimId)).status).toBe(200);
    // Repeat redemption with the same binding is idempotent until the claim's limit.
    expect((await claim(harness, instance, claimId)).status).toBe(200);
  });

  it("returns access_denied and keeps nothing when Google narrows consent", async () => {
    const harness = createTestBroker();
    harness.google.grantScopes = (requested) => requested.filter((scope) => !scope.endsWith("gmail.compose"));
    const instance = await enroll(harness);
    const { location } = await authorize(harness, instance);
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("claim_id")).toBeNull();
    // Client-wide Google revocation would disconnect the account's other profiles.
    expect(harness.google.revoked).toHaveLength(0);
    expect(Object.keys(harness.store.read().grants)).toHaveLength(0);
    expect(Object.keys(harness.store.read().claims)).toHaveLength(0);
  });

  it("returns access_denied when Google withholds a refresh token", async () => {
    const harness = createTestBroker();
    harness.google.omitRefreshToken = true;
    const instance = await enroll(harness);
    const { location } = await authorize(harness, instance);
    expect(location.searchParams.get("error")).toBe("access_denied");
  });

  it("returns access_denied when the user cancels on the confirmation page", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const session = await startSession(harness, instance);
    const sessionId = new URL((await session.json() as { confirmationUrl: string }).confirmationUrl).searchParams.get("session")!;
    const page = await harness.call(`/connections/confirm?session=${sessionId}`);
    expect(page.headers.get("content-security-policy")).toContain("https://accounts.google.com");
    const cancelled = await harness.postForm("/connections/confirm", { session: sessionId, decision: "cancel" });
    const location = new URL(cancelled.headers.get("location")!);
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("state")).toBe(RETURN_STATE);
  });

  it("keeps the requested subset for the combined workspace profile", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const requested = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/drive.readonly"];
    const { location } = await authorize(harness, instance, { prf: "workspace.all", scp: requested });
    const response = await claim(harness, instance, location.searchParams.get("claim_id")!, { prf: "workspace.all", scp: requested });
    const credentials = openSealed(instance, (await response.json() as { sealed: SealedEnvelope }).sealed, requested);
    expect([...credentials.scopes as string[]].sort()).toEqual([...requested].sort());
  });
});

describe("refresh and revocation", () => {
  it("refreshes through the stored provider token and binds the result to the grant", async () => {
    const harness = createTestBroker();
    const { instance, credentials } = await connected(harness);
    const handle = credentials.refreshToken as string;
    const refreshed = await signed(harness, instance, "/v1/connector/refresh", "refresh", gmailDraft, { field: "refreshToken", value: handle });
    expect(refreshed.status).toBe(200);
    const sealed = (await refreshed.json() as { sealed: SealedEnvelope }).sealed;
    expect(sealed.purpose).toBe("access");
    const next = openSealed(instance, sealed, GMAIL_DRAFT);
    expect(next.accessToken).not.toBe(credentials.accessToken);
    expect(next.refreshToken).toBe(handle);

    expect((await signed(harness, instance, "/v1/connector/refresh", "refresh", { ...gmailDraft, cid: "company-2" }, { field: "refreshToken", value: handle })).status).toBe(403);
    const mismatch = await harness.postJson("/v1/connector/refresh", {
      request: signRequest(instance, requestClaims(instance, "/v1/connector/refresh", "refresh", { ...gmailDraft, sh: hash("other") })),
      refreshToken: handle,
    });
    expect(await mismatch.json()).toEqual({ error: "PAYLOAD_MISMATCH" });
  });

  it("asks for reauthorization when Google rejects the grant", async () => {
    const harness = createTestBroker();
    const { instance, credentials } = await connected(harness);
    harness.google.refreshFailure = "invalid_grant";
    const response = await signed(harness, instance, "/v1/connector/refresh", "refresh", gmailDraft, { field: "refreshToken", value: credentials.refreshToken as string });
    expect(response.status).toBe(409);
    expect(Object.keys(harness.store.read().grants)).toHaveLength(0);
  });

  it("retries transient provider failures a bounded number of times", async () => {
    const harness = createTestBroker();
    const { instance, credentials } = await connected(harness);
    harness.google.refreshFailure = "server_error";
    const before = harness.google.calls.filter((call) => call.endsWith("refresh_token")).length;
    const response = await signed(harness, instance, "/v1/connector/refresh", "refresh", gmailDraft, { field: "refreshToken", value: credentials.refreshToken as string });
    expect(response.status).toBe(502);
    expect(harness.google.calls.filter((call) => call.endsWith("refresh_token")).length - before).toBe(3);
    expect(Object.keys(harness.store.read().grants)).toHaveLength(1);
  });

  it("destroys the grant without client-wide Google revocation and refuses later refreshes", async () => {
    const harness = createTestBroker();
    const { instance, credentials } = await connected(harness);
    const handle = credentials.refreshToken as string;
    const revoked = await signed(harness, instance, "/v1/connector/revoke", "revoke", gmailDraft, { field: "token", value: handle });
    expect(revoked.status).toBe(204);
    expect(harness.google.revoked).toEqual([]);
    expect(Object.keys(harness.store.read().grants)).toHaveLength(0);
    expect((await signed(harness, instance, "/v1/connector/revoke", "revoke", gmailDraft, { field: "token", value: handle })).status).toBe(204);
    expect((await signed(harness, instance, "/v1/connector/refresh", "refresh", gmailDraft, { field: "refreshToken", value: handle })).status).toBe(409);
  });

  it("does not let another instance use a grant handle", async () => {
    const harness = createTestBroker();
    const { credentials } = await connected(harness);
    const other = await enroll(harness);
    const response = await signed(harness, other, "/v1/connector/refresh", "refresh", gmailDraft, { field: "refreshToken", value: credentials.refreshToken as string });
    expect(response.status).toBe(403);
  });
});

describe("review regressions", () => {
  it("serves pages with a referrer policy that keeps the form Origin header", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    const session = await startSession(harness, instance);
    const confirmation = (await session.json() as { confirmationUrl: string }).confirmationUrl;
    const page = await harness.call(new URL(confirmation).pathname + new URL(confirmation).search);
    expect(page.headers.get("referrer-policy")).toBe("same-origin");
  });

  it("does not let an unauthenticated request replace another key's enrollment", async () => {
    const harness = createTestBroker();
    const victim = createTestInstance();
    const request = (signPublicKey: string) => harness.postJson("/v1/connector/enrollments", {
      instanceId: victim.instanceId, environment: "development", origin: INSTANCE_ORIGIN,
      returnUri: `${INSTANCE_ORIGIN}/api/tools/oauth/cloud-connector/enrollment-callback`, returnState: "r".repeat(43),
      signPublicKey, sealPublicKey: victim.sealPublicKey,
    });
    expect((await request(victim.signPublicKey)).status).toBe(201);
    expect((await request(createTestInstance().signPublicKey)).status).toBe(409);
    // The key holder may restart its own pending request.
    expect((await request(victim.signPublicKey)).status).toBe(201);
  });

  it("drops an unredeemed grant once its claim expires", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    await authorize(harness, instance);
    expect(Object.keys(harness.store.read().grants)).toHaveLength(1);
    harness.store.mutate((state) => { for (const pending of Object.values(state.claims)) pending.expiresAt = 0; });
    await startSession(harness, instance);
    expect(Object.keys(harness.store.read().grants)).toHaveLength(0);
  });

  it("keeps a grant after its claim is redeemed", async () => {
    const harness = createTestBroker();
    await connected(harness);
    harness.store.mutate((state) => { for (const pending of Object.values(state.claims)) pending.expiresAt = 0; });
    harness.store.mutate(() => {});
    expect(Object.keys(harness.store.read().grants)).toHaveLength(1);
  });

  it("does not return a token when the grant was revoked during refresh", async () => {
    const harness = createTestBroker();
    const { instance, credentials } = await connected(harness);
    harness.google.onRefresh = () => { harness.store.mutate((state) => { state.grants = {}; }); };
    const response = await signed(harness, instance, "/v1/connector/refresh", "refresh", gmailDraft, { field: "refreshToken", value: credentials.refreshToken as string });
    expect(response.status).toBe(409);
  });

  it("does not write state for unmatched callbacks", async () => {
    const harness = createTestBroker();
    let writes = 0;
    const mutate = harness.store.mutate.bind(harness.store);
    harness.store.mutate = ((fn) => { writes += 1; return mutate(fn); }) as typeof harness.store.mutate;
    expect((await harness.call("/oauth/google/callback?state=guess&code=x")).status).toBe(400);
    expect((await harness.postForm("/connections/confirm", { session: "ses_guess", decision: "continue" })).status).toBe(404);
    expect(writes).toBe(0);
  });
});

describe("operator controls", () => {
  it("offers no profiles when Google is not configured", async () => {
    const harness = createTestBroker({ google: null });
    const instance = await enroll(harness);
    const status = await signed(harness, instance, "/v1/connector/instance-status", "status", { sub: "instance-status", cid: "instance-status" });
    expect(await status.json()).toMatchObject({ active: true, profiles: [], providers: [] });
    expect((await startSession(harness, instance)).status).toBe(403);
  });

  it("reports suspended instances and refuses their operations", async () => {
    const harness = createTestBroker();
    const instance = await enroll(harness);
    harness.store.mutate((state) => { state.instances[instance.instanceId]!.status = "suspended"; });
    const status = await signed(harness, instance, "/v1/connector/instance-status", "status", { sub: "instance-status", cid: "instance-status" });
    expect(await status.json()).toEqual({ status: "suspended", active: false, profiles: [] });
    expect((await startSession(harness, instance)).status).toBe(403);
  });
});
