import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { checkWorkflow, checkWorkflowDir } from "./bostan-workflow-quarantine-gate.mjs";

const PIN = "11bd71901bbe5b1630ceea73d27597364c9af683";
const SAFE = `on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${PIN} # v4.2.2
      - run: pnpm test
`;

const dirs = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

test("a read-only pull_request workflow with pinned actions passes", () => {
  assert.deepEqual(checkWorkflow(SAFE), []);
});

for (const [rule, snippet] of [
  ["schedule-trigger", "on:\n  schedule:\n    - cron: '0 9 * * *'\n"],
  ["pull-request-target", "on:\n  pull_request_target:\n"],
  ["workflow-run-trigger", "on:\n  workflow_run:\n    workflows: [x]\n"],
  ["write-scope", "permissions:\n  packages: write\n"],
  ["write-scope", "permissions: write-all\n"],
  ["secrets-reference", "env:\n  T: ${{ secrets.NPM_TOKEN }}\n"],
  ["secrets-reference", "jobs:\n  a:\n    secrets: inherit\n"],
  ["upstream-reference", "jobs:\n  a:\n    uses: paperclipai/paperclip/.github/workflows/pr-trusted.yml@master\n"],
  ["publish-step", "steps:\n  - run: docker push ghcr.io/x/y\n"],
  ["publish-step", "steps:\n  - run: gh release create v1\n"],
  ["publish-step", "steps:\n  - run: pnpm publish --no-git-checks\n"],
  ["unpinned-action", "steps:\n  - uses: actions/checkout@v4\n"],
]) {
  test(`rejects ${rule}: ${snippet.split("\n").find((line) => line.trim() && !/^(on|jobs|steps|env|permissions):$/.test(line.trim())).trim()}`, () => {
    assert.ok(checkWorkflow(snippet).includes(rule), `expected ${rule} for:\n${snippet}`);
  });
}

test("comments cannot trip or hide a rule", () => {
  assert.deepEqual(checkWorkflow(`${SAFE}# schedule: and docker push are only mentioned here\n`), []);
  assert.ok(checkWorkflow("on:\n  schedule: # nightly\n    - cron: '0 9 * * *'\n").includes("schedule-trigger"));
});

test("local composite actions do not need a SHA pin", () => {
  assert.deepEqual(checkWorkflow(SAFE.replace(`actions/checkout@${PIN} # v4.2.2`, "./.github/actions/setup")), []);
});

test("checkWorkflowDir reports every violating file and ignores non-YAML", () => {
  const dir = mkdtempSync(join(tmpdir(), "bostan-wf-gate-"));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ok.yml"), SAFE);
  writeFileSync(join(dir, "release.yml"), "on:\n  schedule:\n    - cron: '0 9 * * *'\npermissions:\n  contents: write\n");
  writeFileSync(join(dir, "README.md"), "schedule: docker push");
  assert.deepEqual(checkWorkflowDir(dir), ["release.yml: schedule-trigger", "release.yml: write-scope"]);
});
