import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = relative => readFileSync(fileURLToPath(new URL("../" + relative, import.meta.url)), "utf8");
const cases = [
  { file: "ui/src/pages/CompanySkills.tsx",
    expected: ["Bostan managed", '"Bostan catalog"', 'author: entry.packageName ?? "Bostan"'],
    forbidden: ['managedLabel: "Paperclip managed"', 'author: entry.packageName ?? "Paperclip"'] },
  { file: "ui/src/pages/apps/app-detail/ActionTestDialog.tsx",
    expected: ["before this call leaves Bostan", "Bostan allowed this call.", "Bostan will not repeat the call"],
    forbidden: ["before this call leaves Paperclip", "Paperclip allowed this call.", "Paperclip will not repeat the call"] },
  { file: "ui/src/pages/apps/app-detail/PermissionsPanel.tsx",
    expected: ["Bostan classified this action"], forbidden: ["Paperclip classified this action"] },
  { file: "ui/src/pages/InstanceExperimentalSettings.tsx",
    expected: ["Managed by hosting provider"], forbidden: ["Managed by Paperclip Cloud", "Managed by Bostan Cloud"] },
  { file: "ui/src/pages/agent-skills/AgentSkillsTab.tsx",
    expected: ["Bostan Runner uses native semantic coordination"],
    forbidden: ["legacy Paperclip operational skill"] },
  { file: "ui/src/pages/DesignGuide.tsx",
    expected: ["used across Bostan.", ">Bostan App</BreadcrumbLink>", "Ships with Bostan", "TheHalfMoon/Bostan", "BOS-559", "bostan.example"],
    forbidden: ["used across Paperclip.", ">Paperclip App</BreadcrumbLink>", "Ships with Paperclip", "paperclipai/docs", "PAP-559", "paperclip.example"] },
  { file: "ui/src/pages/SystemNoticeUxLab.tsx",
    expected: ['label: "Bostan"', "Bostan could not resolve"],
    forbidden: ['label: "Paperclip"', "Paperclip could not resolve"] },
];
for (const { file, expected, forbidden } of cases) {
  test("Bostan product-visible copy is guarded: " + file, () => {
    const src = read(file);
    for (const snippet of expected) assert.ok(src.includes(snippet), "missing Bostan copy " + snippet);
    for (const snippet of forbidden) assert.ok(!src.includes(snippet), "legacy donor text must not render: " + snippet);
  });
}
test("internal compatibility and source licenses are not rewritten by visible-brand batch", () => {
  const source = read("ui/src/pages/CompanySkills.tsx");
  assert.match(source, /case "paperclip":/);
  const action = read("ui/src/pages/apps/app-detail/ActionTestDialog.tsx");
  assert.match(action, /"x-paperclip-advanced"/);
  const settings = read("ui/src/pages/InstanceExperimentalSettings.tsx");
  assert.match(settings, /"enablePaperclipDeveloperMode"/);
});
