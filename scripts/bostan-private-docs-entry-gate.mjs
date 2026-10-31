import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INTRO_DOCS = Object.freeze([
  "docs/start/what-is-bostan.md",
  "docs/start/quickstart.md",
  "docs/start/core-concepts.md",
  "docs/start/architecture.md",
  "docs/start/what-is-paperclip.md", // legacy path, link only
]);

/** Pure admission check: callers may pass read-only GitHub documents or local files. */
export function auditBostanDocsSnapshot(config, pages) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return ["Bostan docs configuration is missing or invalid"];
  }
  if (config.name !== "Bostan") errors.push("Docs site must use the Bostan identity");
  const expectedRepo = "https://github.com/TheHalfMoon/Bostan";
  const topbar = config.topbarLinks ?? [];
  if (!Array.isArray(topbar) || !topbar.some((link) => link?.name === "GitHub" && link?.url === expectedRepo)) {
    errors.push("Topbar GitHub link must point to the private Bostan repository");
  }
  if (config.footerSocials?.github !== expectedRepo) {
    errors.push("Footer GitHub link must point to the private Bostan repository");
  }
  // Enumerate only real page routes; JSON string contains unrelated labels/URLs.
  const navigationPages = [];
  function collectPages(node, key = "") {
    if (key === "pages" && Array.isArray(node)) {
      for (const value of node) if (typeof value === "string") navigationPages.push(value);
    }
    if (Array.isArray(node)) {
      for (const value of node) collectPages(value);
    } else if (node && typeof node === "object") {
      for (const [childKey, value] of Object.entries(node)) collectPages(value, childKey);
    }
  }
  collectPages(config.navigation ?? {});
  if (!navigationPages.includes("start/what-is-bostan") || navigationPages.includes("start/what-is-paperclip")) {
    errors.push("Canonical introduction must appear in docs navigation, not the legacy route");
  }
  const duplicatePages = [...new Set(navigationPages.filter((route, index) => navigationPages.indexOf(route) !== index))];
  if (duplicatePages.length) {
    errors.push(`Docs navigation contains duplicate page routes: ${duplicatePages.join(", ")}`);
  }
  for (const pathname of INTRO_DOCS) {
    if (typeof pages?.[pathname] !== "string" || pages[pathname].trim() === "") {
      errors.push(`Required Bostan docs page missing: ${pathname}`);
    }
  }
  for (const pathname of INTRO_DOCS.filter((p) => !p.endsWith("architecture.md"))) {
    const body = pages?.[pathname];
    if (typeof body === "string" && /\bPaperclip\b/.test(body)) {
      errors.push(`Donor product name must not appear as Bostan: ${pathname}`);
    }
  }
  const intro = pages?.["docs/start/what-is-bostan.md"] ?? "";
  if (typeof intro === "string" && (!/^title:\s*What is Bostan\?/m.test(intro) || !/not yet (?:a qualified|qualified)|not release-qualified|not yet a qualified/i.test(intro))) {
    errors.push("Canonical introduction must identify Bostan and disclose preview-only status");
  }
  const legacy = pages?.["docs/start/what-is-paperclip.md"] ?? "";
  if (typeof legacy === "string" && !legacy.includes("/start/what-is-bostan")) {
    errors.push("Legacy document URL must lead to canonical Bostan introduction");
  }
  const quickstart = pages?.["docs/start/quickstart.md"] ?? "";
  if (typeof quickstart === "string") {
    // Check executable examples across common terminal fence labels, including unlabeled.
    // Warning prose and non-shell source code are not shell execution instructions.
    const shellExamples = [...quickstart.matchAll(/^[ \t]*```(?:sh|bash|shell|zsh|fish|console|terminal|powershell|pwsh|ps1|cmd|bat)?[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/gim)]
      .map((match) => match[1]).join("\n");
    const unsupportedInstaller = /(?:^|\n)[ \t]*(?:(?:\$|PS>|>)[ \t]*)?(?:npx\s+(?:(?:-y|--yes)\s+)?|pnpm\s+(?:dlx|exec)\s+|yarn\s+dlx\s+|bunx\s+|npm\s+exec\s+(?:--\s+)?)(?:paperclipai|bostan)(?=$|[\s@/;|&])/im;
    if (unsupportedInstaller.test(shellExamples)) {
      errors.push("Quickstart must not install unqualified donor or unpublished Bostan packages");
    }
    if (!/not release-qualified|not yet passed Bostan qualification/i.test(quickstart)) {
      errors.push("Quickstart must explicitly disclose missing runtime qualification");
    }
  }
  return errors;
}

export function auditBostanDocsCheckout(root) {
  const config = JSON.parse(readFileSync(path.join(root, "docs/docs.json"), "utf8"));
  const pages = {};
  for (const pathname of INTRO_DOCS) {
    try { pages[pathname] = readFileSync(path.join(root, pathname), "utf8"); }
    catch { pages[pathname] = null; }
  }
  return auditBostanDocsSnapshot(config, pages);
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  try {
    const errors = auditBostanDocsCheckout(fileURLToPath(new URL("..", import.meta.url)));
    if (errors.length) {
      for (const issue of errors) process.stderr.write(`BOSTAN_DOCS_PREVIEW_REFUSED: ${issue}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write("BOSTAN_DOCS_PREVIEW_GATE=PASS\n");
    }
  } catch (error) {
    process.stderr.write(`BOSTAN_DOCS_PREVIEW_REFUSED: ${error.message}\n`);
    process.exitCode = 1;
  }
}
