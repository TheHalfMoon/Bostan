# B1-10 — Bound Windows authenticated health JSON body by one request deadline

Date: 2026-10-29 (Asia/Riyadh). PRIVATE Bostan stacked on B1-09 Draft PR #261 at verified exact head `9125cd2fccd48fa407859ca0742e337e6790fdf4`. This is source-level QA reliability hardening, not a native Windows release qualification. No main modification/merge, deployment, publication, GitHub Actions, paid models/cloud, customer data or operator-file cleanup.

## Reproduced false-green in B1-09

The previous `scripts/bostan-private-windows-health-wait.mjs` used `AbortSignal.timeout()` for `fetch()` but awaited `response.json()` without independently bounding it. In an isolated Node 22.16.0 run using **exact original GitHub blob** `e735732e47193a8715164d7ec0919399bc04c729`, a simulated HTTP 200 health response whose JSON parse completed at synthetic monotonic `now()=120ms` despite a configured `timeoutMs=100` yielded **`{healthy:true,outcome:"healthy",elapsedMs:120}`**. The owned child could also exit during JSON parsing and still return green. An injected fetch or JSON parser that ignored AbortSignal could hang indefinitely; a real localhost HTTP 200 with an incomplete JSON body is a practical variant. This is a reproducible **unit-level** false-green, not evidence that the user's Windows server misbehaved.

## Fix and invariants

- Each probe now uses **one ref'd timer and one AbortController** spanning both HTTP headers and full JSON parsing. `awaitAbortable` races the async operation against the abort event, handles late promise settlement without unhandled rejections, and cleans its abort listener. This remains bounded even if an injected fetch or body parser ignores the abort signal; native fetch receives the same controller signal. The timer is always cleared in `finally`.
- A complete private/authenticated/bootstrap-pending health JSON cannot qualify if the **owned child exited**, the probe's controller was aborted, or the **monotonic startup deadline has elapsed** before the success receipt.
- Retains exact loopback-only URL allowlist, no response-body logging, 180-second overall deadline, maximum 1.5-second per-request timeout, probe cap and fail-closed HTTP semantics.
- The localhost test fixture explicitly closes all test-server connections so intentionally stalled JSON bodies cannot hang the test runner.

## Actual isolated local evidence

Local scratch `/mnt/data/bostan-b110-isolated`, Linux Node **v22.16.0**, ~30 GiB free isolated filesystem, ~4.7 GiB available RAM; no native Mac/Windows connection, PostgreSQL, browser, install, cloud, model or customer data. Files were constructed from the exact GitHub source blobs and verified with `git hash-object` before and after edits.

| Artifact | Exact local git blob = GitHub blob |
|---|---|
| Original module | `e735732e47193a8715164d7ec0919399bc04c729` |
| Original tests | `9c478f431439c8e16410bacae58c0ab36b85e363` |
| Fixed module | `9d393f1efbfaffe6e5c648b6290f2e5ef6971f80` |
| Fixed tests | `cd7c1b874ba21ca008f3224e7f2726919e5ba087` |

- Original exact source `node --test`: **8/8 PASS**, but missing these cases. Direct original-source reproduction returned `healthy:true` after the configured deadline as above.
- Final exact-source `node --check`: **PASS**.
- Final `node --test bostan-private-windows-health-wait.test.mjs`: **13/13 PASS**, 0 failed/skipped/cancelled, twice independently observed (~402–407ms). Eight retained tests and five new regressions: (1) late valid JSON rejected, (2) owned child exits during JSON rejected, (3) fetch never settles/ignores signal bounded, (4) body parser never settles/ignores signal bounded, (5) **actual local Node HTTP 200** sends incomplete JSON and stalls forever; probe returns fail-closed within bounded time and owned server closes. The fifth case uses a **real localhost HTTP server**, not native Bostan/Windows.
- This branch changes only health wait helper, its tests and this evidence report. Native Windows server, real PostgreSQL, actual Windows `Get-CimInstance`, PowerShell, compiled server and full runner suite were **NOT RUN**.

## Remaining NO-GO gates

Native Windows 16-stage authenticated/private HTTP with real PostgreSQL migration, first-admin/CSRF, child teardown, independently verified zero orphan/unattributed `postgres.exe`, memory/disk admission and Windows Chromium Playwright remain unqualified (Issues #234 and #237 OPEN). Last observed Windows C free ~0.323 GiB, below >=2 GiB system guard; isolated workspace and TEMP each require >=6 GiB; RAM on Windows unmeasured. Authorized Desktop Commander quota exhausted Oct 28; do not retry/circumvent. Later with authorized access and adequate resources, use a fresh marker-owned `Bostan-B110-qa` checkout and matching `Bostan-B110-temp`, Node>=24.11 frozen dependencies; never delete operator files or terminate unrelated processes.

Native Mac retake, Chromium E2E, reproducible compiled server build, first zero-cost live agent workflow, Windows/Mac installers, independent security/licensing and backup/recovery are separate open release gates. **Bostan remains PRIVATE Draft only; `releaseQualified:false`, release NO-GO.**
