import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditBostanDocsCheckout } from "./bostan-private-docs-entry-gate.mjs";
import { auditBostanUiBrandCheckout } from "./bostan-private-ui-brand-gate.mjs";

/** Fail closed without disclosing unexpected exception text or sensitive paths. */
export function auditBostanPrivatePreflight(root, checks = [
  ["docs", auditBostanDocsCheckout],
  ["ui", auditBostanUiBrandCheckout],
]) {
  const issues = [];
  for (const [name, audit] of checks) {
    try {
      const result = audit(root);
      if (!Array.isArray(result) || result.some((item) => typeof item !== "string")) {
        issues.push(name + ": invalid audit result");
        continue;
      }
      for (const item of result) issues.push(name + ": " + item);
    } catch {
      // Exceptions may contain full paths or provider configuration: redact.
      issues.push(name + ": audit threw an exception");
    }
  }
  return issues;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const issues = auditBostanPrivatePreflight(root);
  if (issues.length) {
    for (const issue of issues) process.stderr.write("BOSTAN_PRIVATE_PREFLIGHT_REFUSED: " + issue + "\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("BOSTAN_PRIVATE_PREFLIGHT=PASS\n");
  }
}
