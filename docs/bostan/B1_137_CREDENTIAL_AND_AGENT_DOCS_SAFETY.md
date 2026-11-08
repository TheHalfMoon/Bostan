# B1-137 — Credential and provider docs safety

PRIVATE / ZERO COST / DRAFT UNMERGED / RELEASE NO-GO.

## Verified risk at parent
The three directly navigable private GitHub pages deploy/secrets, deploy/environment-variables and adapters/claude-local still offered donor-specific secret migration, provider keys, hosted/paid infrastructure and executable agent commands. They were outside the existing Bostan docs preview auditor. An annotated Bash fence in the existing quickstart could also bypass the old terminal command scanner.

## Bounded changes
Replaced only these three high-risk user-facing pages with non-executable Bostan preview safety boundaries. Extended the zero-dependency docs auditor to require all three, forbid terminal instructions, and require explicit no-credentials and zero-cost disclosures. Terminal extraction now covers annotated and tilde fences. Added eight regression tests. Internal compatibility identifiers and upstream required legal notices are not removed.

## Actual verification
Executed 35/35 authored pure fixture test callbacks in an isolated V8 JS harness, 0 failures. Reproduced the previous annotated-fence false green and verified the patched scanner refuses it. Verified the candidate safe fixture returns zero findings. The final filesystem-dependent source-native checkout test was authored but NOT RUN; the full checked-in Node test suite and full GitHub Markdown snapshot were NOT run in this wave. Linux Vitest5, TypeScript7, rootless bwrap, installed Windows/macOS/Linux, repeated real Windows PostgreSQL stress #234, consent, privacy and legal provenance remain unqualified. No device access, download, paid provider, customer data, merge, deployment, publication or Actions. Release NO-GO.
