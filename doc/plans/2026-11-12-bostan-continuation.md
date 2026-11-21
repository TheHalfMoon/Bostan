# Bostan engineering continuation, 2026-11-12

The product remains unfinished. Do not merge a failed desktop candidate or
publish, deploy, sign, notarize or create a release tag without owner authorization.

## Qualified source changes

Latest main:69be0668505cb89892d649e033b0ba2dcadc2f9c. Its post-merge
run43133641601 is pending at this checkpoint. Last completed healthy post-merge
main baseline:65cd014a26e79aff3dd889681b81594d6e0aecc7, all15 jobs in43125236342.

- #554 runtime diagnostic identity: exact9b0cb89c7abc09ecf635cd3b11213e380681dd15,
  run43128725833 all15PASS; main16d33d1195319716603f65db8f4ed6aac76e2a85.
- #553 Bostan animation/demo: exactec5239fc1c3618224bc902f307208ad86d6424b7,
  run43127773331 all15PASS; main71133e54168dc05df7f7faa0d547c466d169eb16.
- #555 Acorn8.19: exact27afdcfa67c74f96376e00598befbbd496ab412d,
  run43129732958 all15PASS; main69be0668505cb89892d649e033b0ba2dcadc2f9c.
  Older Dependabot#520 closed as absorbed. Local PG initialization failure and
  59skipped tests remain recorded; hosted database-backed recovery passed.

All received fresh independent review. Earlier #547-#552 outcomes and failures
remain in their PRs and the acceptance document. Intermediate main runs are
superseded by later main pushes; only the final integrated post-merge result
can establish the current main's health.

## Desktop candidate and next executable work

PR#542 stays Draft. Its branch work/desktop-runtime is the normal push target
of the owned work/desktop-compiled-integration branch. Parent#543 has an explicit
do-not-merge-directly gate and is already integrated through #540 ancestry.
Do not duplicate or modify another engineer's checkout.

Last native candidate4754f8f23846a4bda29e6233ed5713fd25d91e8a:
run43127504784 finished15non-desktopPASS/2desktopFAIL. Compiled Windows journey
passed. Windows NSIS reached pre_init/multiuser_ready and timed out120seconds
with an empty destination; macOS ARM64 installed and imported the compiled
backend, then failed immediately in startServer with a generic code. The owned
90second close bound failed and forced exit; it is not clean shutdown.

The next reviewed candidate includes main69be plus fixed-module/numeric-only
startup failure locations, bounded private installer-temp metadata and retention
of complete unsigned candidates after QA failure. The byte comparison reports
84of85 imported files identical to main. The only different file is pnpm-lock.yaml,
which retains the already qualified compiled Windows patch hash and existing
registry metadata; the Acorn edges match main. See DESKTOP_ACCEPTANCE.md for
the exact failure chronology and limitations.

After pushing that integrated candidate, inspect its exact17-job run. On native
failure, read the fixed startup location or private-temp counts; download only
the fixed unsigned candidate artifacts for owned-fixture investigation. Fix the
observed cause, rerun independent review and required gates. Do not enlarge
timeouts, bypass runtime equality, change atomic extraction without recovery
evidence, or treat artifact retention as installer acceptance.

Local commands from the desktop checkout:

```text
rtk pnpm --dir desktop test
rtk proxy node --test desktop/scripts/server-child-electron.test.mjs
rtk proxy node --test scripts/bostan-workflow-quarantine-gate.test.mjs scripts/bostan-private-workflow-admission.test.mjs
rtk proxy node scripts/bostan-workflow-quarantine-gate.mjs
rtk git diff --check
```

Current focused evidence:33desktopPASS/1POSIX-only Windows skip;2actual Electron
success/private-error casesPASS;23workflow checksPASS. Use hosted CI for broad
build/typecheck; the16GiB operator host hit memory limits earlier. Serialize local
model/server work and inspect free memory; never terminate unrelated processes.

## Agent evidence and remaining gates

Issue34 records the21-check persisted source text-task/session/restart success
and three genuine local read/write/denial probes. Direct tool probes at27afdcf
used Qwen2.5 1.5B, completed actual tool calls and verified unknown random file
contents and an owned output artifact. Denied canary contents were absent.
Aliases were unloaded after each run. These do not prove an installed or
persisted task with tools, API artifact registration, full sandbox isolation,
crash recovery or network silence. Keep separate journeys separate.

Remaining product gates include installed startup/onboarding/lifecycle, the
integrated first-agent tool/artifact/cancel/retry/recovery journey, multi-agent
and MCP permissions, backup/restore/update/rollback, network/privacy capture,
remaining identity migration and dependency qualification.22other dependency
proposals remain unqualified; the34-version preliminary scan is not a full
lockfile, provenance or compatibility audit. No release-completion claim.
