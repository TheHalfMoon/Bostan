# B0-20 — Windows clean-stdin free-model admission before first agent

**Private Draft only. No release or merge.**

## Proven failure mode and successful native diagnostic

On the authorized Windows computer with Node 24 and OpenCode 2.1.2,
running the provider through an inherited interactive/background stdin
previously produced **zero output for over two minutes**. Catalog listing
worked but was not evidence of inference. A clean diagnostic run in an
isolated disposable TEMP HOME and empty workspace, with stdin already at
EOF, used **only** `opencode/deepseek-v4.1-flash-free`, no provider keys,
and returned the requested synthetic output marker with exit code **0** in
approximately **6.37 seconds**.

Upstream OpenCode issue anomalyco/opencode #38723 independently reports
headless runs hanging while stdin remains open (including Windows), plus
a distinct OpenCode 2.1.2 Windows issue where extremely large Git untracked
worktrees can freeze initialization. These are plausible triggers; no
exclusive root cause has been demonstrated for our earlier Windows test.

## Implementation

- Added a standalone free-provider admission command that creates a *fresh*
  TEMP-only HOME and EMPTY cwd, with stdout/stderr captured under a size cap,
  stdin explicitly closed (EOF) from child start, and a **bounded** deadline.
- Each invocation requires explicit free online-model consent, a real
  pre-existing temp profile, an absolute native OpenCode executable path,
  and the existing strict **two-model allowlist**. Paid/unrecognized models,
  user OpenCode config, inherited API credentials, repo plugin discovery,
  public URLs, and unbounded waits are refused.
- The Windows timeout path kills only the newly spawned test child process
  subtree, rather than broad termination of all existing OpenCode sessions.
  No user-wide process cleanup or app config migration.
- Model qualification requires exit 0 **AND an exact JSONL type=text
  assistant part** with the marker; merely echoing the requested string in
  a prompt, log, or malformed JSON cannot constitute model success.
- Windows first-agent E2E now automatically performs the bounded provider
  admission **before creating a synthetic Bostan company or agent**.
  macOS existing qualified first-agent behavior is unchanged.
- The command never claims catalog listing is inference, and never promises
  zero future charges based solely on a free-labeled model ID.

## Important usage contract

Use only a development Bostan source checkout with a pre-existing,
already-authorized disposable TEMP HOME and explicit opt-in:
`BOSTAN_E2E_CONFIRM_TEMP_DATA=1`,
`BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1`,
`BOSTAN_E2E_DISPOSABLE_HOME=<existing TEMP HOME>`,
`BOSTAN_E2E_OPENCODE_EXE=<absolute trusted opencode.exe>`.

Standalone preflight: `node scripts/bostan-opencode-free-admission.mjs`.
This is an **online** free-labeled model. It is not local offline inference.

## Verification limits

The prior **direct clean-stdin Windows** model probe passed in 6.37s.
Unit tests cover strict JSON replies, EOF stdin, bounded synthetic hanging
children, refusal of unsafe HOME and paid models, isolated environment and
absence of prior-provider credentials. Actual Windows execution of the
new reusable standalone preflight and full native Bostan agent workflow
must be recorded independently. Full Windows native agent qualification
is not inferred from a direct model probe.

Release **NO-GO**. No publishing, main merge, deployment or enabling Actions.
