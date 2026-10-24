# B3-02a — Independently reread local artifact bytes in a company-scoped workspace

**Private development, October 24, 2026. Not a provider/browser effect verifier.**

## Actual readback, copied from the source authority

B3-01 correctly reports that an upstream success is not independent evidence of
external effects. B3-02a now performs one **actual secondary read** for a
trusted, company-scoped local file artifact. This is copy-first: it reuses the
original runner's `openRunnerApiWorkspaceFile` and canonical
`execution_workspaces` + `tool_invocations` tables; it creates no separate
task, credential, budget, workspace, or invocation authority.

A strictly human-board authorized endpoint:

`POST /api/tool-gateway/bostan-local-file-readback`

Accepts only `{companyId, invocationId, workspaceId, relativePath,
expectedSha256, expectedByteSize}`. Requires both `tools:view_audit` and
`tools:manage_runtime` and the ordinary company access gate; **agents are
forbidden**. The root path is NEVER accepted from HTTP or a tool result:
it must come from an **active, local_fs** workspace record, for the same
company and exactly the same original issue linked to a matching tool
invocation. A missing/foreign/unrelated workspace-invocation pair returns 404.
Only completed invocation statuses are eligible; no pending dispatch is
presented as an actual post-execution artifact.

The trusted local verifier requires a bounded, normalized relative path and
SHA-256 plus exact expected byte count. It rejects path traversal, absolute
paths, backslashes/control bytes, empty path segments, final/intermediate
symlinks, hardlinks and unsupported file types. An imported no-follow file
opener rejects symlinks at **every path component** on macOS/Linux. The
service reads a max 8 MiB file through its already opened file descriptor,
hashes the actual bytes, checks file identity/size/mtime/ctime before and
after read, and compares the observed digest in constant time. It does
not return actual bytes, filesystem paths, private hash values or any
external response text.

Possible safe statuses include `matches_expected_content`,
`content_mismatch`, `file_missing`, `unreadable_or_unsafe`, and
`changed_during_read`.

**A matching artifact digest confirms only that a file with those exact bytes
was independently observed at check time. It does NOT prove which tool wrote
it, that there was an actual mutation, or that the requested side-effect was
authorized or completed.** Every response retains
`independentEffectVerified:false` and `autoRetrySafe:false`; it is read-only
and does not execute, repeat or reconcile external operations.

## Actual QA — macOS and real isolated PostgreSQL

`BOSTAN_TEST_POSTGRES_BACKEND=system pnpm --filter @paperclipai/server exec vitest run src/__tests__/bostan-action-evidence-status.test.ts --maxWorkers=1`

**9/9 PASS**, zero skips/failures: 3 preexisting B3-01 classifiers, 3
actual temporary-local-filesystem tests, and 3 real SQL/HTTP Tool Gateway
integration tests. Readback sees real saved bytes; a subsequent source edit
is detected despite the unchanged upstream result hash. Rejects file escape,
symlinked directories/files, cross-root hardlinks, malformed path/hashes,
oversized requests, missing files and file length mismatches. SQL/HTTP tests
prove board-only permission, no exposure of root path/content/hash, company
scope, origin-issue match, refusal of foreign invocations and agents.
All test files and PostgreSQL test instances are temporary.

## Remaining hard gates

- **Not yet supported on Windows** by the reused confined opener; do not
  silently downgrade security to pathname-only checks.
- This is a readback of **local** files; remote browser, cloud connectors,
  API state and provider-specific readbacks are not qualified.
- Expected digest is an authorized board-supplied value, NOT automatically
  derived from a signed before/after intent; an existing matching file can
  produce the same result as an actual new write. True effect attribution,
  independent verifier identity and durable signed evidence receipts remain
  the next B3 requirement.
- The application must still enforce machine consent, local workspace policy,
  concurrency/revocation at any future dispatched action. This endpoint only
  reads and does not grant actions. File replacement races not resolved by
  the imported no-follow opener and fstat checks remain part of additional
  adversarial/concurrency qualification.
- Full backend TypeScript, latest Windows first-agent E2E, Chromium browser,
  real model orchestration and B3-B6 overall remain incomplete.
- Repo private, Actions disabled, Draft PR, main unchanged. No paid provider,
  deployment or public release. **NO-GO.**

## Local app cold-start qualification — explicitly open

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
was attempted on this B3-02 source head and **FAILED (exit 1)** during cold
app start, before testing persistence. The nested Mac source launcher enforces
a 90-second `serverStartupProbeLimit`, while the original smoke gives the
whole startup 115 seconds. The fresh source process took longer than that
under this Mac's load; PostgreSQL itself initialized and shut down cleanly.
A separate authorized private-local replay using the preserved synthetic QA
HOME **did reach HTTP 200** (no external access), then shut down cleanly when
the bounded diagnostic window ended. These observations do **not** qualify
the complete first-start/restart persistence E2E on this latest head.

This is an independent local startup qualification blocker, not a failing
B3-02 readback or PostgreSQL API assertion. It is assigned to a separate
cold-start runtime gate; do not obscure it by calling the smoke PASS.
