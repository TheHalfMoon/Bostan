import type { CloudConnectorEnrollmentStatus } from "@/api/tools";

/** Mirror the server's explicit Bostan-broker policy at the navigation boundary. */
export function hasBostanConnectorBroker(
  status: CloudConnectorEnrollmentStatus | null | undefined,
): boolean {
  const raw = status?.brokerBaseUrl?.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return url.protocol === "https:" &&
      url.pathname === "/" && !url.username && !url.password &&
      !url.search && !url.hash && !url.port &&
      !!host &&
      !["localhost", "127.0.0.1", "[::1]", "paperclip.app", "paperclip.ing"].includes(host) &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".paperclip.app") &&
      !host.endsWith(".paperclip.ing");
  } catch {
    return false;
  }
}

/** A pending enrollment may navigate only to the approved exact-origin broker flow. */
export function bostanConnectorEnrollmentUrl(
  status: CloudConnectorEnrollmentStatus | null | undefined,
): string | null {
  if (status?.status !== "pending" || !hasBostanConnectorBroker(status)) return null;
  if (!status.verificationUrl || status.verificationUrl.length > 2048) return null;
  try {
    const base = new URL(status.brokerBaseUrl);
    const target = new URL(status.verificationUrl);
    if (target.origin !== base.origin || target.pathname !== "/connections/enroll" ||
        target.username || target.password || target.hash ||
        target.searchParams.size !== 1 || !target.searchParams.has("id")) return null;
    const id = target.searchParams.get("id");
    if (!id || id.length > 256 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    return target.href;
  } catch {
    return null;
  }
}
