# B2-02 — Default network egress audit, source review (2026-11-08)

Scope: issue #30. Method: source review of `main` at `d081a2f5`. No server was started and no traffic was captured, so this does **not** meet #30's capture criteria. The deny-by-default capture run remains open (see "Remaining").

## Summary
| Area | Finding |
|---|---|
| Default-on telemetry, announcements, donor cloud broker, feedback export | **None found.** Each requires explicit `BOSTAN_*` opt-in |
| Automatic outbound paths | Remote images in the browser, scheduled health and GitHub probes for user-configured connections, and Sentry/OpenTelemetry enabled by generic env vars |
| Agent network access | Unrestricted by default |

## Listeners
| Listener | Bind and defaults | Evidence |
|---|---|---|
| Main HTTP and WebSocket server | `127.0.0.1:3100` by default (`server/src/config.ts:214,381`, served from `index.ts:1059`). Default mode `local_trusted` requires a loopback bind (`config-file.ts:56`, `network-bind.ts:45`). Live events, terminal, runner and plugin WebSockets share it | `http/server.ts:29-30`, `index.ts:1025-1028` |
| Docker image | `HOST=0.0.0.0`, authenticated/private mode | `Dockerfile:218-229` |
| Embedded PostgreSQL | Port 54329, local bind | `config.ts:394` |
| Helpers on `127.0.0.1` | Sandbox callback bridge, sandbox proxy, GitHub access helper, workspace runtime ports | `sandbox-callback-bridge.ts:2126`, `local-process-sandbox.ts:443`, `native-github-access.ts:95`, `workspace-runtime.ts:337` |
| Tailscale broker | Unix socket only | `tailscale-https-broker/src/socket-server.ts:178` |

Embedded PostgreSQL uses fixed local credentials (`index.ts:581-585`).

## Findings
| Sev | Item | Evidence | Default | Recommended fix |
|---|---|---|---|---|
| High | Agent processes have unrestricted network access. The sandbox network scope is enforced only on Linux, throws on other platforms, and is not applied when no scope is set | `adapter-utils/src/local-process-sandbox.ts:474-479`; `adapters/claude-local/src/server/execute.ts:584-587` | off (no scope) | Default `networkScope: "deny"` plus an allowlist; fail closed or warn visibly on Windows/macOS |
| Med | Markdown renders remote images automatically (tracking beacon or data leak); no app-wide CSP | `ui/src/components/MarkdownBody.tsx:795,1012-1018` | on | Reference mode or a proxy for remote images; CSP `img-src 'self' data:` |
| Med | Apps gallery falls back to third-party logo hosts (`design-system.arcade.dev`, `logos.composio.dev`) | `AppLogo.tsx:43,61-62`, `arcade-app-catalog.json:9`, `aggregator-app-catalog.ts:55` | on | `allowRemoteFallback=false`; bundle the logos |
| Med | Connection health sweep probes configured remote tools at startup and every 15 min | `catalog/health.ts:218-258`, `index.ts:1786,1881` | on once configured | Setting plus a global offline gate, with receipts |
| Med | GitHub event poll and merged-PR sweep run at startup and on each scheduler tick | `index.ts:1463,1510,1831` | on once GitHub is connected | Global offline gate |
| Low | Skill sources auto-update by default | `db/.../company_skill_sources.ts:24`, `skill-source-sync.ts:261` | on per source | Default off (needs a migration) |
| Low | Sentry (server and browser) and OpenTelemetry are enabled by generic `SENTRY_DSN*` / `OTEL_EXPORTER_OTLP_ENDPOINT` with no Bostan consent flag; the browser DSN is served from `/get-session` | `server/src/sentry.ts:68,103`, `routes/auth.ts:57`, `SentryGate.tsx:28-32`, `instrumentation.ts:42` | off unless set | Also require a `BOSTAN_*` opt-in |
| Low | Opening the adapter reinstall dialog makes the browser call `registry.npmjs.org` directly | `AdapterManager.tsx:170,197` | user action | Route through the server |
| Low | CLI `run` always runs doctor, whose LLM check calls the provider with no timeout when a key is set | `cli/src/commands/run.ts:95`, `doctor.ts:110`, `llm-check.ts:23` | on if a key is set | Opt in, with a timeout |
| Low | Donor identifiers: Teams manifest `resource: "https://paperclip.ing"`; exports point bundled skills at `paperclipai/paperclip` | `ChatEndpointSetup.tsx:914`, `company-portability.ts:2651-2655` | not traffic | Rebrand (#35) |
| Low | Feedback-export blocklist covers `*.paperclip.ing` but not `*.paperclip.app` | `feedback-share-client.ts:32` | off | Add it |

### Gated off by policy (informational)
| Path | Gate | Evidence |
|---|---|---|
| Telemetry | `BOSTAN_TELEMETRY_OPT_IN=1` plus config plus endpoint | `shared/src/telemetry/config.ts:84-99` |
| Announcements | `BOSTAN_ANNOUNCEMENTS_ENABLED` plus an HTTPS URL | `announcement-policy.ts:9` |
| Cloud broker | Refuses `*.paperclip.app` / `*.paperclip.ing`; private broker opt-in only | `bostan-cloud-broker-policy.ts` |
| Feedback export | `BOSTAN_FEEDBACK_EXPORT_ENABLED` | `config.ts:185` |

### Secrets at rest
AES-256-GCM (`local-encrypted-provider.ts:216`). The key file sits beside the data with mode `0o600`, which is ineffective on Windows (UNVERIFIED). No OS keychain or DPAPI is used. Where adapter CLI login tokens are stored is UNVERIFIED.

## Offline behaviour (source reading)
- The server starts. Telemetry, Sentry and OpenTelemetry are no-ops. A failed Tailscale lookup is ignored. PostgreSQL is local.
- The scheduled health sweep and GitHub poll fail and log.
- The CLI LLM check warns, but a 401 from a reachable provider blocks `run`.
- The UI shows placeholders for remote logos and images. `ui/index.html` loads no remote fonts or CDNs.

## Remaining for #30
1. Deny-by-default agent network access, with non-Linux handling.
2. CSP and no automatic remote images; bundled logos.
3. One `BOSTAN_OFFLINE` gate for all scheduled outbound jobs, with receipts.
4. A `BOSTAN_*` consent gate for Sentry and OpenTelemetry.
5. Low items above.
6. Packet-capture qualification across first run, idle, login, workspace creation, agent run and upgrade.
