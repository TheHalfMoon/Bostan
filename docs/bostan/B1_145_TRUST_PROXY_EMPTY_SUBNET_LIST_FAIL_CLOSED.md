# B1-145 — Fail closed on empty TRUST_PROXY subnet entries

Status: **PRIVATE DRAFT / UNMERGED / RELEASE NO-GO**. Stacked on B1-144 PR #401 at exact parent `7713eae3fa22810fca3cbe6b4940331f6f0a667d`.

## Source-backed defect

The prior `server/src/middleware/trust-proxy.ts` parsed a comma-separated trust policy using `.split(",").map(trim).filter(nonempty)`. This silently discarded empty entries. An operator typo such as `TRUST_PROXY=loopback,`, `TRUST_PROXY=,loopback` or `TRUST_PROXY=loopback,,uniquelocal` could therefore activate a nonempty trusted-proxy policy rather than fail startup. The all-empty comma case fell through to `undefined`. This is a configuration-integrity defect, **not** a demonstrated remote exploit.

## Test-first correction

- New checked-in Vitest parameterized assertions cover six malformed list spellings, plus one valid whitespace-separated list.
- Production parsing now refuses any empty entry with a static error. It does not echo raw operator input, change accepted valid subnet syntax, change the default unset policy, or introduce dependencies.
- Exact private GitHub source blob after patch: `71935d6826b93ebc1990dbe8c75ed9c317937b02`.
- Exact private GitHub test blob after patch: `b9a66cdb518d75956754ee79c6a1984e088d85ca`.

## Actually executed evidence (2026-11-01)

- Pure isolated JavaScript reproduction of the old token filtering: six malformed examples were silently reduced to nonempty lists or an empty list; corrected predicate rejected all six.
- Debian Linux model-side Node **v22.16.0** ran an isolated TypeScript parser-equivalent fixture using `--experimental-strip-types`: **14/14 PASS**, 0 failed (six malformed-list denials, five normal-policy compatibility checks, three prior malformed/oversized configuration denials).
- The fixture was created only under a model-owned ephemeral `/tmp/bostan-b145-owned-*` directory and deleted by a shell EXIT trap. No user computer or foreign files were touched.
- Re-fetched the actual private GitHub source/test after both commits and checked for the new guard, removed silent filter and authored regression cases.

**Not executed:** the exact checked-in Bostan Vitest test file, full source-native Node>=24.11 checkout, TypeScript7, actual unprivileged bubblewrap, Windows/macOS/Linux installed product, Windows PostgreSQL issue #234, authenticated HTTP #237, tenant/agent-consent and legal provenance qualification. Model-side Node22 fixture is not equivalent to full product QA; GitHub Actions were not run.

## Remaining mandatory gates

On an authorized owner-marked private checkout with preinstalled dependencies, run the actual `server/src/__tests__/trust-proxy.test.ts` suite, full server typecheck and tests, and the Bostan Linux native sandbox QA gate. Retain the existing cross-platform, security, consent, PostgreSQL and LICENSE/NOTICE release blockers.

No main merge, public visibility, deployment, release, paid services, customer data, foreign cleanup or required attribution removal.
