# B1-199 — Source workspace scope-link admission

**Status:** PRIVATE DRAFT / UNMERGED / RELEASE NO-GO. Direct parent PR #455, exact parent HEAD `d92b8e2b59ab2960177ffdc50504f288671ac50f`.

## Defect and repair

The Windows source HTTP preflight checked an ordinary repository root, each manifest, package-scoped `node_modules`, and physical `smol-toml` origin. It did not inspect intermediate workspace scope directories. A linked `server`, `packages`, or `packages/adapter-utils` directory could redirect manifest and dependency resolution to a different *in-checkout* tree while passing the origin checks. This weakens the intended SHA-owned source-workspace admission before PostgreSQL allocation.

The preflight now uses `lstatSync` to require every fixed workspace scope component to be an ordinary, non-linked directory. Missing or linked components return `foreign_workspace_scope` without creating a PostgreSQL fixture, resolving source imports, modifying files, or printing paths. Legitimate package links inside an ordinary `node_modules` directory remain permitted, including in-checkout pnpm-style links.

## Test-first evidence

- Exact original GitHub helper blob `352acc7f6cbd2db1a2750f1737966e0f12c607c0` was reproduced byte-for-byte in an exclusive Linux Node 22 fixture. Five new native filesystem cases: **2 PASS / 3 expected RED** before the fix (linked scope and linked ancestor accepted).
- Fixed helper blob `ff8bb1f2d3f9cb92f1e872f589f22d43a9c6d8d3` and committed regression blob `b7f18ee3cf4eaea61df9dea04e7bd1745d111504` match local git object hashes. **5/5 new tests PASS**; six existing source dependency tests selected with the same helper also PASS (**11/11 total, zero skipped**). The existing runner-order integration test was not selected locally because the isolated fixture does not include the full HTTP runner.
- `node --check` passed for the helper and new test. No native Windows, actual PostgreSQL, installed workspace, full TS7/Vitest, compiled HTTP or Chromium was run.

## Limitations

This validates static scope ancestry at preflight time, not atomic immunity to privileged concurrent junction swaps or the complete provenance of all dependencies. It does not install missing third-party `smol-toml` dependencies and does not close #237. The Windows device quota remains respected; `D:/Bostan-B212-qa` remains retained and unverified. #234 forced-crash zero-orphan, #237 compiled authenticated HTTP/Chromium, Linux bwrap, Mac/Linux PostgreSQL, installed three-OS acceptance, privacy/consent/security and donor licenses remain NO-GO. No main merge, Actions, publication, deployment, paid provider or customer data.
