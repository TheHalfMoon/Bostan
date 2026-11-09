import { readFileSync, statSync } from "node:fs";
import { GOOGLE_WORKSPACE_CONNECTOR_PROFILE_IDS, type GoogleWorkspaceConnectorProfileId } from "@bostan/shared";

export type BrokerEnvironment = "development" | "test" | "staging" | "production";

export type BrokerConfig = {
  /** Exact origin instances configure as BOSTAN_CLOUD_CONNECTOR_BASE_URL. */
  publicOrigin: string;
  environment: BrokerEnvironment;
  listenHost: string;
  listenPort: number;
  dataDir: string;
  masterKey: Buffer;
  operatorToken: string;
  /** Use the first X-Forwarded-For hop for rate limits (only behind a trusted proxy). */
  trustProxy: boolean;
  /** When set, only these instance origins may request enrollment. */
  allowedInstanceOrigins: readonly string[] | null;
  google: {
    clientId: string;
    clientSecret: string;
    profiles: readonly GoogleWorkspaceConnectorProfileId[];
  } | null;
};

export class BrokerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrokerConfigError";
  }
}

type ReadSecretFile = (path: string) => string;

const ENVIRONMENTS = new Set<BrokerEnvironment>(["development", "test", "staging", "production"]);
const DONOR_HOST = /(^|\.)paperclip\.(app|ing)$/i;

export function loadBrokerConfig(
  env: NodeJS.ProcessEnv = process.env,
  readSecretFile: ReadSecretFile = defaultReadSecretFile,
): BrokerConfig {
  const publicOrigin = parsePublicOrigin(required(env, "BOSTAN_BROKER_PUBLIC_ORIGIN"));
  const environment = required(env, "BOSTAN_BROKER_ENVIRONMENT") as BrokerEnvironment;
  if (!ENVIRONMENTS.has(environment)) {
    throw new BrokerConfigError("BOSTAN_BROKER_ENVIRONMENT must be development, test, staging or production");
  }
  const listenPort = Number(env.BOSTAN_BROKER_LISTEN_PORT ?? "8787");
  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65_535) {
    throw new BrokerConfigError("BOSTAN_BROKER_LISTEN_PORT must be a TCP port");
  }
  const masterKey = Buffer.from(readSecretFile(required(env, "BOSTAN_BROKER_MASTER_KEY_FILE")).trim(), "base64url");
  if (masterKey.length !== 32) throw new BrokerConfigError("The broker master key file must hold 32 random bytes (base64url)");
  const operatorToken = readSecretFile(required(env, "BOSTAN_BROKER_OPERATOR_TOKEN_FILE")).trim();
  if (operatorToken.length < 32) throw new BrokerConfigError("The broker operator token must be at least 32 characters");

  const googleClientId = env.BOSTAN_BROKER_GOOGLE_CLIENT_ID?.trim();
  const googleSecretFile = env.BOSTAN_BROKER_GOOGLE_CLIENT_SECRET_FILE?.trim();
  if (Boolean(googleClientId) !== Boolean(googleSecretFile)) {
    throw new BrokerConfigError("Set both BOSTAN_BROKER_GOOGLE_CLIENT_ID and BOSTAN_BROKER_GOOGLE_CLIENT_SECRET_FILE, or neither");
  }
  const google = googleClientId && googleSecretFile
    ? {
      clientId: googleClientId,
      clientSecret: readSecretFile(googleSecretFile).trim(),
      profiles: parseGoogleProfiles(env.BOSTAN_BROKER_GOOGLE_PROFILES),
    }
    : null;
  if (google && !google.clientSecret) throw new BrokerConfigError("The Google client secret file is empty");

  return {
    publicOrigin,
    environment,
    listenHost: env.BOSTAN_BROKER_LISTEN_HOST?.trim() || "127.0.0.1",
    listenPort,
    dataDir: required(env, "BOSTAN_BROKER_DATA_DIR"),
    masterKey,
    operatorToken,
    trustProxy: env.BOSTAN_BROKER_TRUST_PROXY === "1",
    allowedInstanceOrigins: parseOriginList(env.BOSTAN_BROKER_ALLOWED_INSTANCE_ORIGINS),
    google,
  };
}

/** Matches the instance-side admission policy: an exact HTTPS origin, never a donor host. */
export function parsePublicOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BrokerConfigError("BOSTAN_BROKER_PUBLIC_ORIGIN must be an https:// origin");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
    || (url.pathname !== "/" && url.pathname !== "") || url.port) {
    throw new BrokerConfigError("BOSTAN_BROKER_PUBLIC_ORIGIN must be an exact https:// origin on port 443");
  }
  if (DONOR_HOST.test(url.hostname)) throw new BrokerConfigError("BOSTAN_BROKER_PUBLIC_ORIGIN must not be a Paperclip host");
  return url.origin;
}

/** Instance origins are browser return targets: HTTPS, or HTTP on loopback for local installs. */
export function normalizeInstanceOrigin(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== value || url.username || url.password) return null;
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && isLoopbackHost(url.hostname)) return url.origin;
  return null;
}

export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function parseGoogleProfiles(value: string | undefined): GoogleWorkspaceConnectorProfileId[] {
  if (!value?.trim()) return [...GOOGLE_WORKSPACE_CONNECTOR_PROFILE_IDS];
  const known = new Set<string>(GOOGLE_WORKSPACE_CONNECTOR_PROFILE_IDS);
  const profiles = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  const unknown = profiles.filter((profile) => !known.has(profile));
  if (unknown.length > 0) throw new BrokerConfigError(`Unknown Google profiles: ${unknown.join(", ")}`);
  return profiles as GoogleWorkspaceConnectorProfileId[];
}

function parseOriginList(value: string | undefined): string[] | null {
  if (!value?.trim()) return null;
  return value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    const origin = normalizeInstanceOrigin(item);
    if (!origin) throw new BrokerConfigError(`Invalid allowed instance origin: ${item}`);
    return origin;
  });
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new BrokerConfigError(`${name} is required`);
  return value;
}

function defaultReadSecretFile(path: string): string {
  if (process.platform !== "win32" && (statSync(path).mode & 0o077) !== 0) {
    throw new BrokerConfigError(`Secret file ${path} must not be readable by group or others (chmod 600)`);
  }
  return readFileSync(path, "utf8");
}
