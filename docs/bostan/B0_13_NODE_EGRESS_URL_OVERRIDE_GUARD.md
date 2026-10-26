# B0-13 — Fail closed on overriding a loopback destination in Node QA

Private Bostan development, 26 October 2026, stacked on B0-12 / PR #161. NO merge to main, release, deployment, paid models, GitHub Actions or changes to legally required upstream notices.

## Gap discovered in the B0-12 disposable source guard

B0-12 added a test-only Node ESM preload limiting known network APIs to loopback. A private URL alone is not a complete network admission decision: Node HTTP/HTTPS request(url, options) accepts extra options that may replace the host, resolve the nominal local host to an arbitrary remote IP through a supplied lookup callback, or route through an opaque custom agent/createConnection function. Equivalent opaque overrides exist in HTTP/2, raw TCP/TLS options and fetch dispatchers.

The earlier guard examined the FIRST URL/address only. It could therefore produce false-positive local-only QA evidence if the second options argument redirected traffic. This is a qualification-test gap, not proof that normal product runtime currently uses the bypass.

## Explicitly test-only patch

Enhance the B0-12 guard with assertPrivateNodeQaConnectionOptions. When the explicit disposable Node preload is active, it now refuses:
- A local HTTP(S) URL paired with a second options argument specifying any non-loopback hostname or host
- A user-supplied DNS lookup or custom createConnection/createSocket hook in known connection APIs
- Opaque custom HTTP agents in place of the known Node built-in global agents
- An opaque fetch dispatcher/agent that could route a local URL somewhere else
- Non-local socketPath overrides where a URL is provided

Every refused attempt adds only a fixed network CATEGORY to the private test receipt, never the URL, hostname, auth, prompt or payload. An intercepted request fails the final positive QA receipt even if application code catches the rejection. The normal Bostan runtime and user-authorized external integrations are UNCHANGED.

## Negative and real evidence

- Focused unit+real subprocess tests: 4 PASS, 0 FAIL. In particular, multiple HTTP(S) loopback URLs with remote host overrides, custom DNS lookup, custom HTTP agent, HTTP2 connection override, TCP custom lookup and Undici fetch dispatcher are rejected by an actually preloaded subprocess.
- Existing checks still allow ordinary loopback requests and disallow direct non-loopback destinations.
- Native Mac source Node suite: 181 PASS, 0 FAIL, 10 platform/opt-in SKIP (191 total).
- Real disposable Bostan source server, PostgreSQL clean stop/restart with persisted company and headless Chromium under both test guards: PASS; two armed server processes, 0 recorded blocked Node calls and 0 browser page errors/external requests.
- Windows native source verification is recorded upon final-head tests.

## Qualification limits

This is not an OS egress firewall. Native executables, uninstrumented transport code, alternate DNS systems, custom binaries, external model tools, direct syscalls, worker processes that do not inherit the preload and other network mechanisms remain outside this proof. The complete B0-05 network inventory and system/agent egress qualification remain open. The official full server build, free-model-led native signed governed Case and terminal closure, installed Windows app and independent full security review are NOT release-qualified. Release remains NO-GO.
