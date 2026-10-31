# B1-133 — Navigable CLI and deployment docs preview safety

Status: **PRIVATE / DRAFT / ZERO COST / NO PUBLICATION / RELEASE NO-GO.** Stacked directly on B1-132 PR #389 exact parent 7541c278b4cb3fb7d7fdd3d2eea09396186a46e1.

## Real sourced issue

The active private GitHub documentation at the parent HEAD still contained donor user-facing install and deployment instructions, including direct `npx paperclipai run` and `pnpm paperclipai onboard` examples in CLI/deployment pages, Docker Compose startup and runtime examples, and advice to pass paid-provider API keys to an unqualified Docker runtime. The canonical first-run doc had been fixed in #388, but navigation still exposed these active guides. Reusing them could execute the wrong product, encourage premature public deployment, or expose credentials to an unqualified runtime.

## Bounded fix

Replaced exactly four navigable entry pages: `docs/deploy/overview.md`, `docs/deploy/docker.md`, `docs/cli/overview.md`, and `docs/cli/setup-commands.md`. They now state Bostan's private, not-release-qualified status and describe inherited architecture concepts only; no executable installation or Docker deployment is endorsed. Preserve authentic historical compatibility paths/env concepts without deleting legally required notices. Added all four pages to the file-required documentation gate; refuse donor branding in those pages, missing qualification warnings, executable donor/unpublished Bostan CLI shell examples, and Docker start/build/run shell snippets in deployment guides. Restored blocking direct `pnpm paperclipai` invocations in the first-run gate as well. Added seven positive and negative regression tests; prior scenarios retained.

## Evidence and honest execution boundary

Fetched exact private GitHub parent markdown/config/source, patched candidates, and ran the actual pure audit implementation in side-effect-free V8 before writing. All nine checked-in-or-candidate Markdown sources (five previous plus four new previews) passed, zero findings. **20/20 exact authored pure test fixture callbacks passed** (13 prior and 7 new) against the candidate implementation. The 21st test requiring a complete authorized private filesystem checkout was authored but **NOT RUN**. Full source-native Node `node --test`, TypeScript7, Vitest5, genuine rootless bwrap, installed-product and runtime release gates were **NOT run or passed**. No Docker, CLI or paid-provider commands executed.

## Remaining work

Many OTHER imported guide, adapter and API pages still need donor-brand/unsafe-command triage. Application/UI branding and internal package migration remain incomplete. Source-native qualification needs Node>=24.11/pinned deps and full Linux four-suite Vitest + TS7 + four real bwrap cases; Windows PostgreSQL crash/stress issue #234, installed OS workflows, governed agent effects/consent, privacy/tenant isolation and legal provenance/NOTICE remain unresolved. Never publish docs or deploy the product based on this preview.
