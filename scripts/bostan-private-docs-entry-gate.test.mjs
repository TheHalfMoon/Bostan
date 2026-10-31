import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  auditBostanDocsSnapshot,
  auditBostanDocsCheckout,
} from "./bostan-private-docs-entry-gate.mjs";

function fixture() {
  return {
    config: {
      name: "Bostan",
      topbarLinks: [{ name: "GitHub", url: "https://github.com/TheHalfMoon/Bostan" }],
      footerSocials: { github: "https://github.com/TheHalfMoon/Bostan" },
      navigation: { tabs: [{ groups: [{ pages: ["start/what-is-bostan", "start/quickstart"] }] }] },
    },
    pages: {
      "docs/start/what-is-bostan.md": "---\ntitle: What is Bostan?\n---\nBostan is not yet a qualified installable product.",
      "docs/start/what-is-paperclip.md": "Moved: /start/what-is-bostan",
      "docs/start/quickstart.md": "Bostan is not release-qualified.\n```sh\npnpm install\npnpm dev\n```",
      "docs/start/core-concepts.md": "Bostan work is governed.",
      "docs/start/architecture.md": "Bostan uses local compatibility skill paths.",
    },
  };
}

test("accepts the Bostan-only preview docs contract", () => {
  const { config, pages } = fixture();
  assert.deepEqual(auditBostanDocsSnapshot(config, pages), []);
});

test("refuses the old donor product name and old GitHub navigation", () => {
  const { config, pages } = fixture();
  config.name = "Paperclip";
  config.topbarLinks[0].url = "https://github.com/paperclip-ai/paperclip";
  config.footerSocials.github = "https://github.com/paperclip-ai/paperclip";
  config.navigation.tabs[0].groups[0].pages[0] = "start/what-is-paperclip";
  const errors = auditBostanDocsSnapshot(config, pages);
  assert.ok(errors.some((e) => e.includes("Bostan identity")));
  assert.ok(errors.some((e) => e.includes("Topbar")));
  assert.ok(errors.some((e) => e.includes("Footer")));
  assert.ok(errors.some((e) => e.includes("Canonical")));
});

test("refuses a quickstart command that executes the donor package", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\n```sh\nnpx paperclipai onboard\n```";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("unqualified")));
});

test("refuses a command that pretends an unpublished Bostan installer exists", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\n```bash\nnpx bostan onboard\n```";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("unqualified")));
});

test("allows warning prose mentioning a command but not suggesting it to execute", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\nDo not publish or run `npx bostan`.";
  assert.deepEqual(auditBostanDocsSnapshot(config, pages), []);
});

test("refuses a missing or unbranded canonical introduction", () => {
  const { config, pages } = fixture();
  pages["docs/start/what-is-bostan.md"] = null;
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("missing")));
  pages["docs/start/what-is-bostan.md"] = "title: What is Paperclip?";
  const issues = auditBostanDocsSnapshot(config, pages);
  assert.ok(issues.some((e) => e.includes("Donor product")));
  assert.ok(issues.some((e) => e.includes("preview-only")));
});

test("requires the old filename's document to point to Bostan instead", () => {
  const { config, pages } = fixture();
  pages["docs/start/what-is-paperclip.md"] = "Old content only.";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("Legacy document")));
});

test("refuses donor branding in currently navigable concept content", () => {
  const { config, pages } = fixture();
  pages["docs/start/core-concepts.md"] = "Paperclip organizes this.";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("Donor product")));
});

test("refuses donor package installation in console and pnpm dlx examples", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\n```console\n$ pnpm dlx paperclipai onboard\n```";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("unqualified")));
});

test("refuses npm exec and Bostan preview packaging in PowerShell examples", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\n```powershell\nPS> npm exec -- bostan\n```";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("unqualified")));
});

test("refuses unpublished npx with options in an unlabeled terminal block", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\n```\nnpx --yes paperclipai onboard\n```";
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("unqualified")));
});

test("refuses duplicate documentation routes instead of silently showing duplicates", () => {
  const { config, pages } = fixture();
  config.navigation.tabs[0].groups[0].pages.push("start/quickstart");
  assert.ok(auditBostanDocsSnapshot(config, pages).some((e) => e.includes("duplicate page routes")));
});

test("does not confuse non-shell code or warning prose with execution advice", () => {
  const { config, pages } = fixture();
  pages["docs/start/quickstart.md"] += "\nDo not run `pnpm dlx paperclipai`.\n```js\nconst example = 'npm exec -- bostan';\n```";
  assert.deepEqual(auditBostanDocsSnapshot(config, pages), []);
});

test("verifies the actual checked-in Bostan preview docs on an authorized checkout", () => {
  const checkoutRoot = fileURLToPath(new URL("..", import.meta.url));
  assert.deepEqual(auditBostanDocsCheckout(checkoutRoot), []);
});
