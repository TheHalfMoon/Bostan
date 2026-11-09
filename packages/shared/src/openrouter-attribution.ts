/**
 * Public product identity only: never include company, user, run, or credential data.
 * Bostan has no public site, so no HTTP-Referer is sent; harness-supplied referers are
 * still stripped (see OPENROUTER_REPLACED_ATTRIBUTION_HEADERS).
 */
export const OPENROUTER_ATTRIBUTION_HEADERS = Object.freeze({
  "X-Title": "Bostan",
  "X-OpenRouter-Title": "Bostan",
  "X-OpenRouter-Categories": "cloud-agent,programming-app",
});

/** Lower-case attribution header names removed from caller headers before Bostan's are applied. */
export const OPENROUTER_REPLACED_ATTRIBUTION_HEADERS: ReadonlySet<string> = new Set([
  "http-referer",
  ...Object.keys(OPENROUTER_ATTRIBUTION_HEADERS).map(key => key.toLowerCase()),
]);

export function isOpenRouterUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["openrouter.ai", "eu.openrouter.ai", "us.openrouter.ai"].includes(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Replace attribution case-insensitively while preserving authentication and routing. */
export function openRouterAttributionHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...Object.fromEntries(Object.entries(headers).filter(([key]) => !OPENROUTER_REPLACED_ATTRIBUTION_HEADERS.has(key.toLowerCase()))),
    ...OPENROUTER_ATTRIBUTION_HEADERS,
  };
}

export function openRouterClaudeHeaders(existing = ""): string {
  const headers: Record<string, string> = {};
  for (const line of existing.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return Object.entries(openRouterAttributionHeaders(headers)).map(([name, value]) => `${name}: ${value}`).join("\n");
}

export function openRouterCodexHeaders(): string {
  return `http_headers = { ${Object.entries(OPENROUTER_ATTRIBUTION_HEADERS).map(([key, value]) => `${JSON.stringify(key)} = ${JSON.stringify(value)}`).join(", ")} }\n`;
}
