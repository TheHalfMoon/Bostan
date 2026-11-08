# B1-106 — Prevent explicit-port widening in local agent sandbox network allowlists

Date: 2026-10-31, Asia/Riyadh. STRICT PRIVATE, ZERO COST, NO DEPLOYMENT/PUBLISHING. Stacked on B1-105 private Draft PR #361 head `e81d4e344ba68f325653a5d25fd8fb9407c6399c`.

## A security-relevant source bug, proven RED before fix

File: `packages/adapter-utils/src/local-process-sandbox.ts`, `parseNetworkAllowlistEntry`.

An allowlist entry `https://api.example.test:443`, `http://api.example.test:80/`, or bare `api.example.test:443` explicitly **pins a port**. The code parsed it through Node `new URL(...).port`. WHATWG URL canonicalization erases the scheme's default explicit port, so the old code returned `port: null`. In the real local-process sandbox proxy, `isNetworkTargetAllowed(host,port,rules)` treats `null` as **any port** on the hostname. Thus a more restrictive input was silently broadened. This is potentially material to agent network effects on a **Linux bubblewrap sandbox with networkScope="allowlist"** (not a claim of demonstrated live exploitation).

The old parser also accepted non-HTTP origin schemes such as `ftp://...` despite the intended hostname/HTTP(S) interface.

Added explicit regression tests FIRST, commit `f636b72738ba55a432b0572d855f52b66527827e`. Actual Mac Node26 + Vitest5 **2 relevant tests RED / EXIT 1** against unchanged parser: pinned `:443`/`:80` returned unscoped hostnames, and `ftp://...` was accepted.

## Narrow source repair and security contract

Original repair commit `b082374e73c0f93401641d24c5491897d6ee0a46`, followed by a hardening commit `be6e9689c0d1b72fdee0fbd5503f7b27c97d66f1` and matching malformed-port test commit `7476e01e00a86c685b7b6943e90fbf45160e5ba6` (exact final **code-under-test** SHA).

- Keep HTTPS/HTTP origin validation and existing username, password, path, query, hash and wildcard rejects; explicitly reject non-HTTP(S) origin schemes.
- Read the raw authority's **explicit numeric port** before URL-default-port normalization can erase it. Canonicalize to 1–65535 decimal and keep the port in the rule, even for `:443` on HTTPS or `:80` on HTTP, so a pinned port does not silently become an unrestricted hostname.
- Reject malformed explicit empty ports (`https://api.example.test:` and `https://api.example.test:/`) rather than interpreting them as unrestricted.
- Preserve the existing behavior for a genuinely unqualified hostname (intentional any-port allowlist entry), and preserve valid nondefault explicit ports such as `:8443`.
- A separate Linux-only integration regression in `local-process-sandbox.test.ts` constructs the local allowlist proxy with `https://127.0.0.1:443` and asserts `CONNECT 127.0.0.1:444` returns HTTP 403 with `network_target_denied`. It is **not run** on Mac; Linux execution remains an OPEN gate. Do not misrepresent a skipped test as live enforcement evidence.

No changes to tools, proxy forwarding, workspace mounts, environment credentials, runtime sandbox permissions, packages, licensing, external services, or upstream provenance. This addresses only parser policy widening, **not** complete trusted-agent sandbox or filesystem effects consent.

## Executed Mac QA — exact final source

On authorized Mac with Node26, installed Vitest5, isolated Git worktree in `/private/tmp` at code commit `7476e01e00a86c685b7b6943e90fbf45160e5ba6`, no new downloads or cloud access:

1. Original two focused regression tests verified RED before source repair.
2. After first fix, focused `local-process-sandbox.test.ts`: **6 PASS, 12 Linux-only SKIP, EXIT 0**. Full strict `adapter-utils` package TypeScript 7 `tsc --noEmit`: **EXIT 0**.
3. Four related suites (sandbox, execution-target-sandbox, paperclip-runner-permissions and sandbox-install-command), when run with their implicit 5-second individual Vitest limit, had **197 PASS / 2 timeout FAIL / 12 OS SKIP**; **not green**. The two unrelated local execution-target payload-read tests hit the default 5-second bound; this is not evidence of a parser regression.
4. Re-running the identical four suites with explicit `--testTimeout=15000 --hookTimeout=15000`, 1 worker, on the *original* fixed source: **199 PASS, 12 OS SKIP, 4/4 suites PASS, EXIT 0** in 47.98 seconds.
5. Independently re-ran those four suites on the **final** SHA `7476e01e`, with the same explicit 15-second limits: **199 PASS, 12 OS SKIP, 4/4 suites PASS, EXIT 0** in 47.06 seconds; **full adapter-utils TypeScript 7 --noEmit EXIT 0**. This is the final qualified exact source.

## Limitations / release

No live Linux `bwrap` network-proxy test run, no installed Windows/macOS/Linux packaging or executable qualification, no full real untrusted agent effect consent/sandbox proof, no high-load stress, no full security/privacy, source licensing or NOTICE/provenance review. Remain **PRIVATE, DRAFT PR, main unmerged, overall release NO-GO**. No paid models/cloud, publishing, installer release, GitHub Actions, secrets, customer data or user-owned cleanup.
