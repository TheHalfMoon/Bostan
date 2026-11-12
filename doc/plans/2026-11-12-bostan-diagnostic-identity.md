# Runtime diagnostic identity, 2026-11-12

Related: #35, #4, #34. Baseline: main65cd014a26e79aff3dd889681b81594d6e0aecc7,
whose 15 post-merge jobs passed in run43125236342.

New server, adapter and browser runtime diagnostic messages use `[bostan]`.
The owning producers retain their existing logging and redaction boundaries;
only the prefix changes. No shared logger or additional dependency is introduced.
The bulk edit was parsed and compared with Babel: 52 production TypeScript ASTs
differ only in string/template prefix text. Environment variables, protocol names,
stored settings, auth behavior, historical receipts and profile fixtures are unchanged.
The Codex auth-merge shell helper's fixed missing-Node error uses the same new
prefix; its stderr destination and refusal status are unchanged.

Seven reader sites accept the old and new prefixes: Codex meaningful-stderr
selection, sandbox transfer status formatting, Hermes final-response cleaning,
Hermes source and packaged CommonJS transcript parsers, and both UI transcript
notice filters. Existing recorded logs therefore keep their classification.
New messages do not become assistant answers or replace a real provider error.
The adapters and transcript modules continue to own these interpretations.

Local Windows checks: six focused suites, 62 PASS; both marker forms are covered
through Codex error selection, Hermes source and actual packaged parser, and
transcript normalization. Negative cases retain real errors and reject similar
but different prefixes. Required token gates and palette/character sync PASS.
The new actual Hermes subprocess cases both failed locally with spawn EFTYPE:
the existing capture fixture is a shebang script rather than a Windows executable.
The sandbox progress case failed its POSIX-only absolute-path confinement assertion
on the Windows temporary path. These failures are retained; Linux CI must exercise
them, and no local full-runtime success is claimed. The initial edit helper could
not resolve the TypeScript compiler API; it made no changes and was replaced by
the already installed Babel parser.

Fresh independent correctness/parsimony/product and security review PASS,
including the final shell literal delta. Full exact-head CI is required before landing. This slice
does not complete branding migration: compatibility-sensitive environment/home,
schema, scope, cookie and runtime identities need separately verified migration.
Developer/install helper script prefixes and their command guidance remain a
separate tooling surface; the active runtime scope here is server, adapters and UI.
Installed desktop, real agent tool/artifact, data recovery and release qualification
remain open. No publication or release gate is enabled.
