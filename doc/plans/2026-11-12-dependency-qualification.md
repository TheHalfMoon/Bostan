# Dependency qualification, 2026-11-12

Baseline main65cd014a26e79aff3dd889681b81594d6e0aecc7 passed all15 post-merge
jobs in run43125236342. No dependency PR is approved by version arithmetic or
an advisory database alone. No dependency change is qualified until its exact
integrated head passes required CI and independent review.

## Acorn 8.19.0, isolated integration of #520

Server uses Acorn in `stopped-codex-turn.ts` to parse a closed completion-script
shape without executing provider JavaScript. Its existing size, depth, node,
property and call-shape checks remain unchanged. The lock graph also shares
Acorn with MDX and unplugin. Upgrade the server pin and their existing resolved
edges from8.18.0 to8.19.0; no other package or runtime code changes.

NPMScan checked both exact versions and reported no known advisories, no registry
install scripts and no newly introduced lifecycle keys. The unchanged `prepare`
script is a source-development build hook, not a registry-install hook. Registry
metadata names MIT licensing and no dependencies. The downloaded8.19.0 tarball
matched its registry and proposed lock SHA-512 and SHA-1
`6b26fd97ce1cc9dc50bdf7ad305e9f1384d4f28a`.
[NPMScan package record](https://npmscan.com/package/acorn).

The original Dependabot diff also refreshed Smithy deprecation text and OpenCode
CPU metadata. Those unrelated changes are excluded from this integration; their
presence in metadata is not treated as a new version or proof of compromise.

`pnpm install --frozen-lockfile --ignore-scripts` PASS. Existing stopped-turn and
replacement-evidence suites:28PASS, including refusal of executable expressions,
unverified calls and prototype keys. MarkdownBody suite:55PASS. The broader
native-safe-replacement suite failed beforeAll at30seconds: its embedded
PostgreSQL template lacked `pg_notify`, then fresh-cluster fallback did not
complete in the hook budget. All59tests there were skipped, not accepted.
Independent post-run process inspection found zero PostgreSQL processes. The
failure is retained and the timeout is unchanged. Hosted full CI must establish
the database-backed recovery result. Broad local build/typecheck is not claimed.
Fresh independent correctness/parsimony/product and security reviews PASS.
The security reviewer compared the installed parser distributions as well as
the closed interpreter and rejection cases; this does not substitute for CI.

## Remaining proposal inventory

Preliminary NPMScan query covered34exact package/version pairs from17open npm
proposals, including production and development packages: @vercel/connect,
@opentelemetry/resources, dotenv, lexical, react-i18next, @mdxeditor/editor,
@github/copilot-darwin-arm64, vitest, @cursor/sdk, acorn, tslib,
@tanstack/react-query, react-resizable-panels, light-my-request, @discordjs/ws,
@types/node and @base-ui/react. All versions existed and were scanned; the tool
reported zero known advisories, no install scripts, deprecations or typosquat
signals for this direct proposal inventory. This is not a full installed-lock
or transitive audit, a maintainer/provenance attestation, or compatibility review.

Other proposals remain unqualified: #530,#529,#528,#527,#526,#525,#524,#523,
#522,#521,#519,#518,#517,#516,#515,#514,#25,#20,#18,#16,#7,#5.
The grouped OpenTelemetry trace and React/DOM proposals need exact member
inventories; GitHub Actions major upgrades need pinned-action policy and hosted
platform verification. Discord's existing patch must survive any major update.
No bulk merge or blanket approval is made. Continue one isolated upgrade at a
time, preserving failures and testing the affected behavior.
