import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = (path) => readFileSync(join(root, path), "utf8");

const visibleCopy = new Map([
  ["ui/src/components/SummarySlotCard.tsx", "Bostan's built-in Summarizer agent"],
  ["ui/src/adapters/openclaw-gateway/config-fields.tsx", "Bostan API URL override"],
  ["ui/src/pages/apps/AppDetail.tsx", "Bostan controls access to the tools"],
  ["ui/src/adapters/codex-local/config-fields.tsx", "Bostan cannot enforce"],
  ["ui/src/adapters/claude-local/config-fields.tsx", "Bostan-managed organization/agent"],
  ["ui/src/adapters/gemini-local/config-fields.tsx", "Bostan-managed organization/agent"],
  ["ui/src/adapters/grok-local/config-fields.tsx", "Bostan stages it"],
  ["ui/src/adapters/hermes-gateway/config-fields.tsx", "Bostan API URL"],
  ["ui/src/adapters/adapter-display-registry.ts", 'label: "Bostan Runner"'],
  ["ui/src/adapters/paperclip-runner/index.ts", 'label: "Bostan Runner"'],
  ["ui/src/components/task-chat/ComposerRunSettingsPicker.tsx", '"Bostan Runner"'],
  ["ui/src/pages/apps/gateways/panels/TokensPanel.tsx", "Bostan creates a fresh one-hour runtime token"],
  ["ui/src/pages/apps/gateways/ConnectClientDialog.tsx", "access to Bostan"],
  ["ui/src/pages/apps/CatalogSourceFilters.tsx", 'paperclip: "Bostan"'],
  ["ui/src/lib/search-query-parser.ts", "Bostan App"],
  ["ui/src/components/AgentRunnerSelect.tsx", "Bostan Runner"],
  ["ui/src/pages/InstanceExperimentalSettings.tsx", 'title="Bostan Runner"'],
  ["ui/src/components/new-agent/NewAgentSetup.tsx", '"Bostan Runner"'],
  ["ui/src/pages/secrets/ImportFromVaultDialog.tsx", "Bring AWS-managed secrets into Bostan"],
  ["ui/src/pages/IssueDetail.tsx", '"Stop Bostan work"'],
  ["ui/src/lib/workspace-access-state.ts", "Bostan is still confirming the clone."],
  ["ui/src/lib/skill-policy-denial.ts", "configured Bostan workspace"],
  ["ui/src/pages/UserProfile.tsx", '"Bostan services"'],
  ["ui/src/pages/Secrets.tsx", 'placeholder="alias/bostan-secrets"'],
  ["ui/src/pages/InstanceExperimentalSettings.tsx", "Bostan Developer Mode"],
  ["ui/src/pages/Costs.tsx", "Bostan cannot enforce a Muse spend ceiling."],
  ["ui/src/pages/McpConnect.tsx", "Connect your assistant to Bostan"],
  ["ui/src/pages/AgentToolsTab.tsx", "Bostan could not verify this agent"],
  ["ui/src/pages/ProjectWorkspaceDetail.tsx", "A local path Bostan can use directly."],
  ["ui/src/pages/ExecutionWorkspaceDetail.tsx", "Bostan created a run using this execution workspace."],
  ["ui/src/pages/agent-skills/AgentSkillsTab.tsx", "stable Bostan-managed prompt bundle"],
  ["ui/src/pages/tools/connection-dialogs.tsx", "Bostan stores only the"],
  ["ui/src/pages/tools/McpConfigHelpDialog.tsx", "back into Bostan."],
  ["ui/src/pages/tools/PasteConfigTab.tsx", "Bostan couldn’t start secure sign-in."],
  ["ui/src/pages/tools/AuditTab.tsx", 'Recorded by Bostan.'],
  ["ui/src/pages/secrets/SetMyUserSecretDialog.tsx", "Bostan stores the"],
  ["ui/src/pages/ProfileSettings.tsx", "Bostan file storage"],
  ["ui/src/pages/CompanyAccess.tsx", "Bostan continues enforcing organization boundaries"],
  ["ui/src/pages/apps/app-detail/BrowserUseSettingsPanel.tsx", "remaining Bostan budget"],
]);

test("first-party agent and local adapter labels expose Bostan identity", () => {
  for (const [path, snippet] of visibleCopy) {
    assert.ok(source(path).includes(snippet), path + " must retain " + snippet);
  }
});

test("stable inherited internal keys and protocol ids are not silently renamed", () => {
  assert.match(source("ui/src/components/AgentRunnerSelect.tsx"), /defaultRunner === "paperclip"/);
  assert.match(source("ui/src/pages/apps/CatalogSourceFilters.tsx"), /"paperclip", "composio"/);
  assert.match(source("ui/src/components/task-chat/ComposerRunSettingsPicker.tsx"), /paperclip_runner/);
  assert.match(source("ui/src/adapters/codex-local/config-fields.tsx"), /isPaperclipRunnerProvider/);
});

test("local trust policy editor has no inherited paid SaaS promotion or external sales link", () => {
  const copy = source("ui/src/components/TrustPresetSection.tsx");
  assert.match(copy, /managed through the approved API/);
  assert.match(copy, /Managed through API/);
  assert.doesNotMatch(copy, /paperclip\.ing\/ee|Get Paperclip EE|href="https?:\/\/paperclip/i);
});


test("Bostan-facing secrets, workspace and run-control UI never advertises donor identity", () => {
  for (const filename of [
    "ui/src/pages/secrets/ImportFromVaultDialog.tsx",
    "ui/src/lib/workspace-access-state.ts",
    "ui/src/lib/skill-policy-denial.ts",
  ]) {
    assert.doesNotMatch(source(filename), /Paperclip/, filename);
  }
  const secrets = source("ui/src/pages/Secrets.tsx");
  for (const placeholder of ['placeholder="paperclip"', 'placeholder="paperclip-prod"',
    'placeholder="alias/paperclip-secrets"', 'placeholder="paperclip/prod"']) {
    assert.ok(!secrets.includes(placeholder), placeholder);
  }
  // Retain deployed local state and server protocol identities.
  assert.match(secrets, /paperclip.secrets.viewMode/);
  assert.match(secrets, /paperclip_managed/);
  assert.match(source("ui/src/pages/IssueDetail.tsx"), /paperclip_runner_v1/);
});

test("assistant connection UI retains stable MCP OAuth permission scopes", () => {
  const body = source("ui/src/pages/McpConnect.tsx");
  for (const scope of ["paperclip:agent", "paperclip:write", "paperclip:configure"]) {
    assert.ok(body.includes(scope), scope + " is a stable scope identifier");
  }
  assert.doesNotMatch(body, /Connect your assistant to Paperclip|Write all of your Paperclip data/);
});

test("operational workspace and agent tool screens show Bostan without renaming runtime protocols", () => {
  for (const filename of [
    "ui/src/pages/AgentToolsTab.tsx",
    "ui/src/pages/ProjectWorkspaceDetail.tsx",
    "ui/src/pages/ExecutionWorkspaceDetail.tsx",
  ]) {
    assert.doesNotMatch(source(filename), /Paperclip/, filename);
  }
  const skills = source("ui/src/pages/agent-skills/AgentSkillsTab.tsx");
  assert.match(skills, /Bostan cannot manage skills for custom ACP commands yet/);
  assert.match(skills, /Bostan cannot manage OpenClaw skills here/);
  assert.match(skills, /Bostan cannot manage skills for this adapter yet/);
  // These are technical legacy compatibility identifiers, not product copy.
  assert.match(skills, /agent\.adapterType === "paperclip_runner"/);
  assert.match(skills, /legacy Paperclip operational skill/);
});


test("connector, secret, audit, account and browser budget copy never exposes donor branding", () => {
  const files = [
    "ui/src/pages/tools/connection-dialogs.tsx",
    "ui/src/pages/tools/McpConfigHelpDialog.tsx",
    "ui/src/pages/tools/PasteConfigTab.tsx",
    "ui/src/pages/tools/AuditTab.tsx",
    "ui/src/pages/secrets/SetMyUserSecretDialog.tsx",
    "ui/src/pages/ProfileSettings.tsx",
    "ui/src/pages/CompanyAccess.tsx",
    "ui/src/pages/apps/app-detail/BrowserUseSettingsPanel.tsx",
  ];
  for (const filename of files) {
    assert.doesNotMatch(source(filename), /Paperclip/, filename);
  }
  // Security contracts stay unchanged: no raw secret persistence or
  // unauthorized command activation can be inferred from marketing copy.
  assert.match(source("ui/src/pages/tools/connection-dialogs.tsx"), /vault:\/\//);
  assert.match(source("ui/src/pages/tools/PasteConfigTab.tsx"), /draft-only/);
  assert.match(source("ui/src/pages/secrets/SetMyUserSecretDialog.tsx"), /reference, not the value/);
});
