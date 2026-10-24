import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const trackedFrontdoor = [
  "SECURITY.md", "CONTRIBUTING.md", "ROADMAP.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/adapter_request.yml",
  ".github/ISSUE_TEMPLATE/enhancement.yml",
  ".github/ISSUE_TEMPLATE/docs_issue.yml",
];

test("repository entry points do not send Bostan contributors to donor channels", () => {
  for (const file of trackedFrontdoor) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(content, /paperclipai\/paperclip|discord\.gg\/paperclipai|\bPaperclip\b|\bCommitperclip\b|\bGreptile\b/i,
      `Unexpected donor link, name, or inherited review requirement in ${file}`);
  }
});

test("security and issue entry points refer to the private Bostan project", () => {
  const security = fs.readFileSync(path.join(root, "SECURITY.md"), "utf8");
  const config = fs.readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/config.yml"), "utf8");
  const contribution = fs.readFileSync(path.join(root, "CONTRIBUTING.md"), "utf8");
  const roadmap = fs.readFileSync(path.join(root, "ROADMAP.md"), "utf8");
  assert.match(security, /TheHalfMoon\/Bostan\/security\/advisories\/new/);
  assert.match(config, /TheHalfMoon\/Bostan\/security\/advisories\/new/);
  assert.match(config, /TheHalfMoon\/Bostan\/blob\/main\/ROADMAP\.md/);
  assert.match(contribution, /Draft PR/);
  assert.match(roadmap, /not released/i);
  assert.match(roadmap, /B0[\s\S]*B6/);
  assert.ok(fs.statSync(path.join(root, "LICENSE")).size > 0,
    "The imported license must be preserved through repository rebranding");
});
