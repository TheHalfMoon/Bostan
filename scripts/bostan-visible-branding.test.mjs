import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function source(relative) {
  return readFileSync(fileURLToPath(new URL("../" + relative, import.meta.url)), "utf8");
}

const customerCopy = [
  "ui/src/components/GrokBotConnection.tsx",
  "ui/src/pages/audit/AuditFeed.tsx",
  "ui/src/pages/audit/AuditFeed.production.tsx",
  "ui/src/pages/CompanySkills.tsx",
  "ui/src/pages/CompanySkills.production.tsx",
  "ui/src/pages/apps/PaperclipCloudOAuthHandoff.tsx",
  "ui/src/connect-flow-preview-main.tsx",
  "ui/src/adapters/hermes-gateway/config-fields.tsx",
  "ui/src/App.tsx",
];

test("Bostan customer-facing copy does not advertise donor as the active product", () => {
  const oldProductCopy = [
    /Paperclip supplies task coordination/,
    /Paperclip (?:can|cannot|couldn.t) /,
    /Return to Paperclip/,
    /Paperclip Enterprise view/,
    /Recorded by Paperclip/,
    /(?:Stop|Working in a) Paperclip work/,
    /in the Paperclip workspace/,
    /Organizations are created in Paperclip Cloud/,
    /Your Paperclip sign-in/,
    /Paperclip works with your existing subscription/,
    /Hermes API server base URL that Paperclip can reach/,
  ];
  for (const filename of customerCopy) {
    const file = source(filename);
    for (const donorLabel of oldProductCopy) {
      assert.doesNotMatch(file, donorLabel,
        filename + " must not represent the original source as Bostan's live brand");
    }
  }
});

test("portable company export names the actual Bostan CLI and requires a safe preview", () => {
  const exportPage = source("ui/src/pages/CompanyExport.tsx");
  const commandRegistration = source("cli/src/commands/client/company.ts");
  const cliManifest = JSON.parse(source("cli/package.json"));
  assert.match(exportPage, /bostan company import this-github-url-or-folder --dry-run/);
  assert.doesNotMatch(exportPage, /npx paperclipai company import/);
  assert.match(commandRegistration, /\.command\("import"\)/);
  assert.match(commandRegistration, /\.option\("--dry-run"/);
  assert.equal(cliManifest.name, "bostan");
  assert.equal(cliManifest.bin.bostan, "./dist/bostan.js");
});

test("technical/provenance identifiers remain intact where compatibility requires them", () => {
  assert.match(source("ui/src/pages/CompanySkills.tsx"), /case "paperclip"/);
  assert.match(source("ui/src/pages/CompanyExport.tsx"), /paperclipExtensionPath/);
  assert.match(source("ui/src/components/GrokBotConnection.tsx"),
    /import type \{ DotPairing \} from "@paperclipai\/shared"/);
});

test("first-admin setup never suggests an unshipped donor npm bootstrap executable", () => {
  const sourceFiles = [
    "ui/src/bootstrapSetup.ts",
    "ui/src/components/BootstrapPendingPage.tsx",
    "ui/src/pages/BootstrapSetupUxLab.tsx",
  ];
  for (const file of sourceFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /\bnpx\s+paperclipai\b|BOOTSTRAP_FALLBACK_COMMAND/,
      file + " must not suggest unsupported external donor package execution");
  }
  assert.match(source("ui/src/bootstrapSetup.ts"),
    /BOSTAN_BOOTSTRAP_PREVIEW_NOTICE/);
  assert.match(source("cli/src/bostan-preview.mjs"), /Bostan: \$\{command\} unavailable/);
});
