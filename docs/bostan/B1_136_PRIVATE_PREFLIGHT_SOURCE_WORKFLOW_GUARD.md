# B1-136 — Private Bostan safety preflight wired into normal source workflows

Status: PRIVATE / ZERO-COST / DRAFT UNMERGED / RELEASE NO-GO. Direct parent is B1-135 PR #392, exact c2f5de0f6ab51301fa531d5af9f98964cdab8da4. Main untouched, Actions disabled, no docs/package publication, deployment, external paid provider, customer data, or legal attribution removal.

## Confirmed integration gap

B1-131 through B1-135 introduced real standalone zero-dependency docs and UI-brand admission checkers. But the root build, typecheck, and test:run scripts did not call either checker. A contributor could inadvertently reintroduce an unsafe donor installation instruction or donor chat icon and receive green regular source workflows without the checks ever running.

## Bounded engineering repair

Added scripts/bostan-private-preflight.mjs, which uses the **actual existing** auditBostanDocsCheckout and auditBostanUiBrandCheckout. It runs both even if one refuses, rejects malformed checker return values, and redacts unexpected exception messages to avoid revealing filesystem paths or credentials. Invoked before package-manager dependency work by root build, typecheck and test:run, while retaining all existing preflight, build, typecheck and Vitest commands unchanged afterward. Added check:bostan-private-preflight and test:bostan-private-preflight root scripts, plus seven authored Node built-in node:test cases.

## Actual execution and limits

On an owned ephemeral isolated Linux Node **v22.16.0** workspace, ran the equivalent exact newly authored source and seven test bodies with the **real Node built-in native test runner**: **7/7 PASS**, zero failed, and CLI printed BOSTAN_PRIVATE_PREFLIGHT=PASS. This was a **synthetic wiring harness** with stub checker modules, not the exact private full repo checkout. The two actual Bostan docs/UI checker APIs were independently verified present at #392 by fetching their exact GitHub sources; previous branch pure-data audits were green but are not the same as native Node/installed app qualification.

The isolated runner Node22 is below Bostan's minimum Node 24.11; **no qualified Node24 native checkout test, full build, TS7, Vitest5, genuine unprivileged bwrap, Windows PostgreSQL stress, installed app or agent consent/privacy tests ran**. Do not misinterpret 7/7 synthetic harness as release qualification.

## Required native follow-up

Use authorized private source worktree with preinstalled Node>=24.11 and checked-in lockfile; run:
1. node scripts/bostan-private-preflight.mjs
2. node --test scripts/bostan-private-preflight.test.mjs
3. node --test scripts/bostan-private-docs-entry-gate.test.mjs
4. node --test scripts/bostan-private-ui-brand-gate.test.mjs
5. Only when environment is qualified, run source-native Linux four Vitest5 suites, TypeScript7 and genuine rootless bwrap, preserving evidence.

Do not bypass checks on failure. Preserve release NO-GO pending native Windows PostgreSQL #234, installed Windows/macOS/Linux, governed agent effects, privacy/tenant isolation and third-party legal provenance/NOTICE.
