# B1-132 — Documentation terminal-command and navigation admission

Status: **PRIVATE DRAFT / ZERO COST / NOT RELEASE QUALIFIED**. Stacked on B1-131 candidate PR #388 at exact parent 46d6ba5ee98c18c8603e9a061e77c84168e478ff. No changes to main, no docs publication, no npm installer or provider invocation.

## Actual defects in B1-131

The original `auditBostanDocsSnapshot` checked installer commands only in `sh`, `bash` and `shell` fenced examples, and only matched `npx paperclipai`, `npx bostan` and `pnpm paperclipai`. A console example `$ pnpm dlx paperclipai onboard`, PowerShell `PS> npm exec -- bostan`, or an unlabeled `npx --yes paperclipai onboard` code fence bypassed its guard. Separately, the actual `docs/docs.json` contained two duplicate Board Operator routes: `execution-workspaces-and-runtime-services` and `delegation`.

## Bounded change

- Extend shell-block recognition to sh/bash/shell/zsh/fish/console/terminal/powershell/pwsh/ps1/cmd/bat and unlabeled fences. Do not treat non-shell code blocks or warning prose as recommendations to run installers.
- Block direct executable examples for unqualified `paperclipai` or unpublished `bostan` via npx (including -y / --yes), pnpm dlx/exec, yarn dlx, bunx and npm exec. This is a narrowly scoped safety guard, **not a full shell parser** or proof of installed-runtime security.
- Enumerate navigable page strings, require the canonical Bostan introduction, forbid the legacy introduction in nav, and reject duplicate navigation routes.
- Remove the two actual repeated Board Operator links without changing or deleting the underlying documents.

## Executed checks and limits

Using the private GitHub content of the exact B1-131 parent and the in-memory patched files before the write: JSON parsed; the actual five canonical checked-in markdown pages were audited by the exact patched pure `auditBostanDocsSnapshot` implementation; result **PASS / zero errors**. The **13 exact authored pure fixture test callback bodies** (8 pre-existing plus 5 new) were executed against the patched implementation in a side-effect-free JavaScript V8 isolate: **13/13 PASS**. The Node-only filesystem-checking test remains authored but **not executed**. These are actual pure tests extracted from the candidate sources, not the complete source-native `node --test` test runner or a private checkout. No package install occurred. Node on the isolated model runner is 22.16.0, below Bostan's required 24.11.

## Remaining gates

On an authorized owner-marked private checkout with Node>=24.11, run `node scripts/bostan-private-docs-entry-gate.mjs` and `node --test scripts/bostan-private-docs-entry-gate.test.mjs` (14 authored tests expected). Then qualify the existing Linux sandbox four-suite Vitest5 + TS7 + genuine rootless bwrap admission gate, Windows PostgreSQL stress (#234), all installed OS journeys, agent consent/effects, privacy/tenant isolation, licenses/NOTICE and origin attribution. Do not assume this guard rejects shell aliases, eval, network-download execution, or unpublished alternative distribution methods. Do not publish before complete qualification.
