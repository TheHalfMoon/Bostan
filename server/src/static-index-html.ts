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
export function setBostanStaticHtmlPrivacyHeaders(res: Response): void {
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
}
