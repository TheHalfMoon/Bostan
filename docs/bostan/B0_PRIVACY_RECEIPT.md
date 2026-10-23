# B0-04 — Privacy-default gates for telemetry and announcements

Status: development-only implementation. No release and not a comprehensive egress proof.

## Parent

Stacked after B0-03a draft PR #28 at e5a4faf759b9b5f1ff64da4ce3d47e9bb55efc95.
Branch work/b0-privacy-defaults.

## Behavior

- The shared telemetry resolver now defaults OFF for CLI and server even when copied legacy configuration says enabled=true or inherited endpoint variables are present.
- Explicit consent requires ALL of: the BOSTAN_TELEMETRY_OPT_IN=1 environment variable, config.telemetry.enabled=true, and a valid BOSTAN_TELEMETRY_ENDPOINT. Only HTTPS or HTTP loopback is allowed. Credentials in URL are rejected.
- Existing DO_NOT_TRACK and legacy explicit opt-out environment flags plus CI continue to disable telemetry.
- New CLI onboard/configure config defaults store telemetry.enabled=false.
- Server runtime config defaults telemetryEnabled=false, and uses the same resolver to determine actual emission.
- Announcement polling defaults OFF and has no inherited external feed URL. To enable: both BOSTAN_ANNOUNCEMENTS_ENABLED=1 and a valid credential-free HTTPS BOSTAN_ANNOUNCEMENTS_FEED_URL are required.
- The old announcement environment settings cannot enable polling by themselves.

## Tests

- New privacy and existing shared/CLI telemetry: 5 test files, 40 tests passed.
- Server announcement feed unit tests + new announcement-policy tests: 2 test files, 21 tests passed.
- Shared package TypeScript typecheck passed.
- CLI onboard/configure tests: 16 tests passed, while an additional announcement routes integration suite (11 tests) could not initialize embedded PostgreSQL on the Mac; NOT qualified.
- Direct server-wide TypeScript check failed in inherited unbuilt plugin SDK/runner dependencies and resulting unrelated type errors; not a passing gate. No errors reported for the edited announcement policy/config files.
- Git diff whitespace check passed.

## Limitations

This gates only the common telemetry and announcement paths. It does NOT prove complete outbound-network isolation; agents, installed adapters, MCP tools, model providers, UI assets, self-update flows and other background services have not undergone an exhaustive egress audit. Existing setups may have other integrations and opted-in network traffic. The legacy CLI operational entrypoints remain gated by B0-03a.

Never advertise blanket offline/no-egress/privacy qualification from this narrow result. Full sandbox, egress, and runtime identity qualification remains pending.
