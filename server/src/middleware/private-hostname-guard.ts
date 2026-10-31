import type { Request, RequestHandler } from "express";

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
  if (typeof value !== "string") return null;
  const authority = value.trim();
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
    // URL.hostname keeps IPv6 brackets; the allow-set uses bare ::1.
    return hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  } catch {
    // An invalid Host must be refused, never interpreted as an allowed name.
    return null;
  }
}

function extractHostname(req: Request): string | null {
  // X-Forwarded-Host is client-supplied without independently verified proxy
  // ancestry. Even when Express TRUST_PROXY is enabled it must not override
  // the actual Host authority at this private network admission boundary.
  // A trusted reverse proxy must preserve Host or use an explicitly allowed
  // backend hostname; it must not make a forged forwarded value authoritative.
  return parsePrivateHostHeader(req.header("host"));
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

  if (bindHost && bindHost !== "0.0.0.0") {
    allowSet.add(bindHost);
  }
  allowSet.add("localhost");
  allowSet.add("127.0.0.1");
  allowSet.add("::1");
  return allowSet;
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
    const hostname = extractHostname(req);
    const wantsJson = req.path.startsWith("/api") || req.accepts(["json", "html", "text"]) === "json";

    if (!hostname) {
      const error = "Missing Host header. To allow a hostname, configure BOSTAN_ALLOWED_HOSTNAMES=<host> for the Bostan server and restart.";
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
