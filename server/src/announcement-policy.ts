/**
 * No inherited cloud announcement polling by default.
 * The operator must enable it with Bostan-specific settings and an HTTPS URL.
 */
export function resolveBostanAnnouncementPolicy(
  env: NodeJS.ProcessEnv = process.env,
): { enabled: boolean; feedUrl: string } {
  const disabled = { enabled: false, feedUrl: "" };
  if (env.BOSTAN_ANNOUNCEMENTS_ENABLED !== "1") return disabled;
  const configured = env.BOSTAN_ANNOUNCEMENTS_FEED_URL?.trim();
  if (!configured) return disabled;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password) return disabled;
    return { enabled: true, feedUrl: url.toString() };
  } catch {
    return disabled;
  }
}
