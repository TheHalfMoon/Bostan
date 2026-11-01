import type { Request, RequestHandler } from "express";
import type { IncomingMessage } from "node:http";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

/**
 * A private-mode Host is an HTTP authority, not an arbitrary URL. WHATWG URL
 * will quietly normalize userinfo, paths, percent escapes and backslashes:
 * accepting those spellings could turn an unauthorized Host into localhost.
 */
export function parsePrivateHostHeader(value: string | undefined): string | null {
  // Host is an ASCII HTTP authority. Node preserves Latin-1 obs-text (for
  // example 0xA0 NBSP) in rawHeaders; trimming it would turn an untrusted
  // authority into an allowed localhost spelling.
  if (typeof value !== "string" || /[^\x21-\x7e]/.test(value)) return null;
  const authority = value;
  if (!authority || /[\x00-\x20\x7f@\\/?#%]/.test(authority)) return null;

  // Brackets are mandatory for IPv6 literals; ports must be canonical and
  // positive. Reject URL default-port folding and invalid suffixes up front.
  const match = /^(\[[0-9a-fA-F:.]+\]|[^\[\]:]+)(?::([0-9]+))?$/.exec(authority);
  if (!match) return null;
  const port = match[2];
  if (port !== undefined && (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535)) {
    return null;
  }

  try {
    const parsed = new URL(`http://${authority}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return null;
    }
    const hostname = parsed.hostname.toLowerCase();
    // WHATWG URL also rewrites legacy numeric IPv4 spellings (127.1,
    // 0177.0.0.1, 0x7f000001, 2130706433) and trailing-dot IPv4 into
    // 127.0.0.1. A caller-controlled Host must not become loopback by
    // normalization. Preserve valid bracketed IPv6 address compression.
    if (!match[1].startsWith("[") && hostname !== match[1].toLowerCase()) {
      return null;
    }
    // URL.hostname keeps IPv6 brackets; the allow-set uses bare ::1.
    return hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  } catch {
    // An invalid Host must be refused, never interpreted as an allowed name.
    return null;
  }
}

function extractHostname(req: Pick<IncomingMessage, "rawHeaders">): string | null {
  // Node's req.headers / Express req.header() silently retain only the first
  // Host when a raw HTTP/1.1 request repeats that field. A second, conflicting
  // authority may be interpreted differently by a proxy or another consumer.
  // Admit exactly one raw Host field; reject duplicates even if identical.
  // Never use unverified X-Forwarded-Host as a fallback or override.
  const rawHeaders = req.rawHeaders;
  if (!Array.isArray(rawHeaders) || rawHeaders.length % 2 !== 0) return null;
  let authority: string | undefined;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i];
    const value = rawHeaders[i + 1];
    if (typeof name !== "string" || typeof value !== "string") return null;
    if (name.toLowerCase() !== "host") continue;
    if (authority !== undefined) return null;
    authority = value;
  }
  return parsePrivateHostHeader(authority);
}

function normalizeAllowedHostnames(values: string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

export function resolvePrivateHostnameAllowSet(opts: { allowedHostnames: string[]; bindHost: string }): Set<string> {
  const configuredAllow = normalizeAllowedHostnames(opts.allowedHostnames);
  const bindHost = opts.bindHost.trim().toLowerCase();
  const allowSet = new Set<string>(configuredAllow);

  // IPv4 and IPv6 unspecified addresses bind every interface; neither is
  // an implicit client-facing Host authority in private mode.
  if (bindHost && bindHost !== "0.0.0.0" && bindHost !== "::") {
    allowSet.add(bindHost);
  }
  allowSet.add("localhost");
  allowSet.add("127.0.0.1");
  allowSet.add("::1");
  return allowSet;
}

/**
 * Browsers always send Origin on WebSocket handshakes. A private Host alone
 * does not stop cross-site WebSocket hijacking: hostile JavaScript can open a
 * ws://localhost socket and the browser supplies a valid localhost Host.
 *
 * Admit an absent Origin for native clients, but fail closed on any present
 * malformed, duplicate, opaque or foreign browser Origin. A different port
 * on the same hostname is allowed for local development; localhost, ::1 and
 * 127.0.0.1 are equivalent loopback identities. This is browser-origin
 * defense, not authentication of nonbrowser clients (which can forge Origin).
 */
function isPrivateUpgradeOriginAllowed(
  req: Pick<IncomingMessage, "rawHeaders">,
  requestHostname: string,
): boolean {
  let origin: string | undefined;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i]?.toLowerCase() !== "origin") continue;
    if (origin !== undefined) return false;
    origin = req.rawHeaders[i + 1];
  }
  if (origin === undefined) return true;
  // Browser Origin is serialized as scheme://authority, without path,
  // userinfo, query or fragment. Reuse strict Host parsing to avoid WHATWG
  // URL normalization of numeric IPv4 aliases into loopback.
  const match = /^https?:\/\/([^/?#]+)$/.exec(origin);
  if (!match) return false;
  const originHostname = parsePrivateHostHeader(match[1]);
  if (!originHostname) return false;
  return originHostname === requestHostname
    || (isLoopbackHostname(originHostname) && isLoopbackHostname(requestHostname));
}

/**
 * HTTP upgrade events bypass Express middleware entirely. Admit private-mode
 * WebSocket handshakes using the same raw Host and origin-form checks as HTTP,
 * before any listener can authenticate, count work, or upgrade a socket.
 * Public mode keeps its existing behavior.
 */
export function isPrivateUpgradeHostAllowed(
  req: Pick<IncomingMessage, "rawHeaders" | "url">,
  opts: { enabled: boolean; allowedHostnames: string[]; bindHost: string },
): boolean {
  if (!opts.enabled) return true;
  if (typeof req.url !== "string" || !req.url.startsWith("/") || req.url.startsWith("//")) return false;
  const hostname = extractHostname(req);
  if (!hostname) return false;
  if (!isLoopbackHostname(hostname) && !resolvePrivateHostnameAllowSet(opts).has(hostname)) return false;
  return isPrivateUpgradeOriginAllowed(req, hostname);
}

/**
 * Node emits 'upgrade' for POST, body-framed and duplicate-Upgrade requests,
 * not only for canonical GET WebSocket handshakes. Require one unambiguous
 * WebSocket Upgrade field and no HTTP request body framing before any
 * downstream listener can authenticate or take ownership of the socket.
 *
 * Public mode intentionally preserves the existing upgrade policy.
 */
export function isPrivateUpgradeRequestAllowed(
  req: Pick<IncomingMessage, "method" | "rawHeaders" | "url">,
  opts: { enabled: boolean; allowedHostnames: string[]; bindHost: string },
): boolean {
  if (!opts.enabled) return true;
  if (req.method !== "GET") return false;
  if (!Array.isArray(req.rawHeaders) || req.rawHeaders.length % 2 !== 0) return false;

  let upgradeFields = 0;
  let connectionFields = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const name = req.rawHeaders[i];
    const value = req.rawHeaders[i + 1];
    if (typeof name !== "string" || typeof value !== "string") return false;
    const field = name.toLowerCase();
    if (field === "content-length" || field === "transfer-encoding") return false;
    if (field === "connection") {
      // Node can dispatch duplicate or contradictory Connection fields to
      // 'upgrade'; an origin server must reject that framing ambiguity before
      // any WebSocket authentication handler gets the request.
      if (++connectionFields !== 1) return false;
      const tokens = value.split(",").map((token) => token.trim().toLowerCase());
      // Preserve the standard comma-token spelling and keep-alive + Upgrade
      // while refusing unknown, empty, repeated or conflicting tokens.
      if (tokens.filter((token) => token === "upgrade").length !== 1 ||
          tokens.some((token) => token !== "upgrade" && token !== "keep-alive")) return false;
    }
    if (field === "upgrade") {
      upgradeFields += 1;
      if (upgradeFields !== 1 || value.toLowerCase() !== "websocket") return false;
    }
  }
  return connectionFields === 1 && upgradeFields === 1 && isPrivateUpgradeHostAllowed(req, opts);
}

// The hostname comes from the request Host header, so an unauthenticated
// requester controls it. Never put that value into the guidance command. An
// operator or an agent can paste the guidance into a shell, and that outer
// shell evaluates a backtick, `$( )`, or `$NAME` span in the host before any
// CLI receives argv. A direct-exec form such as `npx` does not stop the
// outer shell. Emit a static `<host>` placeholder and do not echo the raw request
// value. The operator supplies the real hostname.
const BLOCKED_HOSTNAME_MESSAGE =
  "This hostname is not allowed for this Bostan instance. " +
  "To allow a hostname, configure BOSTAN_ALLOWED_HOSTNAMES=<host> for the Bostan server and restart.";

export function privateHostnameGuard(opts: {
  enabled: boolean;
  allowedHostnames: string[];
  bindHost: string;
}): RequestHandler {
  if (!opts.enabled) {
    return (_req, _res, next) => next();
  }

  const allowSet = resolvePrivateHostnameAllowSet({
    allowedHostnames: opts.allowedHostnames,
    bindHost: opts.bindHost,
  });

  return (req, res, next) => {
    // This app is an origin server, not a forward HTTP proxy. Node accepts
    // absolute-form request targets (GET http://other-host/path HTTP/1.1),
    // and Express may route their parsed pathname even when Host is allowed.
    // Require origin-form before trusting the independently checked Host.
    const requestTarget = req.originalUrl ?? req.url;
    const validOriginForm = typeof requestTarget === "string" && requestTarget.startsWith("/") && !requestTarget.startsWith("//");
    const hostname = validOriginForm ? extractHostname(req) : null;
    const wantsJson = req.path.startsWith("/api") || req.accepts(["json", "html", "text"]) === "json";

    if (!hostname) {
      const error = validOriginForm
        ? "Missing Host header. To allow a hostname, configure BOSTAN_ALLOWED_HOSTNAMES=<host> for the Bostan server and restart."
        : "Unsupported HTTP request target for this Bostan instance.";
      if (wantsJson) {
        res.status(403).json({ error });
      } else {
        res.status(403).type("text/plain").send(error);
      }
      return;
    }

    if (isLoopbackHostname(hostname) || allowSet.has(hostname)) {
      next();
      return;
    }

    const error = BLOCKED_HOSTNAME_MESSAGE;
    if (wantsJson) {
      res.status(403).json({ error });
    } else {
      res.status(403).type("text/plain").send(error);
    }
  };
}
