# B0-27 — No inherited upstream Cloud broker admission

**Private development. No real Bostan Cloud broker is provisioned or qualified.**

## Why

The imported Cloud connector had a default live third-party broker origin
(`my.paperclip.app`) and accepted persisted connector identities and managed
key material. A copied product must not send an instance enrollment request,
account authorization request, or sealed account credential to that inherited
upstream service, even after other branding is changed.

## Protection

- Cloud connector configuration returns **unavailable** by default. A
  Bostan-specific broker is admitted only when both
  `BOSTAN_CLOUD_CONNECTOR_ENABLED=1` and
  `BOSTAN_CLOUD_CONNECTOR_BASE_URL=https://<operator-owned-host>` are set.
- Deny hostnames at `paperclip.app`, `paperclip.ing`, and all their subdomains,
  localhost, raw loopback and insecure HTTP, credentials embedded in URLs,
  query/fragment values, and nonstandard ports. Only an exact HTTPS origin
  is accepted; no guessed Bostan public domain is used.
- Existing upstream managed instance credentials are **not reused**, even
  if a Bostan URL has been supplied. The imported local identity file is
  not deleted or modified; a saved identity with a different broker origin
  cannot be silently rebound to a Bostan service.
- The self-hosted enrollment status, start and completion handlers require
  the same explicit private broker policy. Unconfigured status returns
  `not_configured` without an inherited URL or instance ID. Enrollment
  refuses to proceed **before any outbound request** if the Bostan policy
  is not satisfied.
- Cloud enrollment and actual signed connector HTTP POSTs set
  `redirect: "error"` to prevent forwarding signed payloads to another
  origin through a redirect. User-facing new enrollment label is Bostan.
- Internal compatibility tokens, file format and scoped connector protocol
  are retained; this does not assert they have been fully migrated.

## Local verification — Mac, October 24, 2026

- Native Vitest on private synthetic hosts: **79 passed / 0 failed** across
  policy checks, enrollment lifecycle, sealed connector transport and
  capability tests. New policy cases independently assert the default
  refusal, inherited-key refusal, malformed/legacy-host refusal and **zero
  mocked network calls** when unauthorized. Legacy test fixtures were
  updated to an explicit private synthetic broker without weakening the
  production broker admission policy.
- No real Cloud broker was contacted. All enrollment and connector
  requests were mocked. `git diff --check`: **PASS**.
- Real broker integration, account consent, callback, rotation, rollback,
  persisted private identity migration, cross-platform source/installer QA,
  final branding and full server TypeScript check: **NOT QUALIFIED**.
  The earlier full-server typecheck was blocked by absent generated runner
  declarations, not resolved by this change.
- No release, merge, deployment, publication or paid provider call. GitHub
  Actions remain disabled, repository remains private and `main` unchanged.

**Release remains NO-GO.** Connector must remain disabled in the normal
Bostan install until a separate Bostan-owned service and real integration
acceptance are available.
