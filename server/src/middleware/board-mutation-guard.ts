import type { Request, RequestHandler } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

function parseOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Browsers serialize Origin as a bare HTTP(S) scheme + authority.
 * URL() is intentionally permissive: it accepts URLs with paths, query strings,
 * fragments, username/password, and normalizes unusual spellings. None of
 * those are valid serialized browser Origin headers.
 *
 * Referer and PAPERCLIP_PUBLIC_URL are full URLs and continue to use parseOrigin.
 */
function parseBrowserOriginHeader(value: string | undefined): string | null {
  if (!value || /[\r\n]/.test(value)) return null;
  const candidate = value.trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    // Canonical Origin has no slash, path, query, fragment, credentials,
    // explicit default port or normalized alternate authority syntax.
    if (candidate.toLowerCase() !== url.origin.toLowerCase()) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resolve the host used for same-origin checks without letting a direct client
 * promote its own X-Forwarded-Host value into the trusted-origin set. Express
 * compiles the operator's TRUST_PROXY setting into `trust proxy fn`; only a
 * trusted immediate peer may supply the forwarded host.
 */
function requestHost(req: Request): string | undefined {
  const host = req.header("host")?.trim();
  const remoteAddress = req.socket?.remoteAddress;
  const trustProxy = req.app?.get("trust proxy fn") as
    | ((address: string, hop: number) => boolean)
    | undefined;

  if (
    remoteAddress
    && typeof trustProxy === "function"
    && trustProxy(remoteAddress, 0)
  ) {
    return req.header("x-forwarded-host")?.split(",")[0]?.trim() || host;
  }

  return host;
}

function trustedOriginsForRequest(req: Request) {
  const origins = new Set(DEFAULT_DEV_ORIGINS.map((value) => value.toLowerCase()));
  const host = requestHost(req);
  // Host alone is not a same-origin identity. An HTTPS request must not
  // automatically trust an HTTP Origin for the same host (or vice versa).
  // Express derives req.protocol from the actual socket, or from a forwarded
  // protocol ONLY when the immediate proxy is trusted by its configuration.
  const protocol = req.protocol;
  if (host && (protocol === "http" || protocol === "https")) {
    origins.add(`${protocol}://${host}`.toLowerCase());
  }
  // Behind some reverse proxies the Host / X-Forwarded-Host header may
  // not match the public URL (for example when TLS terminates at the
  // edge and the inbound Host is an internal service name). Trust the
  // explicitly-configured PAPERCLIP_PUBLIC_URL when it's set.
  const publicUrl = parseOrigin(process.env.PAPERCLIP_PUBLIC_URL?.trim());
  if (publicUrl) origins.add(publicUrl);
  return origins;
}

/**
 * Return the browser origin only when it is the same origin Paperclip's CSRF
 * guard accepts for this request. Callers may use this as browser-reachability
 * evidence, but must still apply any protocol-specific constraints (for
 * example OAuth requiring HTTPS outside loopback).
 */
export function trustedBoardMutationOrigin(req: Request): string | null {
  const allowedOrigins = trustedOriginsForRequest(req);
  const originHeader = req.header("origin");
  if (originHeader !== undefined) {
    // A browser supplies Origin for mutating requests. A hostile, opaque or
    // malformed Origin must never be overruled by a seemingly trusted Referer.
    // Referer is a fallback ONLY for clients that omit Origin entirely.
    const origin = parseBrowserOriginHeader(originHeader);
    return origin && allowedOrigins.has(origin) ? origin : null;
  }

  const refererOrigin = parseOrigin(req.header("referer"));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) return refererOrigin;

  return null;
}

export function boardMutationGuard(): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    if (req.actor.type !== "board") {
      next();
      return;
    }

    // Local-trusted mode, board bearer keys, trusted Cloud tenant calls, and
    // signed Cloud control assertions are not browser-session requests.
    // In these modes, origin/referer headers can be absent; do not block those mutations.
    if (
      req.actor.source === "local_implicit"
      || req.actor.source === "board_key"
      || req.actor.source === "mcp_oauth"
      || req.actor.source === "cloud_tenant"
      || req.actor.source === "cloud_control"
    ) {
      next();
      return;
    }

    if (!trustedBoardMutationOrigin(req)) {
      res.status(403).json({ error: "Board mutation requires trusted browser origin" });
      return;
    }

    next();
  };
}
