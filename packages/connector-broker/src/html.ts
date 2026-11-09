/** Minimal server-rendered pages. All interpolated values pass through `escapeHtml`. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function pageSecurityHeaders(formTargets: readonly string[] = []): Record<string, string> {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      // Browsers apply form-action to the redirect that follows a POST.
      `form-action 'self'${formTargets.map((target) => ` ${target}`).join("")}`,
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ].join("; "),
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

export function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1d1d1f;background:#fff}
h1{font-size:1.4rem}dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem 1rem}dt{font-weight:600}
dd{margin:0;overflow-wrap:anywhere}ul{padding-left:1.2rem}code{font-size:.9em}
button{font:inherit;padding:.5rem 1rem;margin-right:.5rem;border-radius:6px;border:1px solid #888;background:#f5f5f7;cursor:pointer}
button.primary{background:#1d5c3f;color:#fff;border-color:#1d5c3f}input{font:inherit;padding:.4rem;width:100%;box-sizing:border-box}
@media (prefers-color-scheme:dark){body{background:#121212;color:#eee}button{background:#2a2a2a;color:#eee}}
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}
