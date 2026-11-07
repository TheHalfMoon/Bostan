#!/usr/bin/env node

// Publication hold: no workflow may be able to publish, run unattended, or
// execute upstream code. Run first in CI and locally before enabling Actions.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RULES = [
  { id: "schedule-trigger", pattern: /^\s*schedule\s*:/m },
  { id: "pull-request-target", pattern: /\bpull_request_target\b/ },
  { id: "workflow-run-trigger", pattern: /^\s*workflow_run\s*:/m },
  { id: "write-scope", pattern: /:\s*write\b|\bwrite-all\b/ },
  { id: "secrets-reference", pattern: /\bsecrets\s*\.|\bsecrets\s*\[|secrets\s*:\s*inherit/ },
  { id: "upstream-reference", pattern: /paperclipai\//i },
  { id: "publish-step", pattern: /\b(docker\s+push|npm\s+publish|pnpm\s+publish|gh\s+release|cargo\s+publish|twine\s+upload)\b/ },
  { id: "unpinned-action", pattern: /^\s*-?\s*uses\s*:\s*(?!\.\/)[^@\s]+@(?![0-9a-f]{40}\b)\S+/m },
];

export function checkWorkflow(source) {
  const withoutComments = source.replace(/(^|\s)#.*$/gm, "$1");
  return RULES.filter((rule) => rule.pattern.test(withoutComments)).map((rule) => rule.id);
}

export function checkWorkflowDir(dir) {
  const violations = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/\.ya?ml$/.test(name)) continue;
    for (const rule of checkWorkflow(readFileSync(join(dir, name), "utf8"))) {
      violations.push(`${name}: ${rule}`);
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");
  const violations = checkWorkflowDir(dir);
  if (violations.length > 0) {
    console.error(`Workflow quarantine gate failed:\n  ${violations.join("\n  ")}`);
    process.exit(1);
  }
  console.log("Workflow quarantine gate passed.");
}
