import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { sha256 } from "./crypto.js";

/**
 * Audit receipts carry identifiers and outcomes only. Tokens, codes, return
 * states and raw user subjects are never recorded; subjects are hashed so an
 * operator can correlate events without learning account identities.
 */
export type AuditEvent = {
  event:
    | "enrollment.requested" | "enrollment.approved" | "enrollment.denied" | "enrollment.completed"
    | "session.created" | "session.cancelled" | "authorization.completed" | "authorization.failed"
    | "claim.redeemed" | "token.refreshed" | "token.refresh_failed" | "grant.revoked"
    | "request.rejected";
  instanceId?: string;
  companyId?: string;
  subject?: string;
  provider?: string;
  profile?: string;
  outcome: "ok" | "rejected" | "failed";
  code?: string;
};

export type AuditRecord = Omit<AuditEvent, "subject"> & { at: string; subjectHash?: string };

export interface AuditSink {
  record(event: AuditEvent): void;
}

export function toAuditRecord(event: AuditEvent, now: Date): AuditRecord {
  const { subject, ...rest } = event;
  return { at: now.toISOString(), ...rest, ...(subject ? { subjectHash: sha256(`subject:${subject}`).slice(0, 16) } : {}) };
}

export class MemoryAuditSink implements AuditSink {
  readonly records: AuditRecord[] = [];
  constructor(private readonly now: () => Date = () => new Date()) {}
  record(event: AuditEvent): void {
    this.records.push(toAuditRecord(event, this.now()));
  }
}

/** Append-only JSON Lines file in the broker data directory. */
export class FileAuditSink implements AuditSink {
  readonly #file: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.#file = path.join(dataDir, "audit.jsonl");
  }
  record(event: AuditEvent): void {
    appendFileSync(this.#file, `${JSON.stringify(toAuditRecord(event, new Date()))}\n`, { mode: 0o600 });
  }
}
