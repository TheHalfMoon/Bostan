import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";

/** Wire constants shared with server/src/services/paperclip-cloud-connector.ts. */
export const JWS_TYP = "paperclip-cloud-connector-request+jwt";
export const SEAL_ALGORITHM = "X25519-HKDF-SHA256-A256GCM";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");
const AES_TAG_BYTES = 16;
const MAX_JWS_LENGTH = 8_192;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export type SealPurpose = "initial" | "access";

export type SealedEnvelope = {
  v: 1;
  alg: typeof SEAL_ALGORITHM;
  purpose: SealPurpose;
  provider: string;
  profile: string;
  epk: string;
  iv: string;
  ct: string;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time comparison that does not leak the length of either value. */
export function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

/** Accepts a raw 32-byte base64url public key, as instances send at enrollment. */
export function rawPublicKey(value: unknown, curve: "ed25519" | "x25519"): KeyObject | null {
  if (typeof value !== "string" || !BASE64URL.test(value)) return null;
  const raw = Buffer.from(value, "base64url");
  if (raw.length !== 32) return null;
  try {
    return createPublicKey({
      key: Buffer.concat([curve === "ed25519" ? ED25519_SPKI_PREFIX : X25519_SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }
}

export type DecodedJws = {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
};

/** Structural decode only. Callers must verify the signature before trusting claims. */
export function decodeJws(token: unknown): DecodedJws | null {
  if (typeof token !== "string" || token.length > MAX_JWS_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => part.length > 0 && BASE64URL.test(part))) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as unknown;
    const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as unknown;
    if (!isRecord(header) || !isRecord(claims)) return null;
    return { header, claims, signingInput: `${parts[0]}.${parts[1]}`, signature: Buffer.from(parts[2]!, "base64url") };
  } catch {
    return null;
  }
}

export function verifyJwsSignature(jws: DecodedJws, publicKey: KeyObject): boolean {
  try {
    return verify(null, Buffer.from(jws.signingInput, "utf8"), publicKey, jws.signature);
  } catch {
    return false;
  }
}

/**
 * Seal credentials to an enrolled instance's X25519 key. The AAD and HKDF
 * derivation mirror the instance's `decryptEnvelope`, including the hashed
 * HKDF info for Google's combined `workspace.all` profile.
 */
export function sealToInstance(input: {
  recipientPublicKey: string;
  purpose: SealPurpose;
  instanceId: string;
  environment: string;
  provider: string;
  profile: string;
  aadScopes: readonly string[];
  plaintext: unknown;
}): SealedEnvelope {
  const recipient = rawPublicKey(input.recipientPublicKey, "x25519");
  if (!recipient) throw new Error("Invalid instance sealing key");
  const ephemeral = generateKeyPairSync("x25519");
  const ephemeralRaw = Buffer.from((ephemeral.publicKey.export({ format: "jwk" }) as { x: string }).x, "base64url");
  const recipientRaw = Buffer.from(input.recipientPublicKey, "base64url");
  const aad = Buffer.from([
    1,
    SEAL_ALGORITHM,
    input.purpose,
    input.instanceId,
    input.environment,
    input.provider,
    input.profile,
    [...input.aadScopes].sort().join(" "),
  ].join("\n"), "utf8");
  const info = input.provider === "google" && input.profile === "workspace.all"
    ? createHash("sha256").update(aad).digest()
    : aad;
  const key = Buffer.from(hkdfSync(
    "sha256",
    diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient }),
    Buffer.concat([ephemeralRaw, recipientRaw]),
    info,
    32,
  ));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AES_TAG_BYTES });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(input.plaintext), "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    v: 1,
    alg: SEAL_ALGORITHM,
    purpose: input.purpose,
    provider: input.provider,
    profile: input.profile,
    epk: ephemeralRaw.toString("base64url"),
    iv: iv.toString("base64url"),
    ct: ciphertext.toString("base64url"),
  };
}

/** AES-256-GCM encryption for secrets at rest, bound to the record they belong to. */
export class SecretBox {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error("Broker master key must be 32 bytes");
    this.#key = Buffer.from(key);
  }

  seal(plaintext: string, binding: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv, { authTagLength: AES_TAG_BYTES });
    cipher.setAAD(Buffer.from(binding, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
    return `v1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}`;
  }

  open(sealed: string, binding: string): string {
    const [version, iv, ciphertext] = sealed.split(".");
    if (version !== "v1" || !iv || !ciphertext) throw new Error("Unsupported sealed secret");
    const combined = Buffer.from(ciphertext, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.#key, Buffer.from(iv, "base64url"), { authTagLength: AES_TAG_BYTES });
    decipher.setAAD(Buffer.from(binding, "utf8"));
    decipher.setAuthTag(combined.subarray(-AES_TAG_BYTES));
    return Buffer.concat([decipher.update(combined.subarray(0, -AES_TAG_BYTES)), decipher.final()]).toString("utf8");
  }
}

/** RFC 7636 S256 code challenge. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
