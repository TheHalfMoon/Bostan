# B1-108 — Reject normalized allowlist origin suffixes before port policy parsing

Date: 2026-10-31 (Asia/Riyadh). PRIVATE, zero-cost, nonpublishing. Stacked on B1-107 Draft #363 at exact parent `89c3ab7c50d5a83674d2b5c93a43a53e2fbf4bf0`. No main merge, release, deploy, Actions, paid provider, customer data, or user-machine cleanup.

## Concrete security regression

B1-106 correctly preserved explicit default HTTPS `:443` and HTTP `:80` for canonical origin inputs. However, the parser used `new URL(...)` to check `pathname === "/"` and then inspected the original authority using a trailing-slash-only trim. WHATWG URL canonicalizes dot segments (`/.`, `/..`, `/%2e`) and backslashes into a root pathname; it also strips embedded ASCII tab, LF and CR characters. Consequently, inputs such as `https://api.test:443/.` or `http://api.test:80/.` passed the path check but did not match the raw `:(\\d+)$` authority suffix. Since `URL.port` drops the scheme's default port, the fallback became `port: null`, interpreted by the proxy matcher as **ANY port**. This defeats the explicit port boundary for those malformed allowlist entries.

## Reproduction and repair

Native isolated Linux Node.js v22.16.0, with a literal copy of the relevant existing parser logic (not the checked-in TypeScript module): six adversarial origin strings were accepted and returned `{ hostname: "api.test", port: null }`. Inputs included `https://api.test:443/.`, `/..`, `/%2e`, a backslash suffix, `http://api.test:80/.`, and a host:port `/.` suffix. **RED: 6 unsafe accepts reproduced**.

The parser now examines the unnormalized raw authority first and allows either no path or exactly one trailing slash. It rejects backslashes, query/hash delimiters, ASCII control/space bytes and other suffixes before extracting the explicit port. This preserves canonical `https://host:443/`, `http://host:80/`, host-only any-port legacy policy, IPv6 authority syntax and valid nondefault port entries. Invalid entries continue to fail closed with the existing generic allowlist error. No new dependencies or external network access.

A native Linux Node.js v22.16.0 isolated copy of the repaired logic passed **18/18** assertions: 12 malformed suffix/control denials plus 6 canonical/legacy accepts. No file persisted from either standalone test. These are **standalone reproductions**, not Bostan Vitest or native bubblewrap qualification.

Checked-in regression in `packages/adapter-utils/src/local-process-sandbox.test.ts` covers normalized dot-segments, percent-encoded dot, backslash, embedded tab/LF/CR, empty query/hash delimiters and canonical origin acceptance. Source fix in `packages/adapter-utils/src/local-process-sandbox.ts`. Both changes are in this private Draft PR.

## Objective qualification status and remaining gates

- Actual GitHub repository PRIVATE, main unchanged at `6f6af14a4c9157152d35acd2dcde7ccd1ee9152a`; main branch metadata reports `protected:false`. Protection endpoint returned 403 for this integration; private rulesets returned 403 with upgrade/public requirement. Do **not** pay or make public.
- Desktop Commander Mac and Windows devices were listed online, but remote MCP monthly quota returned **0% left**. Therefore **no source-native Bostan Vitest, adapter-utils TypeScript, Windows, or Linux bubblewrap run** was possible in this wave. Do not claim those tests passed.
- B1-107 native CONNECT port and B1-106 explicit-port source changes remain stacked below this repair; full installed-app and cross-platform sandbox/consent/security gates are NOT qualified.
- Before any merge/release (currently prohibited), run the checked-in regression and full adapter-utils TypeScript check on exact source, then a genuine native Linux bubblewrap/proxy test confirming malformed origins never grant CONNECT to another port. Also retain license/NOTICE/provenance, privacy, PostgreSQL stress, installer and offline-agent effect gates.

**Full Bostan release: NO-GO.** Keep this PR Draft, unmerged and repository strictly private.
