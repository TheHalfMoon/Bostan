# B0-27 — Private Bostan Tailscale broker identity and host defaults

2026-10-26, draft source-only wave stacked on B0-26. No installation, Tailscale state modification, systemd action, public package, paid service, network exposure or cloud deployment occurred.

## Implemented

- Private `@bostan/tailscale-https-broker` with a `bostan-tailscale-https-broker` executable, locked release hooks and no published distribution identity. The binary source remains Linux-supported with built-in peer credential enforcement; its Linux native addon is **not** qualified on this Mac.
- Renamed bundled systemd unit to `bostan-tailscale-https-broker.service`, with Bostan-dedicated service account/group, `/etc/bostan` configuration, `/opt/bostan` executable, and `/run`, `/var/lib`, `/var/log` Bostan broker directories. README operator instructions and first-party CLI command use Bostan.
- Updated the broker's actual `loadHostConfig` defaults and server-managed-runtime default socket to `/run/bostan-tailscale-broker/broker.sock`. Server reads `BOSTAN_TAILSCALE_BROKER_SOCKET` first and **continues accepting** the inherited `PAPERCLIP_TAILSCALE_BROKER_SOCKET` as a compatibility fallback. Broker process `BROKER_*` explicit path overrides remain supported for safe preexisting host configuration.
- Preserved the versioned persisted `includePaperclipViteHmr` exposure JSON key until an explicit schema migration. Changed only fixture hostnames and documentation, not the registered Tailscale Serve state.

## Verification

- Mac: native broker package `typecheck` **PASS**, `pnpm install --offline --frozen-lockfile --ignore-scripts` **PASS**.
- Mac: Vitest full broker suite (existing 90 cases and 3 added live-config cases) **93 PASS**; all source fixtures local and no hosted tailnet access.
- Source invariants in `scripts/bostan-private-tailscale-broker-identity.test.mjs` **4 PASS** (private namespace, publish guard, Linux unit/default consistency, compatibility alias and persisted JSON key).
- `git diff --check` PASS. All changes remain on Draft PR stack, no merge/deploy.

## Boundaries and operator follow-up

Old Linux systemd service/account/socket/registry installations do **not** automatically migrate. Before a future Linux release, manually qualify operator migration, registry file ownership and backup/restore, Linux native SO_PEERCRED compilation, server e2e, zero-downtime restarts, root protections and rollback. Windows/macOS installed-app E2E and full server build also remain open. **Release NO-GO.**
