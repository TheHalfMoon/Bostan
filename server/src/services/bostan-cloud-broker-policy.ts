/**
 * Bostan does not inherit an upstream account broker or its persisted identity.
 * The owner must choose a separate backend deliberately before enrollment.
 */
export function bostanCloudBrokerOrigin(env: NodeJS.ProcessEnv): string | null {
  if (env.BOSTAN_CLOUD_CONNECTOR_ENABLED !== "1") return null;
  const raw = env.BOSTAN_CLOUD_CONNECTOR_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || !host || url.username || url.password
      || url.search || url.hash || url.pathname !== "/"
      || (url.port && url.port !== "443")) return null;
    if (host === "paperclip.app" || host.endsWith(".paperclip.app")
      || host === "paperclip.ing" || host.endsWith(".paperclip.ing")
      || host === "localhost" || host.endsWith(".localhost")
      || host === "127.0.0.1" || host === "[::1]") return null;
    return url.origin;
  } catch { return null; }
}

export function requireBostanCloudBrokerOrigin(env: NodeJS.ProcessEnv): string {
  const base = bostanCloudBrokerOrigin(env);
  if (!base) throw new Error("Bostan Cloud broker is disabled or has no valid explicit private HTTPS configuration");
  return base;
}
