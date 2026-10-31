# B1-112 — Fail-closed source-native Linux sandbox qualification

Date: 2026-10-31, Asia/Riyadh. **PRIVATE, zero-cost, no release/deploy/publish.** Stacked on private Draft PR #367 (B1-111), exact parent HEAD `7f2e28708a4ac55bb32cf199f18fd8ed42e7521b`.

## Problem addressed

B1-106 through B1-111 fixed several local-agent sandbox network-boundary issues (explicit origin port widening, invalid CONNECT TCP ports, normalized origin suffixes, client proxy credential leaks, Connection-nominated hop header leaks, and exact bracketed IPv6 target matching). Some are **only proved by independent extracted-logic tests** because the user's Desktop Commander monthly quota was exhausted; actual Bostan Vitest suite, full adapter-utils TypeScript and genuine Linux bwrap tests on that cumulative candidate remained **UNRUN**. No additional parser patch without source-native qualification should be deemed release-ready.

This B1-112 addition is a safe local qualification command, not a completed qualification result.

## Runnable command, preconditions and contract

`scripts/bostan-private-linux-sandbox-gate.sh`:

- Default `--plan`: prints admission requirements and performs **no work or network access**.
- `--run`: only on native Linux from the **script's own repository checkout**, with the private `TheHalfMoon/Bostan` origin identity (reject foreign URLs, including credential-bearing URLs), an existing owner-created `.bostan-linux-qa-owned` file with the exact single line `BOSTAN_QA_OWNED`, root package identity `bostan`, and the Git commit's exact source and test Git blobs pinned from B1-111. The command also refuses uncommitted modifications to these test files.
- Current pinned source `packages/adapter-utils/src/local-process-sandbox.ts` blob `6ea8184f05437f0391dc6dad2d923c9795c86be5` (**B1-115**, cancels abandoned proxy HTTP upstream; previous B1-111/B1-114 pin `200da80d364053aa984d83d66864b02e99258f79`).
- Current pinned test `packages/adapter-utils/src/local-process-sandbox.test.ts` blob `d55dec16db77df53fb1c26a3901f713e12e3975b` (**B1-115** includes cancellation regression, retains B1-113 CRLF correction; previous test pin `fa96f8055107500cdc8b608740ac08a523637b3b`, original B1-112 pin `c6194975c177986d80a3a4add92bd479a8bbdcf0`).
- Requires **preinstalled** Node >=24.11, repository-local Vitest and tsc, Linux `bwrap`, GNU `timeout`, >=2 GiB free RAM and >=2 GiB free QA disk. Nothing is installed or downloaded by this command.
- A bounded 15-second unprivileged Linux `bwrap --unshare-net` probe rejects kernels/container runtime where this sandbox cannot be established. **Never add privileged flags, modify user namespace sysctls or override security policy** to force a green result.
- On successful admission: run the four actual repo suites `local-process-sandbox.test.ts`, `execution-target-sandbox.test.ts`, `paperclip-runner-permissions.test.ts`, `sandbox-install-command.test.ts`, 1 Vitest fork worker, explicit 15s test/hook limits, 360s overall timeout; then `tsc -p packages/adapter-utils/tsconfig.json --noEmit` with a separate 180s bound. Emit `BOSTAN_B112_LINUX_GATE_PASS` **only if every gate actually passes**. Otherwise print `BOSTAN_B112_ADMISSION_REFUSED` and nonzero exit for any preflight failure; tests themselves may create test-only temp files as defined by the project. No automated user data deletion, installation, downloads, publish, GitHub Actions, or main merge.
- Run only in an approved, disposable, privately owned QA checkout. The command does **not** create the checkout, marker, dependencies or temp directories on user machines. The source/test blobs are frozen; changing them intentionally requires an audited subsequent gate revision.

## Evidence actually executed

In the isolated model-side Linux workspace (NOT the user's Mac or Windows), the exact Bash script underwent:

1. `bash -n` **PASS** (syntax).
2. `--plan` **EXIT0**, with clear conditions and no execution.
3. `--run` from outside the correct repository **REFUSED** before any test.
4. Four explicit negative-admission cases on an **owned, disposable synthetic Git repository** with script, synthetic `bostan` package and controlled origin: missing owner marker (EXIT1), missing remote (EXIT1), wrong repository remote (EXIT1), correctly named remote but wrong Git source/test blob (EXIT1). All **4/4 expected refusals PASS**. The temporary synthetic repo was cleaned up by its own marked shell test; no files on the user's computers were touched.

**This is admission-policy and script syntax qualification, NOT real Bostan test qualification.** The model container has Node22 and no installed bwrap or private Bostan checkout, and the connected Desktop Commander tool had explicitly rejected further requests after reaching its monthly quota. Its being paired/online does not imply the quota is restored. No native Linux bwrap execution, real private repo Vitest, package-wide TS, installed Windows/macOS/Linux binary, Postgres stress, agent effects consent, or source license NOTICE/provenance review was performed in B1-112. All remain open.

## Authorized execution in a later qualified native Linux QA checkout

After preparing a **separate private QA worktree** at the correct B1-112 PR head with dependencies already installed and only necessary synthetic test data, its owner can place a disposable local marker in the QA root:

```sh
printf 'BOSTAN_QA_OWNED\n' > .bostan-linux-qa-owned
bash scripts/bostan-private-linux-sandbox-gate.sh --plan
bash scripts/bostan-private-linux-sandbox-gate.sh --run
```

Do **not** run in an unrelated checkout, in production, with customer data, or with privileged sandbox options. The command uses no installation or external network. Real results must be recorded against the exact qualifying SHA, and failures remain failures, not skipped gates.

## Remaining gates / release

- Actual native Linux source+test SHA qualification with the new script and full (not just focused) sandbox/agent side-effect control; rootless bwrap that genuinely enforces filesystem/network policies.
- Installed packaged Windows, macOS and Linux product and consent/takeover checks.
- Repeated Windows real PostgreSQL stress/crash/restart and orphan-proof evidence (issue #234), tenant isolation, privacy/security and license/NOTICE/provenance.

**Keep repo PRIVATE, new PR DRAFT and UNMERGED, main unchanged, Actions disabled, zero cost, release NO-GO.**
