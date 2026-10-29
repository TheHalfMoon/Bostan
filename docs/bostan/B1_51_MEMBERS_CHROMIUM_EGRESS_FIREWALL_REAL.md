# B1-51 — Members Chromium context-level egress firewall

Date: 2026-10-29. STRICT PRIVATE, ZERO-COST, NONPUBLISHING. Exact parent B1-50 Draft #304 at `a62dbff7561bb5f8a0fa696b51f44653afd145f3`.

## Change

The real Members UI Chromium test helper previously registered a `page.route('**/*')` interceptor only on its main page, missing some requests from popups and WebSockets. This is a QA privacy/coverage risk, not a claim of observed third-party egress. Instead of creating another firewall, Members now reuses the existing proven `installPrivateBrowserNetworkCapture` and `assertPrivateBrowserEgressEvidence` in `scripts/bostan-local-browser-qa.mjs`: context-wide interception of HTTP/HTTPS (including first popup requests), WebSocket attempt blocking, and JavaScript errors on all created pages. Exact loopback request origins are admitted; any attempted external network access counts as a failure even when aborted. The browser remains owned and closes in its existing finally clause.

Added test-only fake Playwright context in `ui/scripts/bostan-private-members-browser.test.mjs`: a same-origin request is allowed, a synthetic external HTTP request is blocked, a synthetic external WebSocket handshake is refused, the page's invite workflow fails closed, and the exact owned browser closes once. It performs no live network call. No production application or auth data is changed.

## Actual evidence

- Native **Mac** focused B1-51 Windows/Member/QA test suite: **11/11 PASS**.
- Real **Mac Chromium** negative egress probe with existing pinned local Chromium, explicitly enabled `BOSTAN_REAL_BROWSER_EGRESS_NEGATIVE_PROBE=1`: **13/13 PASS**, no skips; verifies external HTTPS, popup request and external WebSocket are blocked by the existing shared context firewall before going to network.
- Native **Windows 11** B144 isolated QA at source commit `93782a79670366f6dc94bfee24b6c9f71cd5dc0e`: B1-51/Member/QA tests **11/11 PASS**, no skipped tests, clean tracked source, no PostgreSQL process.
- Native **Windows 11 real Chromium** negative egress probe with its pinned QA-only browser cache: **11/11 PASS**, no skips, exit 0 (~1.42s); exact same synthetic external HTTP, popup and WebSocket blocking with no outgoing third-party request. No PostgreSQL started. Free RAM admitted at 3.17 GiB, below B1-50's heavier real PG + UI memory gate; no memory guard bypass.

## Limits

This security hardening does **NOT** qualify B1-50's combined Windows real PostgreSQL/Better Auth/member-invite/promotion/suspension full E2E. That gate remains pending >=4 GiB available RAM and verification of all original HTTP/PG security and cleanup receipts. B1-49 actual Windows signup/first-admin was previously GREEN. Remaining product gates: members E2E, offline free agent, native installers/Linux, multi-suite PostgreSQL concurrency, and independent security/privacy/licensing/provenance. Release is NO-GO. No publish, deploy, npm pack, GitHub Actions enablement, protected-main merge, paid inference, customer data or unrelated process/file manipulation.
