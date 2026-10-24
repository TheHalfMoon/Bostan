# B0-28 — Private Bostan user guidance and safe documentation links

**Development-only. No release/public help-site assertion.**

## Scope

The imported UI linked users to the donor's public website for a low-trust
GitHub review tutorial, HTTPS/public-ingress policy and Smoke Lab setup.
These links were in UI guidance and copyable agent prompts, so they could
misdirect an operator setting up real Bostan agents.

- Switch relevant guide links to existing Markdown paths in Bostan's private
  GitHub repository, verified in the imported `main` baseline:
  `doc/LOW-TRUST-PRESETS.md`, `doc/DEPLOYMENT-MODES.md`, and
  `doc/connections/SMOKE-LAB-TUTORIAL.md`.
- Rebrand the copyable GitHub setup prompt to the Bostan application name.
  Preserve the exact **Paperclip Review** status check name where current
  server/GitHub integration still uses it; blind renaming would risk breaking
  existing required checks. A real check-identity migration remains open.
- Remove donor identity from sample repository links in the UI Design Guide.
- Change HTTPS-warning link wording to **deployment policy**, not an
  unqualified promise of production-ready installation instructions.
- Add three Node contract checks for the chosen entrypoints, real paths and
  the compatibility check name.

## Validation

- macOS focused UI Vitest (GitHubSetupPrompt, ChatEndpoint clipboard and
  routine editable-sections): **44 PASS / 0 FAIL**. Existing nonfatal React
  `act()` warnings appeared.
- The private guide links require authorized GitHub repository access and
  are not a public Bostan docs site. No outside publication or page fetch
  was attempted. Additional paths may still require staged rebranding.
- Bostan's full UI/protocol identity migration, real GitHub bot enrollment,
  HTTPS deployment, browser E2E, complete security audit and final release
  remain **NOT QUALIFIED**.

Private Draft only. No changes to user accounts, no paid model, no GitHub
Actions activation, no deployment or release; `main` remains unchanged.

### Final local checks

- `node --test scripts/bostan-ui-guide-links.test.mjs scripts/bostan-repository-frontdoor.test.mjs`: **5 PASS / 0 FAIL**.
- UI TypeScript project check: **PASS**.
- Vite production UI bundle: **PASS** (2.56 seconds; inherited large-chunk warnings).
- `git diff --check`: **PASS**.
