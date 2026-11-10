import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notice = "Bostan release safety notice (2026-11-10)";
const unsafe = ["paperclip.ing", "paperclipai", "scripts/install.sh"];

for (const relative of ["doc/INSTALLING.md", "doc/CLI.md"]) {
  test(`${relative} warns before inherited upstream installation instructions`, () => {
    const content = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(content, /^# [^\n]+\n\n> \*\*Bostan release safety notice/);
    assert.equal(content.split(notice).length, 2, "one prominent release warning");
    for (const source of unsafe) {
      assert.ok(content.indexOf(source) > content.indexOf(notice), `warning must precede ${source}`);
      assert.ok(content.slice(0, content.indexOf("\n\n", content.indexOf(notice))).includes(source), `warning must name ${source}`);
    }
    assert.match(content, /no approved public installer, desktop package, or release/);
  });
}

test("inherited installer fails closed before any network or package execution", () => {
  const script = fs.readFileSync(path.join(root, "scripts/install.sh"), "utf8");
  const preamble = script.split("set -euo pipefail")[0];
  assert.match(preamble, /Bostan private source/);
  assert.match(preamble, /exit 2/);
  assert.doesNotMatch(preamble, /curl |npm install|npx |git clone/);
});
