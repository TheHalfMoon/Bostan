# B1-134 — Navigable deployment, CLI, and adapter overview preview guard

PRIVATE, ZERO COST, DRAFT UNMERGED, RELEASE NO-GO. Parent exact #390 SHA fec2ec83264cfd1da5b1b0dce13871af70982372.

## Confirmed prior defects
At the exact private #390 head, seven further directly navigable documentation pages still displayed unqualified donor products and executable commands. Source examples: local-development had `pnpm paperclipai run` and non-loopback bind presets; Tailscale guide encouraged device sharing; deployment modes had donor onboarding/hostname and public deployment; database page contained `docker compose up -d` and schema push; storage encouraged donor configure; control-plane CLI was filled with `npx paperclipai`; adapter overview suggested HTTP plugin installation and source-internal donor branding. This is evidence from actual private GitHub file snapshots, not inference.

## Bounded changes
Replaced those EXACT seven navigable pages with non-executable, Bostan-branded engineering preview documentation. Keep real source compatibility terms as implementation concepts, with explicit migration caveats; no arbitrary code/path renaming, no license/NOTICE removal. Extended the existing read-only zero-dependency docs audit to require and validate all seven additional pages, reject donor product branding and missing release disclaimers, refuse executable donor/unpublished CLI and Docker snippets, and reject external adapter installation requests in the overview. Added seven negative and positive synthetic tests; prior twenty retained.

## Actual execution and limits
Actual exact GitHub old code/site+existing nine Markdown sources were fetched and the seven replacements audited with the exact modified Bostan pure function via isolated V8: **16 real/candidate pages PASS / 0 findings**. Ran **27/27 authored pure fixture callback tests** against the exact candidate source in side-effect-free JavaScript V8: PASS. The **28th private filesystem checkout test is authored but NOT RUN**; the actual Node runner, full Linux Vitest5/TS7/rootless bubblewrap, installed Windows/macOS/Linux applications and Windows PostgreSQL stress #234 were NOT run. No npm install, command execution, provider API or publication occurred.

## Remaining
This wave does not make all 57 navigable docs safe: `docs/deploy/secrets.md`, `docs/deploy/environment-variables.md`, individual adapter pages, API and operator guides still require source-aware classification and disclosure; no public docs publication. Full product release qualification and third-party licensing/provenance remain NO-GO.
