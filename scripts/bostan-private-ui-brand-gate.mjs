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
