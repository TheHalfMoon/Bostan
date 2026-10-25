import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vite = readFileSync(new URL("../ui/vite.config.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../ui/src/App.tsx", import.meta.url), "utf8");

test("Bostan no longer injects unconditional multi-MiB IssueDetail modulepreload into every HTML route", () => {
  assert.doesNotMatch(vite, /function preloadIssueDetail|transformIndexHtml\(|preloadIssueDetail\(\)/);
  assert.match(vite, /serviceWorkerBuildIdPlugin\(\)/);
  assert.match(vite, /codeSplitting:/);
  assert.doesNotMatch(vite, /name: "issue-detail"/);
});

test("issue detail still uses lazy React import and a narrowly scoped task/inbox route prefetch", () => {
  assert.match(app, /const loadIssueDetail\s*=\s*\(\)\s*=>/);
  assert.match(app, /import\("\.\/pages\/IssueDetail"\)/);
  assert.match(app, /const IssueDetail = lazy\(loadIssueDetail\)/);
  assert.match(app, /if \(\/\^\\\/\[\^\/\]\+\\\/\(issues\|tasks\|inbox\)/);
  assert.match(app, /void loadIssueDetail\(\)\.catch\(\(\) => undefined\)/);
});

test("Bostan does not import the complete task detail module eagerly in its main app", () => {
  assert.doesNotMatch(app, /^import \{[^}]*IssueDetail[^}]*\} from "\.\/pages\/IssueDetail"/m);
});
