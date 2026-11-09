import {
  GOOGLE_WORKSPACE_CONNECTOR_PROFILES,
  isGoogleWorkspaceConnectorProfileId,
  isGoogleWorkspaceScopeGrant,
} from "@bostan/shared";
import type { AuditEvent, AuditSink } from "./audit.js";
import type { BrokerConfig } from "./config.js";
import { normalizeInstanceOrigin } from "./config.js";
import {
  decodeJws,
  isRecord,
  JWS_TYP,
  pkceChallenge,
  randomToken,
  rawPublicKey,
  safeEqual,
  SecretBox,
  sealToInstance,
  sha256,
  verifyJwsSignature,
  type SealPurpose,
} from "./crypto.js";
import { ProviderError, type GoogleClient, type ProviderTokens } from "./google.js";
import { escapeHtml, pageSecurityHeaders, renderPage } from "./html.js";
import { RateLimiter } from "./rate-limit.js";
import { pruneExpired, type BrokerStore, type Claim, type Grant, type Instance, type Session } from "./store.js";

export const ENROLLMENT_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 10 * 60_000;
export const CLAIM_TTL_MS = 10 * 60_000;
const MAX_CLAIM_REDEMPTIONS = 5;
const MAX_PENDING_ENROLLMENTS = 50;
const MAX_PENDING_ENROLLMENTS_PER_ORIGIN = 5;
const MAX_PENDING_SESSIONS_PER_INSTANCE = 100;
const MAX_REQUEST_LIFETIME_S = 120;
const CLOCK_SKEW_S = 30;
const ENROLLMENT_CALLBACK_PATH = "/api/tools/oauth/cloud-connector/enrollment-callback";
const AUTHORIZATION_CALLBACK_PATH = "/api/tools/oauth/cloud-connector/callback";
const GOOGLE_CALLBACK_PATH = "/oauth/google/callback";
export const PROTOCOL_VERSION = 1;

type Operation = "status" | "session" | "claim" | "refresh" | "revoke" | "enroll";

const OPERATION_PATHS: Record<string, Operation> = {
  "/v1/connector/instance-status": "status",
  "/v1/connector/sessions": "session",
  "/v1/connector/claims": "claim",
  "/v1/connector/refresh": "refresh",
  "/v1/connector/revoke": "revoke",
};

/** A rejection with a status and one of the client's allowlisted reason codes. */
class Rejection extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

export type BrokerDependencies = {
  config: BrokerConfig;
  store: BrokerStore;
  audit: AuditSink;
  google: GoogleClient | null;
  now?: () => number;
};

export type RequestMeta = { remoteAddress: string };

export function createBroker(dependencies: BrokerDependencies) {
  const { config, store, audit, google } = dependencies;
  const now = dependencies.now ?? Date.now;
  const box = new SecretBox(config.masterKey);
  const limits = {
    enrollment: new RateLimiter(10, 10 * 60_000, now),
    operator: new RateLimiter(5, 10 * 60_000, now),
    // Caps operator-token guessing even when callers rotate addresses.
    operatorGlobal: new RateLimiter(20, 10 * 60_000, now),
    browser: new RateLimiter(60, 60_000, now),
    signed: new RateLimiter(600, 60_000, now),
    session: new RateLimiter(120, 60_000, now),
    sessionSubject: new RateLimiter(10, 60_000, now),
    token: new RateLimiter(120, 60_000, now),
    status: new RateLimiter(60, 60_000, now),
  };
  const googleProfiles = new Set<string>(config.google?.profiles ?? []);
  const googleRedirectUri = `${config.publicOrigin}${GOOGLE_CALLBACK_PATH}`;

  function record(event: AuditEvent) {
    try {
      audit.record(event);
    } catch {
      // Audit failure must not turn a completed security decision into a 500.
    }
  }

  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }

  function rejection(error: Rejection): Response {
    return json(error.status, { error: error.code });
  }

  function page(status: number, title: string, body: string, formTargets: string[] = []): Response {
    return new Response(renderPage(title, body), { status, headers: pageSecurityHeaders(formTargets) });
  }

  function redirect(location: string): Response {
    return new Response(null, { status: 303, headers: { location, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  }

  async function readJson(request: Request): Promise<Record<string, unknown>> {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new Rejection(415, "MALFORMED_REQUEST");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new Rejection(400, "MALFORMED_REQUEST");
    }
    if (!isRecord(body)) throw new Rejection(400, "MALFORMED_REQUEST");
    return body;
  }

  async function readForm(request: Request): Promise<URLSearchParams> {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      throw new Rejection(415, "MALFORMED_REQUEST");
    }
    // Browser forms must come from this broker's own pages (CSRF defence).
    if (request.headers.get("origin") !== config.publicOrigin) throw new Rejection(403, "INVALID_REQUEST");
    return new URLSearchParams(await request.text());
  }

  /** Verifies a signed instance request and returns its claims and instance. */
  function authenticate(
    body: Record<string, unknown>,
    operation: Operation,
    path: string,
    signer?: { instanceId: string; signPublicKey: string; environment: string },
  ): { claims: Record<string, unknown>; instance: Instance | null } {
    const jws = decodeJws(body.request);
    if (!jws) throw new Rejection(400, "MALFORMED_REQUEST");
    if (jws.header.alg !== "EdDSA" || jws.header.typ !== JWS_TYP) throw new Rejection(400, "UNSUPPORTED_ALGORITHM");
    const { claims } = jws;
    if (typeof claims.iss !== "string") throw new Rejection(400, "MALFORMED_REQUEST");
    const instance = signer ? null : store.read().instances[claims.iss] ?? null;
    const identity = signer ?? instance;
    if (!identity || (signer && signer.instanceId !== claims.iss)) throw new Rejection(401, "UNKNOWN_INSTANCE");
    const key = rawPublicKey(identity.signPublicKey, "ed25519");
    if (!key || !verifyJwsSignature(jws, key)) throw new Rejection(401, "SIGNATURE_REJECTED");
    if (claims.aud !== `${config.publicOrigin}${path}`) throw new Rejection(401, "AUDIENCE_MISMATCH");
    if (claims.op !== operation) throw new Rejection(400, "OPERATION_MISMATCH");
    if (claims.env !== identity.environment || claims.env !== config.environment) throw new Rejection(403, "ENVIRONMENT_MISMATCH");
    const nowS = Math.floor(now() / 1000);
    if (typeof claims.iat !== "number" || typeof claims.exp !== "number"
      || claims.iat > nowS + CLOCK_SKEW_S || claims.exp <= nowS || claims.exp - claims.iat > MAX_REQUEST_LIFETIME_S) {
      throw new Rejection(401, "REQUEST_EXPIRED");
    }
    if (typeof claims.jti !== "string" || claims.jti.length < 16 || claims.jti.length > 128) throw new Rejection(400, "MALFORMED_REQUEST");
    // Limit before the replay record so a signer cannot force unbounded state writes.
    if (!limits.signed.allow(`signed:${claims.iss}`)) throw new Rejection(429, "RATE_LIMITED");
    const replayKey = `${claims.iss}:${claims.jti}`;
    const fresh = store.mutate((state) => {
      pruneExpired(state, now());
      if (state.replay[replayKey] !== undefined) return false;
      state.replay[replayKey] = claims.exp as number;
      return true;
    });
    if (!fresh) throw new Rejection(401, "REQUEST_REPLAYED");
    if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 200
      || typeof claims.cid !== "string" || claims.cid.length === 0 || claims.cid.length > 200) {
      throw new Rejection(400, "MALFORMED_REQUEST");
    }
    return { claims, instance };
  }

  function activeInstance(instance: Instance | null): Instance {
    if (!instance) throw new Rejection(401, "UNKNOWN_INSTANCE");
    if (instance.status !== "active") throw new Rejection(403, "INSTANCE_SUSPENDED");
    return instance;
  }

  /** The secret travelling beside the JWS must be the one the instance signed. */
  function signedSecret(body: Record<string, unknown>, claims: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== "string" || value.length === 0 || value.length > 4_096) throw new Rejection(400, "MALFORMED_REQUEST");
    if (typeof claims.sh !== "string" || !safeEqual(claims.sh, sha256(value))) throw new Rejection(400, "PAYLOAD_MISMATCH");
    return value;
  }

  function requestedProfile(claims: Record<string, unknown>): { profile: string; scopes: string[]; profileScopes: string[] } {
    if (claims.prv !== "google" || typeof claims.prf !== "string" || !isGoogleWorkspaceConnectorProfileId(claims.prf)) {
      throw new Rejection(403, "PROFILE_NOT_AVAILABLE");
    }
    if (!google || !googleProfiles.has(claims.prf)) throw new Rejection(403, "PROFILE_NOT_AVAILABLE");
    const profileScopes = [...GOOGLE_WORKSPACE_CONNECTOR_PROFILES[claims.prf].scopes];
    const scopes = Array.isArray(claims.scp) && claims.scp.every((scope) => typeof scope === "string") ? [...new Set(claims.scp as string[])] : null;
    if (!scopes) throw new Rejection(400, "INVALID_REQUEST");
    const valid = claims.prf === "workspace.all" ? isGoogleWorkspaceScopeGrant(scopes) : sameSet(scopes, profileScopes);
    if (!valid) throw new Rejection(403, "PROFILE_NOT_ELIGIBLE");
    return { profile: claims.prf, scopes, profileScopes };
  }

  function sealCredentials(input: {
    instance: Instance;
    purpose: SealPurpose;
    profile: string;
    aadScopes: readonly string[];
    subject: string;
    companyId: string;
    accessToken: string;
    tokenType: string;
    accessTokenExpiresAt: string | null;
    refreshToken: string | null;
    scopes: readonly string[];
  }) {
    return sealToInstance({
      recipientPublicKey: input.instance.sealPublicKey,
      purpose: input.purpose,
      instanceId: input.instance.id,
      environment: input.instance.environment,
      provider: "google",
      profile: input.profile,
      aadScopes: input.aadScopes,
      plaintext: {
        v: 1,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenType: input.tokenType,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: null,
        scopes: [...input.scopes],
        subject: input.subject,
        companyId: input.companyId,
        instanceId: input.instance.id,
        environment: input.instance.environment,
        provider: "google",
        profile: input.profile,
        appSlug: (GOOGLE_WORKSPACE_CONNECTOR_PROFILES[input.profile as keyof typeof GOOGLE_WORKSPACE_CONNECTOR_PROFILES] as { appSlug?: string }).appSlug,
      },
    });
  }

  function expiry(tokens: ProviderTokens): string | null {
    return tokens.expiresInSeconds === null ? null : new Date(now() + tokens.expiresInSeconds * 1000).toISOString();
  }

  // ---- Enrollment -------------------------------------------------------

  async function requestEnrollment(request: Request, meta: RequestMeta): Promise<Response> {
    if (!limits.enrollment.allow(`enroll:${meta.remoteAddress}`)) throw new Rejection(429, "RATE_LIMITED");
    const body = await readJson(request);
    const origin = normalizeInstanceOrigin(body.origin);
    if (!origin) throw new Rejection(400, "INVALID_RETURN_URI");
    if (config.allowedInstanceOrigins && !config.allowedInstanceOrigins.includes(origin)) {
      throw new Rejection(403, "RETURN_ORIGIN_NOT_ENROLLED");
    }
    if (typeof body.instanceId !== "string" || !/^inst_[0-9a-f-]{36}$/.test(body.instanceId)) throw new Rejection(400, "INVALID_REQUEST");
    if (body.environment !== config.environment) throw new Rejection(403, "ENVIRONMENT_MISMATCH");
    if (body.returnUri !== `${origin}${ENROLLMENT_CALLBACK_PATH}`) throw new Rejection(400, "INVALID_RETURN_URI");
    if (typeof body.returnState !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(body.returnState)) throw new Rejection(400, "INVALID_REQUEST");
    if (!rawPublicKey(body.signPublicKey, "ed25519") || !rawPublicKey(body.sealPublicKey, "x25519")) throw new Rejection(400, "INVALID_REQUEST");
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 100) || "Self-hosted Bostan" : "Self-hosted Bostan";
    const instanceId = body.instanceId;
    const id = `enr_${randomToken(16)}`;
    const expiresAt = now() + ENROLLMENT_TTL_MS;
    store.mutate((state) => {
      pruneExpired(state, now());
      if (state.instances[instanceId]) throw new Rejection(409, "INVALID_REQUEST");
      for (const [existing, enrollment] of Object.entries(state.enrollments)) {
        if (enrollment.instanceId !== instanceId) continue;
        // Only the key holder may replace its own pending request; an approved
        // enrollment is never replaced by an unauthenticated request.
        if (enrollment.status !== "pending" || enrollment.signPublicKey !== body.signPublicKey) throw new Rejection(409, "INVALID_REQUEST");
        delete state.enrollments[existing];
      }
      const pending = Object.values(state.enrollments);
      if (pending.length >= MAX_PENDING_ENROLLMENTS
        || pending.filter((enrollment) => enrollment.origin === origin).length >= MAX_PENDING_ENROLLMENTS_PER_ORIGIN) {
        throw new Rejection(429, "RATE_LIMITED");
      }
      state.enrollments[id] = {
        id,
        instanceId,
        environment: config.environment,
        origin,
        returnUri: body.returnUri as string,
        sealedReturnState: box.seal(body.returnState as string, `enrollment:${id}`),
        label,
        signPublicKey: body.signPublicKey as string,
        sealPublicKey: body.sealPublicKey as string,
        createdAt: now(),
        expiresAt,
        status: "pending",
      };
    });
    record({ event: "enrollment.requested", instanceId, outcome: "ok" });
    return json(201, {
      enrollmentId: id,
      verificationUrl: `${config.publicOrigin}/connections/enroll?id=${encodeURIComponent(id)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  function enrollmentPage(url: URL): Response {
    const id = url.searchParams.get("id") ?? "";
    const enrollment = store.read().enrollments[id];
    if (!enrollment || enrollment.status !== "pending" || enrollment.expiresAt <= now()) {
      return page(404, "Enrollment not found", "<p>This enrollment request does not exist or has expired. Start enrollment again from Bostan.</p>");
    }
    const fingerprint = sha256(`sign:${enrollment.signPublicKey}`).slice(0, 16);
    return page(200, "Approve a Bostan instance", `
<p>A Bostan instance is asking to use this connector broker. Approve it only if you operate this broker and recognize the instance.</p>
<dl>
<dt>Label</dt><dd>${escapeHtml(enrollment.label)}</dd>
<dt>Instance</dt><dd><code>${escapeHtml(enrollment.instanceId)}</code></dd>
<dt>Instance URL</dt><dd>${escapeHtml(enrollment.origin)}</dd>
<dt>Environment</dt><dd>${escapeHtml(enrollment.environment)}</dd>
<dt>Key fingerprint</dt><dd><code>${escapeHtml(fingerprint)}</code></dd>
<dt>Expires</dt><dd>${escapeHtml(new Date(enrollment.expiresAt).toISOString())}</dd>
</dl>
<form method="post" action="/connections/enroll">
<input type="hidden" name="id" value="${escapeHtml(enrollment.id)}">
<p><label>Operator token<br><input type="password" name="operator_token" autocomplete="off" required></label></p>
<p><button class="primary" name="decision" value="approve">Approve</button><button name="decision" value="deny">Deny</button></p>
</form>`, [enrollment.origin]);
  }

  async function decideEnrollment(request: Request, meta: RequestMeta): Promise<Response> {
    const form = await readForm(request);
    if (!limits.operator.allow(`operator:${meta.remoteAddress}`) || !limits.operatorGlobal.allow("operator")) throw new Rejection(429, "RATE_LIMITED");
    const id = form.get("id") ?? "";
    const token = form.get("operator_token") ?? "";
    if (!safeEqual(token, config.operatorToken)) {
      record({ event: "request.rejected", outcome: "rejected", code: "OPERATOR_TOKEN_REJECTED" });
      return page(403, "Not approved", "<p>The operator token was not accepted.</p>");
    }
    const decision = form.get("decision");
    if (decision === "deny") {
      const denied = store.mutate((state) => {
        const enrollment = state.enrollments[id];
        delete state.enrollments[id];
        return enrollment;
      });
      if (denied) record({ event: "enrollment.denied", instanceId: denied.instanceId, outcome: "ok" });
      return page(200, "Enrollment denied", "<p>The instance was not enrolled. You can close this page.</p>");
    }
    if (decision !== "approve") throw new Rejection(400, "INVALID_REQUEST");
    const approvalCode = randomToken(32);
    const approved = store.mutate((state) => {
      pruneExpired(state, now());
      const enrollment = state.enrollments[id];
      if (!enrollment || enrollment.status !== "pending") return null;
      enrollment.status = "approved";
      enrollment.approvalCodeHash = sha256(approvalCode);
      return enrollment;
    });
    if (!approved) return page(404, "Enrollment not found", "<p>This enrollment request does not exist or has expired.</p>");
    record({ event: "enrollment.approved", instanceId: approved.instanceId, outcome: "ok" });
    const target = new URL(approved.returnUri);
    target.search = new URLSearchParams({
      enrollment_id: approved.id,
      approval_code: approvalCode,
      state: box.open(approved.sealedReturnState, `enrollment:${approved.id}`),
    }).toString();
    return redirect(target.toString());
  }

  async function completeEnrollment(request: Request): Promise<Response> {
    const body = await readJson(request);
    const enrollmentId = typeof body.enrollmentId === "string" ? body.enrollmentId : "";
    const approvalCode = typeof body.approvalCode === "string" ? body.approvalCode : "";
    const enrollment = store.read().enrollments[enrollmentId];
    if (!enrollment || enrollment.status !== "approved" || enrollment.expiresAt <= now() || !enrollment.approvalCodeHash
      || !safeEqual(enrollment.approvalCodeHash, sha256(approvalCode))) {
      throw new Rejection(403, "INSTANCE_APPROVAL_REQUIRED");
    }
    const { claims } = authenticate(body, "enroll", "/v1/connector/enrollment-claims", {
      instanceId: enrollment.instanceId,
      signPublicKey: enrollment.signPublicKey,
      environment: enrollment.environment,
    });
    if (typeof claims.ah !== "string" || !safeEqual(claims.ah, sha256(approvalCode))) throw new Rejection(400, "PAYLOAD_MISMATCH");
    const instance = store.mutate((state) => {
      const current = state.enrollments[enrollmentId];
      if (!current || current.status !== "approved") throw new Rejection(403, "INSTANCE_APPROVAL_REQUIRED");
      delete state.enrollments[enrollmentId];
      const created: Instance = {
        id: current.instanceId,
        environment: current.environment,
        origins: [current.origin],
        label: current.label,
        signPublicKey: current.signPublicKey,
        sealPublicKey: current.sealPublicKey,
        status: "active",
        enrolledAt: now(),
      };
      state.instances[created.id] = created;
      return created;
    });
    record({ event: "enrollment.completed", instanceId: instance.id, outcome: "ok" });
    return json(200, { id: instance.id, environment: instance.environment, origins: instance.origins });
  }

  // ---- Signed instance operations ---------------------------------------

  async function instanceOperation(request: Request, path: string, operation: Operation): Promise<Response> {
    const body = await readJson(request);
    const { claims, instance } = authenticate(body, operation, path);
    if (operation === "status") {
      if (!limits.status.allow(`status:${claims.iss}`)) throw new Rejection(429, "RATE_LIMITED");
      if (!instance) throw new Rejection(401, "UNKNOWN_INSTANCE");
      if (instance.status !== "active") return json(200, { status: "suspended", active: false, profiles: [] });
      return json(200, {
        status: "active",
        active: true,
        protocolVersion: PROTOCOL_VERSION,
        providers: google ? ["google"] : [],
        profiles: [...googleProfiles],
      });
    }
    const enrolled = activeInstance(instance);
    if (operation === "session") return createSession(enrolled, claims);
    if (operation === "claim") return redeemClaim(enrolled, claims);
    if (operation === "refresh") return refreshGrant(enrolled, claims, signedSecret(body, claims, "refreshToken"));
    return revokeGrant(enrolled, claims, signedSecret(body, claims, "token"));
  }

  function createSession(instance: Instance, claims: Record<string, unknown>): Response {
    if (!limits.session.allow(`session:${instance.id}`)
      || !limits.sessionSubject.allow(`session:${instance.id}:${String(claims.cid)}:${String(claims.sub)}`)) {
      throw new Rejection(429, "RATE_LIMITED");
    }
    const { profile, scopes } = requestedProfile(claims);
    if (typeof claims.ruri !== "string") throw new Rejection(400, "INVALID_RETURN_URI");
    let returnUri: URL;
    try {
      returnUri = new URL(claims.ruri);
    } catch {
      throw new Rejection(400, "INVALID_RETURN_URI");
    }
    if (returnUri.pathname !== AUTHORIZATION_CALLBACK_PATH || returnUri.search || returnUri.hash || returnUri.username || returnUri.password) {
      throw new Rejection(400, "INVALID_RETURN_URI");
    }
    if (!instance.origins.includes(returnUri.origin)) throw new Rejection(403, "RETURN_ORIGIN_NOT_ENROLLED");
    if (typeof claims.rst !== "string" || claims.rst.length < 16 || claims.rst.length > 512) throw new Rejection(400, "INVALID_REQUEST");
    const id = `ses_${randomToken(24)}`;
    const expiresAt = now() + SESSION_TTL_MS;
    const session: Session = {
      id,
      instanceId: instance.id,
      companyId: claims.cid as string,
      subject: claims.sub as string,
      provider: "google",
      profile,
      scopes,
      returnUri: returnUri.toString(),
      sealedReturnState: box.seal(claims.rst, `session:${id}`),
      createdAt: now(),
      expiresAt,
      status: "pending",
    };
    store.mutate((state) => {
      pruneExpired(state, now());
      const pending = Object.values(state.sessions).filter((existing) => existing.instanceId === instance.id).length;
      if (pending >= MAX_PENDING_SESSIONS_PER_INSTANCE) throw new Rejection(429, "RATE_LIMITED");
      state.sessions[id] = session;
    });
    record({ event: "session.created", instanceId: instance.id, companyId: session.companyId, subject: session.subject, provider: "google", profile, outcome: "ok" });
    return json(200, {
      confirmationUrl: `${config.publicOrigin}/connections/confirm?session=${encodeURIComponent(id)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  function confirmationPage(url: URL): Response {
    const session = store.read().sessions[url.searchParams.get("session") ?? ""];
    if (!session || session.status !== "pending" || session.expiresAt <= now()) {
      return page(404, "Request expired", "<p>This connection request has expired or was already used. Start again from Bostan.</p>");
    }
    const instance = store.read().instances[session.instanceId];
    const scopeItems = session.scopes.map((scope) => `<li><code>${escapeHtml(scope.replace("https://www.googleapis.com/auth/", ""))}</code></li>`).join("");
    return page(200, "Connect Google Workspace", `
<p>${escapeHtml(instance?.label ?? "A Bostan instance")} (${escapeHtml(instance?.origins[0] ?? "unknown")}) is asking to connect a Google account.</p>
<dl><dt>Access</dt><dd><code>${escapeHtml(session.profile)}</code></dd><dt>Permissions</dt><dd><ul>${scopeItems}</ul></dd></dl>
<p>Continue only if you started this request in Bostan. Google will ask you to approve these permissions.</p>
<form method="post" action="/connections/confirm">
<input type="hidden" name="session" value="${escapeHtml(session.id)}">
<p><button class="primary" name="decision" value="continue">Continue to Google</button><button name="decision" value="cancel">Cancel</button></p>
</form>`, ["https://accounts.google.com", new URL(session.returnUri).origin]);
  }

  async function confirmSession(request: Request, meta: RequestMeta): Promise<Response> {
    if (!limits.browser.allow(`browser:${meta.remoteAddress}`)) throw new Rejection(429, "RATE_LIMITED");
    const form = await readForm(request);
    const id = form.get("session") ?? "";
    const decision = form.get("decision");
    if (decision !== "continue" && decision !== "cancel") throw new Rejection(400, "INVALID_REQUEST");
    const known = store.read().sessions[id];
    if (!known || known.status !== "pending" || known.expiresAt <= now()) {
      return page(404, "Request expired", "<p>This connection request has expired or was already used.</p>");
    }
    const oauthState = randomToken(32);
    const codeVerifier = randomToken(48);
    const session = store.mutate((state) => {
      pruneExpired(state, now());
      const current = state.sessions[id];
      if (!current || current.status !== "pending") return null;
      if (decision === "cancel") {
        delete state.sessions[id];
        return current;
      }
      current.status = "authorizing";
      current.oauthStateHash = sha256(oauthState);
      current.sealedCodeVerifier = box.seal(codeVerifier, `verifier:${id}`);
      return current;
    });
    if (!session) return page(404, "Request expired", "<p>This connection request has expired or was already used.</p>");
    if (decision === "cancel") {
      record({ event: "session.cancelled", instanceId: session.instanceId, companyId: session.companyId, subject: session.subject, profile: session.profile, outcome: "ok" });
      return redirect(returnTo(session, { error: "access_denied" }));
    }
    return redirect(google!.authorizationUrl({
      redirectUri: googleRedirectUri,
      scopes: session.scopes,
      state: oauthState,
      codeChallenge: pkceChallenge(codeVerifier),
    }));
  }

  function returnTo(session: Session, params: Record<string, string>): string {
    const target = new URL(session.returnUri);
    target.search = new URLSearchParams({ state: box.open(session.sealedReturnState, `session:${session.id}`), ...params }).toString();
    return target.toString();
  }

  async function googleCallback(url: URL, meta: RequestMeta): Promise<Response> {
    if (!limits.browser.allow(`browser:${meta.remoteAddress}`)) throw new Rejection(429, "RATE_LIMITED");
    const oauthState = url.searchParams.get("state") ?? "";
    const stateHash = sha256(oauthState);
    const matches = (candidate: Session) =>
      candidate.status === "authorizing" && candidate.oauthStateHash !== undefined && safeEqual(candidate.oauthStateHash, stateHash);
    // Unmatched callbacks must not cause a state write.
    if (!Object.values(store.read().sessions).some(matches)) {
      return page(400, "Request expired", "<p>This sign-in could not be matched to a pending request. Start again from Bostan.</p>");
    }
    // Consume the session before talking to Google so a replayed callback cannot reuse it.
    const session = store.mutate((state) => {
      pruneExpired(state, now());
      const match = Object.values(state.sessions).find(matches);
      if (!match) return null;
      match.status = "completed";
      return structuredClone(match);
    });
    if (!session || !google) return page(400, "Request expired", "<p>This sign-in could not be matched to a pending request. Start again from Bostan.</p>");
    const fail = (code: string) => {
      record({ event: "authorization.failed", instanceId: session.instanceId, companyId: session.companyId, subject: session.subject, provider: "google", profile: session.profile, outcome: "failed", code });
      return redirect(returnTo(session, { error: "access_denied" }));
    };
    const code = url.searchParams.get("code");
    if (url.searchParams.get("error") || !code) return fail("PROVIDER_DENIED");
    let tokens: ProviderTokens;
    try {
      tokens = await google.exchangeCode({ code, codeVerifier: box.open(session.sealedCodeVerifier!, `verifier:${session.id}`), redirectUri: googleRedirectUri });
    } catch {
      return fail("PROVIDER_OPERATION_FAILED");
    }
    const granted = tokens.scopes ?? [];
    const effective = session.scopes.filter((scope) => granted.includes(scope));
    const complete = session.profile === "workspace.all" ? effective.length > 0 : effective.length === session.scopes.length;
    if (!complete || !tokens.refreshToken) {
      // Never hand out a partial or non-refreshable grant. The tokens are
      // discarded rather than revoked: Google revocation is client-wide and
      // would also disconnect this account's other Workspace profiles.
      return fail(complete ? "REFRESH_TOKEN_MISSING" : "SCOPE_NOT_GRANTED");
    }
    const handle = `brk_rt_${randomToken(32)}`;
    const handleHash = sha256(handle);
    const claimId = `clm_${randomToken(24)}`;
    const grant: Grant = {
      handleHash,
      instanceId: session.instanceId,
      companyId: session.companyId,
      subject: session.subject,
      provider: "google",
      profile: session.profile,
      scopes: effective,
      sealedProviderRefreshToken: box.seal(tokens.refreshToken, `grant:${handleHash}`),
      createdAt: now(),
      lastRefreshedAt: null,
      pendingClaimId: claimId,
    };
    const claim: Claim = {
      id: claimId,
      instanceId: session.instanceId,
      companyId: session.companyId,
      subject: session.subject,
      provider: "google",
      profile: session.profile,
      requestedScopes: session.scopes,
      redemptionIdHash: sha256(box.open(session.sealedReturnState, `session:${session.id}`)),
      sealedCredentials: box.seal(JSON.stringify({
        accessToken: tokens.accessToken,
        tokenType: tokens.tokenType,
        accessTokenExpiresAt: expiry(tokens),
        refreshToken: handle,
        scopes: effective,
      }), `claim:${claimId}`),
      expiresAt: now() + CLAIM_TTL_MS,
      redemptions: 0,
    };
    store.mutate((state) => {
      state.grants[handleHash] = grant;
      state.claims[claimId] = claim;
      delete state.sessions[session.id];
    });
    record({ event: "authorization.completed", instanceId: session.instanceId, companyId: session.companyId, subject: session.subject, provider: "google", profile: session.profile, outcome: "ok" });
    return redirect(returnTo(session, { claim_id: claimId }));
  }

  function redeemClaim(instance: Instance, claims: Record<string, unknown>): Response {
    const { profile, scopes } = requestedProfile(claims);
    if (typeof claims.cl !== "string" || typeof claims.rid !== "string") throw new Rejection(400, "MALFORMED_REQUEST");
    const claimId = claims.cl;
    const redemptionId = claims.rid;
    const claim = store.mutate((state) => {
      pruneExpired(state, now());
      const current = state.claims[claimId];
      if (!current || current.instanceId !== instance.id || current.companyId !== claims.cid || current.subject !== claims.sub
        || current.profile !== profile || !sameSet(current.requestedScopes, scopes)
        || !safeEqual(current.redemptionIdHash, sha256(redemptionId))) {
        return null;
      }
      if (current.redemptions >= MAX_CLAIM_REDEMPTIONS) return null;
      current.redemptions += 1;
      for (const grant of Object.values(state.grants)) {
        if (grant.pendingClaimId === current.id) delete grant.pendingClaimId;
      }
      return structuredClone(current);
    });
    if (!claim) {
      record({ event: "request.rejected", instanceId: instance.id, companyId: claims.cid as string, outcome: "rejected", code: "CLAIM_REJECTED" });
      throw new Rejection(403, "PAYLOAD_MISMATCH");
    }
    const credentials = JSON.parse(box.open(claim.sealedCredentials, `claim:${claim.id}`)) as {
      accessToken: string; tokenType: string; accessTokenExpiresAt: string | null; refreshToken: string | null; scopes: string[];
    };
    record({ event: "claim.redeemed", instanceId: instance.id, companyId: claim.companyId, subject: claim.subject, provider: "google", profile, outcome: "ok" });
    return json(200, {
      sealed: sealCredentials({
        instance,
        purpose: "initial",
        profile,
        aadScopes: claim.requestedScopes,
        subject: claim.subject,
        companyId: claim.companyId,
        ...credentials,
      }),
    });
  }

  function boundGrant(instance: Instance, claims: Record<string, unknown>, handle: string): Grant | null {
    const grant = store.read().grants[sha256(handle)];
    if (!grant) return null;
    if (grant.instanceId !== instance.id || grant.companyId !== claims.cid || grant.subject !== claims.sub
      || grant.profile !== claims.prf || claims.prv !== grant.provider) {
      record({ event: "request.rejected", instanceId: instance.id, companyId: claims.cid as string, outcome: "rejected", code: "GRANT_BINDING_MISMATCH" });
      throw new Rejection(403, "PAYLOAD_MISMATCH");
    }
    return grant;
  }

  async function refreshGrant(instance: Instance, claims: Record<string, unknown>, handle: string): Promise<Response> {
    if (!limits.token.allow(`token:${instance.id}`)) throw new Rejection(429, "RATE_LIMITED");
    // The instance signs refresh requests with the profile's full scope list.
    const { profile, profileScopes } = requestedProfile(claims);
    const grant = boundGrant(instance, claims, handle);
    if (!grant) throw new Rejection(409, "PROVIDER_OPERATION_FAILED");
    let tokens: ProviderTokens;
    try {
      tokens = await google!.refresh(box.open(grant.sealedProviderRefreshToken, `grant:${grant.handleHash}`));
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : "transient";
      if (kind === "invalid_grant") store.mutate((state) => { delete state.grants[grant.handleHash]; });
      record({ event: "token.refresh_failed", instanceId: instance.id, companyId: grant.companyId, subject: grant.subject, provider: "google", profile, outcome: "failed", code: kind });
      throw new Rejection(kind === "transient" ? 502 : 409, "PROVIDER_OPERATION_FAILED");
    }
    const scopes = tokens.scopes ? grant.scopes.filter((scope) => tokens.scopes!.includes(scope)) : grant.scopes;
    if (profile === "workspace.all" ? scopes.length === 0 : !sameSet(scopes, profileScopes)) {
      store.mutate((state) => { delete state.grants[grant.handleHash]; });
      record({ event: "token.refresh_failed", instanceId: instance.id, companyId: grant.companyId, subject: grant.subject, provider: "google", profile, outcome: "failed", code: "SCOPE_NOT_GRANTED" });
      throw new Rejection(409, "PROVIDER_OPERATION_FAILED");
    }
    const stillGranted = store.mutate((state) => {
      const current = state.grants[grant.handleHash];
      if (!current) return false;
      current.lastRefreshedAt = now();
      current.scopes = scopes;
      if (tokens.refreshToken) current.sealedProviderRefreshToken = box.seal(tokens.refreshToken, `grant:${grant.handleHash}`);
      return true;
    });
    // A revoke that completed while Google was answering wins.
    if (!stillGranted) throw new Rejection(409, "PROVIDER_OPERATION_FAILED");
    record({ event: "token.refreshed", instanceId: instance.id, companyId: grant.companyId, subject: grant.subject, provider: "google", profile, outcome: "ok" });
    return json(200, {
      sealed: sealCredentials({
        instance,
        purpose: "access",
        profile,
        aadScopes: profileScopes,
        subject: grant.subject,
        companyId: grant.companyId,
        accessToken: tokens.accessToken,
        tokenType: tokens.tokenType,
        accessTokenExpiresAt: expiry(tokens),
        refreshToken: handle,
        scopes,
      }),
    });
  }

  async function revokeGrant(instance: Instance, claims: Record<string, unknown>, handle: string): Promise<Response> {
    if (!limits.token.allow(`token:${instance.id}`)) throw new Rejection(429, "RATE_LIMITED");
    const grant = boundGrant(instance, claims, handle);
    if (grant) {
      // Destroy the only copy of Google's refresh token. Google's revocation
      // endpoint is not called: it removes this OAuth client's access for the
      // whole Google account, which would also disconnect the user's other
      // profiles (the instance makes the same choice for per-profile removal).
      store.mutate((state) => { delete state.grants[grant.handleHash]; });
      record({ event: "grant.revoked", instanceId: instance.id, companyId: grant.companyId, subject: grant.subject, provider: "google", profile: grant.profile, outcome: "ok", code: "LOCAL_ONLY" });
    }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }

  // ---- Router -----------------------------------------------------------

  async function handle(request: Request, meta: RequestMeta): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === "/healthz") return json(200, { ok: true });
      if (request.method === "POST" && path === "/v1/connector/enrollments") return await requestEnrollment(request, meta);
      if (request.method === "POST" && path === "/v1/connector/enrollment-claims") return await completeEnrollment(request);
      if (path === "/connections/enroll") {
        if (request.method === "GET") return enrollmentPage(url);
        if (request.method === "POST") return await decideEnrollment(request, meta);
      }
      if (path === "/connections/confirm") {
        if (request.method === "GET") return confirmationPage(url);
        if (request.method === "POST") return await confirmSession(request, meta);
      }
      if (request.method === "GET" && path === GOOGLE_CALLBACK_PATH) return await googleCallback(url, meta);
      const operation = OPERATION_PATHS[path];
      if (request.method === "POST" && operation) return await instanceOperation(request, path, operation);
      // Webhook bindings, event leases and GitHub/Slack/Asana apps are not offered by this broker.
      return json(404, { error: "INVALID_REQUEST" });
    } catch (error) {
      if (error instanceof Rejection) {
        if (error.status !== 404) record({ event: "request.rejected", outcome: "rejected", code: error.code });
        return rejection(error);
      }
      record({ event: "request.rejected", outcome: "failed", code: "INTERNAL_ERROR" });
      return json(500, { error: "PROVIDER_OPERATION_FAILED" });
    }
  }

  return { handle };
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && right.every((value) => left.includes(value));
}
