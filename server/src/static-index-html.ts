import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import { applyUiBranding } from "./ui-branding.js";

export function readBrandedStaticIndexHtml(uiDist: string): string {
  return applyUiBranding(fs.readFileSync(path.join(uiDist, "index.html"), "utf-8"));
}


// The static SPA includes OAuth handoff and provider-connection routes.
// An untrusted navigation or outgoing provider link must never receive a
// callback query (code/state/credential) through the Referer header.
// Keep document caching behavior in the route, not in this privacy helper.
export function setBostanStaticHtmlPrivacyHeaders(res: Response, html?: string): void {
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
  // Report-only first (#30): measure what a strict policy would block before
  // enforcing it. Violations appear in the browser console; nothing is sent.
  if (html !== undefined) res.set("Content-Security-Policy-Report-Only", bostanDocumentContentSecurityPolicy(html));
}

/**
 * Content Security Policy for the SPA document. Inline <script> blocks in the
 * served HTML are allowed by hash, so the policy matches the exact document.
 * img-src admits https: because cross-origin markdown images load only after
 * an explicit click (MarkdownBody); everything else stays same-origin.
 */
export function bostanDocumentContentSecurityPolicy(html: string): string {
  const inlineScriptHashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => `'sha256-${createHash("sha256").update(match[1] ?? "", "utf8").digest("base64")}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}
