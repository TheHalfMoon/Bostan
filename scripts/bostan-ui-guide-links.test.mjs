import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const uiEntrypoints = [
  "ui/src/components/GitHubAgentTrustWarning.tsx",
  "ui/src/pages/apps/chat/GitHubSetupPrompt.tsx",
  "ui/src/pages/apps/chat/ChatEndpointSetup.tsx",
  "ui/src/pages/tools/SmokeLabTab.tsx",
  "ui/src/components/routine-triggers/WebhookUrlWarning.tsx",
  "ui/src/pages/DesignGuide.tsx",
];

// These docs exist on the inherited Bostan main baseline, not in a future PR.
const existingGuides = [
  "doc/LOW-TRUST-PRESETS.md",
  "doc/DEPLOYMENT-MODES.md",
  "doc/connections/SMOKE-LAB-TUTORIAL.md",
];

test("user-facing guidance does not route operators to the former product", () => {
  for (const filename of uiEntrypoints) {
    const code = fs.readFileSync(path.join(root, filename), "utf8");
    assert.doesNotMatch(code, /https?:\/\/docs\.paperclip\.ing|https?:\/\/github\.com\/paperclipai\/paperclip(?:\/|\b)/,
      `Inherited external guide or repository link in ${filename}`);
  }
});

test("private GitHub guidance targets verified existing source documents", () => {
  const combined = uiEntrypoints.map(filename => fs.readFileSync(path.join(root, filename), "utf8")).join("\n");
  for (const guide of existingGuides) {
    assert.ok(fs.statSync(path.join(root, guide)).isFile(), `${guide} must exist`);
    assert.ok(combined.includes(`https://github.com/TheHalfMoon/Bostan/blob/main/${guide}`),
      `No real Bostan documentation destination for ${guide}`);
  }
});

test("GitHub setup explains Bostan without renaming a still-required check", () => {
  const prompt = fs.readFileSync(path.join(root, "ui/src/pages/apps/chat/GitHubSetupPrompt.tsx"), "utf8");
  assert.match(prompt, /GitHub review bot in Bostan/);
  assert.doesNotMatch(prompt, /docs\.paperclip\.ing/);
  assert.match(prompt, /Paperclip Review/);
});
