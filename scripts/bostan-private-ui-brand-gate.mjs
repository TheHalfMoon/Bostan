import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const UI_BRAND_FILES = Object.freeze([
  "ui/src/pages/BoardChat.tsx",
  "ui/public/bostan-thinking.svg",
  "ui/public/paperclip-thinking.svg",
  "ui/README.md",
  "ui/index.html",
  "ui/public/site.webmanifest",
]);

/** Pure, read-only brand admission for private Bostan UI source snapshots. */
export function auditBostanUiBrandSnapshot(files) {
  const issues = [];
  for (const pathname of UI_BRAND_FILES) {
    if (typeof files?.[pathname] !== "string" || !files[pathname].trim()) {
      issues.push("Missing Bostan UI brand file: " + pathname);
    }
  }
  const board = files?.["ui/src/pages/BoardChat.tsx"];
  if (typeof board === "string" && (!board.includes('src="/bostan-thinking.svg"') ||
      board.includes('src="/paperclip-thinking.svg"'))) {
    issues.push("Board chat must load the canonical Bostan status asset");
  }
  const asset = files?.["ui/public/bostan-thinking.svg"];
  const legacy = files?.["ui/public/paperclip-thinking.svg"];
  if (typeof asset === "string" &&
      (!/<svg\b/.test(asset) || !/<path\b/.test(asset) ||
       !/aria-label="Bostan"/.test(asset) || !/prefers-reduced-motion/.test(asset) ||
       /paperclip/i.test(asset))) {
    issues.push("Canonical Bostan status asset must use Bostan identity and respect reduced motion");
  }
  if (typeof asset === "string" && typeof legacy === "string" && legacy !== asset) {
    issues.push("Legacy thinking asset must serve the same Bostan artwork");
  }
  const readme = files?.["ui/README.md"];
  if (typeof readme === "string" &&
      (!readme.includes("# @bostan/ui") || !/not release-qualified/i.test(readme) ||
        /\bPaperclip\b/.test(readme))) {
    issues.push("UI README must identify the private, unqualified Bostan package");
  }
  const index = files?.["ui/index.html"];
  if (typeof index === "string" &&
      (!/<title>Bostan<\/title>/.test(index) ||
       !/name="apple-mobile-web-app-title" content="Bostan"/.test(index))) {
    issues.push("HTML document metadata must identify Bostan");
  }
  // HTML character references are resolved by browsers before resource loading.
  // This source admission does not replace browser network qualification.
  if (typeof index === "string") {
    // Preserve comment-looking text inside quoted tag attributes; only strip actual comments.
    const html = index.replace(/(<[a-z][^>"\']*(?:"[^"]*"|\'[^\']*\'|[^>"\']*)*>)|<!--[\s\S]*?-->/gi,
      (match, tag) => tag ?? "");
    const decodeReferences = value => value
      .replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi, (match, hex, dec) => {
        const point = Number.parseInt(hex ?? dec, hex ? 16 : 10);
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
      })
      .replace(/&(?:sol|colon|tab|newline);/gi, match => ({
        "&sol;": "/", "&colon;": ":", "&tab;": "\t", "&newline;": "\n",
      })[match.toLowerCase()] ?? match);
    // Inline CSS can fetch fonts, backgrounds and imports without script/link tags.
    // This minimal shell needs no inline stylesheet; refuse both forms rather
    // than attempting to parse CSS escapes or nested url() expressions.
    const htmlTags = html.match(/<[a-z][^>"']*(?:"[^"]*"|'[^']*'|[^>"']*)*>/gi) ?? [];
    if (htmlTags.some(tag => /^<style\b/i.test(tag) || /\sstyle\s*=/i.test(tag))) {
      issues.push("HTML shell must not contain inline CSS with unreviewed network access");
    }
    // srcdoc creates a nested browsing context whose markup can fetch assets.
    if (htmlTags.some(tag => /^<iframe\b/i.test(tag) && /\ssrcdoc\s*=/i.test(tag))) {
      issues.push("HTML shell must not embed unreviewed iframe srcdoc");
    }
    // A base URL silently redirects otherwise-local relative assets to a remote origin.
    // Reject all base href declarations in the offline shell; a local base can also
    // change relative URL resolution and is unnecessary for this entry point.
    if (/<base\b(?:"[^"]*"|\'[^\']*\'|[^\'">])*\shref\s*=/i.test(html)) {
      issues.push("HTML shell must not override its asset base URL");
    }
    // Meta refresh can navigate the shell to a remote origin without a script/link URL.
    // The installed offline entry point has no legitimate refresh-navigation requirement.
    for (const tag of html.match(/<meta\b(?:"[^"]*"|\'[^\']*\'|[^\'">])*>/gi) ?? []) {
      if (/\shttp-equiv\s*=\s*(?:"\s*refresh\s*"|'\s*refresh\s*'|refresh(?=[\s>]))/i.test(decodeReferences(tag))) {
        issues.push("HTML shell must not use meta refresh navigation");
        break;
      }
    }
    for (const tag of html.match(/<(?:script|link|img|iframe|audio|video|source|track|embed|input|object|form|image|use|feimage)\b(?:"[^"]*"|\'[^\']*\'|[^\'">])*>/gi) ?? []) {
      // Responsive image candidates can fetch remote URLs independently of src/href.
      // Reject all srcset/imagesrcset declarations: this minimal offline shell does not need them.
      if (/\s(?:srcset|imagesrcset)\s*=/i.test(tag)) {
        issues.push("HTML shell must not load remote script or link assets by default");
        break;
      }
      for (const attribute of tag.matchAll(/\s(?:src|href|xlink:href|poster|formaction|action|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        // URL parsers strip ASCII tabs and newlines even when embedded in a scheme.
        const url = decodeReferences(attribute[1] ?? attribute[2] ?? attribute[3])
          .replace(/[\t\n\r]/g, "").trimStart();
        // Reject URL schemes and browser-normalized backslash variants, not only HTTP(S).
        // The offline entry point only needs local absolute or relative paths.
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\\\\)/i.test(url) || url.includes("\\")) {
          issues.push("HTML shell must not load remote script or link assets by default");
          break;
        }
      }
      if (issues.includes("HTML shell must not load remote script or link assets by default")) break;
    }
  }
  const manifest = files?.["ui/public/site.webmanifest"];
  if (typeof manifest === "string") {
    try {
      const parsed = JSON.parse(manifest);
      if (parsed?.name !== "Bostan" || parsed?.short_name !== "Bostan") {
        issues.push("Web app manifest must identify Bostan");
      }
    } catch {
      issues.push("Web app manifest is not valid JSON");
    }
  }
  return issues;
}

export function auditBostanUiBrandCheckout(root) {
  const files = {};
  for (const pathname of UI_BRAND_FILES) {
    try { files[pathname] = readFileSync(path.join(root, pathname), "utf8"); }
    catch { files[pathname] = null; }
  }
  return auditBostanUiBrandSnapshot(files);
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const issues = auditBostanUiBrandCheckout(fileURLToPath(new URL("..", import.meta.url)));
  if (issues.length) {
    for (const issue of issues) process.stderr.write("BOSTAN_UI_BRAND_REFUSED: " + issue + "\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("BOSTAN_UI_BRAND_GATE=PASS\n");
  }
}
