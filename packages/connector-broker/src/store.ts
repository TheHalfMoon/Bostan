import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";

/**
 * Broker state. Every token, verifier and return state is stored only as a
 * SecretBox ciphertext or a SHA-256 hash; nothing here is usable without the
 * operator's master key.
 */
export type Enrollment = {
  id: string;
  instanceId: string;
  environment: string;
  origin: string;
  returnUri: string;
  sealedReturnState: string;
  label: string;
  signPublicKey: string;
  sealPublicKey: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved";
  approvalCodeHash?: string;
};

export type Instance = {
  id: string;
  environment: string;
  origins: string[];
  label: string;
  signPublicKey: string;
  sealPublicKey: string;
  status: "active" | "suspended";
  enrolledAt: number;
};

export type Session = {
  id: string;
  instanceId: string;
  companyId: string;
  subject: string;
  provider: "google";
  profile: string;
  scopes: string[];
  returnUri: string;
  sealedReturnState: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "authorizing" | "completed";
  oauthStateHash?: string;
  sealedCodeVerifier?: string;
};

export type Claim = {
  id: string;
  instanceId: string;
  companyId: string;
  subject: string;
  provider: "google";
  profile: string;
  requestedScopes: string[];
  redemptionIdHash: string;
  sealedCredentials: string;
  expiresAt: number;
  redemptions: number;
};

export type Grant = {
  handleHash: string;
  instanceId: string;
  companyId: string;
  subject: string;
  provider: "google";
  profile: string;
  scopes: string[];
  sealedProviderRefreshToken: string;
  createdAt: number;
  lastRefreshedAt: number | null;
  /** Set until the instance redeems the claim; an unredeemed grant expires with its claim. */
  pendingClaimId?: string;
};

export type BrokerState = {
  version: 1;
  enrollments: Record<string, Enrollment>;
  instances: Record<string, Instance>;
  sessions: Record<string, Session>;
  claims: Record<string, Claim>;
  grants: Record<string, Grant>;
  /** Accepted request ids (jti) with their expiry, to reject replays. */
  replay: Record<string, number>;
};

export interface BrokerStore {
  read(): BrokerState;
  /** Applies a mutation and persists it before returning. */
  mutate<T>(fn: (state: BrokerState) => T): T;
}

export function emptyState(): BrokerState {
  return { version: 1, enrollments: {}, instances: {}, sessions: {}, claims: {}, grants: {}, replay: {} };
}

/** Drops records whose lifetime has ended. Instances and grants have no expiry. */
export function pruneExpired(state: BrokerState, nowMs: number): void {
  for (const [id, record] of Object.entries(state.enrollments)) if (record.expiresAt <= nowMs) delete state.enrollments[id];
  for (const [id, record] of Object.entries(state.sessions)) if (record.expiresAt <= nowMs) delete state.sessions[id];
  for (const [id, record] of Object.entries(state.claims)) if (record.expiresAt <= nowMs) delete state.claims[id];
  for (const [jti, expiresAt] of Object.entries(state.replay)) if (expiresAt * 1000 <= nowMs) delete state.replay[jti];
  for (const [id, grant] of Object.entries(state.grants)) if (grant.pendingClaimId && !state.claims[grant.pendingClaimId]) delete state.grants[id];
}

export class MemoryStore implements BrokerStore {
  protected state: BrokerState;

  constructor(initial: BrokerState = emptyState()) {
    this.state = structuredClone(initial);
  }

  read(): BrokerState {
    return this.state;
  }

  mutate<T>(fn: (state: BrokerState) => T): T {
    const draft = structuredClone(this.state);
    const result = fn(draft);
    this.commit(draft);
    this.state = draft;
    return result;
  }

  protected commit(_state: BrokerState): void {}
}

/**
 * Single-process JSON store. Writes go to a temporary file that is renamed
 * over the previous state, so a crash leaves either the old or the new state.
 */
export class FileStore extends MemoryStore {
  readonly #file: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const file = path.join(dataDir, "broker-state.json");
    super(existsSync(file) ? parseState(readFileSync(file, "utf8")) : emptyState());
    this.#file = file;
  }

  protected override commit(state: BrokerState): void {
    const temporary = `${this.#file}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, this.#file);
    if (process.platform !== "win32") chmodSync(this.#file, 0o600);
  }
}

function parseState(text: string): BrokerState {
  const parsed = JSON.parse(text) as Partial<BrokerState>;
  if (parsed.version !== 1) throw new Error("Unsupported broker state version");
  return { ...emptyState(), ...parsed } as BrokerState;
}
