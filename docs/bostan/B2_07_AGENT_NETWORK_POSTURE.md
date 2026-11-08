# B2-07 — Agent network posture (design, owner-approved 2026-11-08)

Egress audit (#30) top finding: local agent processes have unrestricted network access by default. Owner decision: **Linux allowlist by default, plus a visible warning wherever it cannot be enforced.**

## Facts that shape the design
- Enforcement is Linux-only. `adapter-utils/src/local-process-sandbox.ts` uses `bwrap` (bubblewrap) network namespaces and a CONNECT-filtering proxy, and throws on other platforms.
- Only `claude-local` and `codex-local` read `networkScope` (execute and ACP paths: 4 call sites). Gemini, Cursor, OpenCode, Pi, Grok, Kimi and Hermes have no network control.
- The Docker image does not install `bubblewrap`, and containers often lack the user namespaces it needs. A hard default would break Docker deployments.

## Design

### 1. Posture resolver (`adapter-utils`)
`resolveAgentNetworkPosture({ config, platform, sandboxAvailable, providerHosts })` returns one of:

| Result | When |
|---|---|
| `{ mode: "enforced", scope: "allowlist", allowlist }` | No explicit scope, Linux, and a working sandbox. The allowlist is the adapter's provider hosts plus the owner's `networkAllowlist` |
| `{ mode: "enforced", scope }` | An explicit `deny` or `allowlist` setting |
| `{ mode: "unrestricted", reason }` | `reason` is one of `explicit_opt_out` (`networkScope: "unrestricted"`), `unsupported_platform`, `sandbox_unavailable` or `adapter_unsupported` |

### 2. Adapters
`claude-local` and `codex-local` use the resolver at all four call sites. An explicit scope that cannot be enforced stays fail-closed, as it is today: the run errors rather than running unrestricted.

### 3. Provider host defaults
These are **UNVERIFIED** against live accounts, so they must be editable and documented:

| Adapter | Hosts |
|---|---|
| Claude | `api.anthropic.com` |
| Codex | `api.openai.com`, `chatgpt.com`, `auth.openai.com` |

Owners extend them via `networkAllowlist` (git hosts, package registries).

### 4. Visibility
- The server exposes each agent's resolved posture in agent detail and environment checks.
- The UI shows a persistent "Network access is unrestricted on this host (<reason>)" warning in agent settings. The owner must acknowledge it once per agent; the acknowledgement is stored and audited.

### 5. Out of scope here
Windows enforcement (WFP / AppContainer) is a separate project.

## Delivery
| PR | Content |
|---|---|
| (a) | Resolver, `"unrestricted"` opt-out value, adapter wiring and tests |
| (b) | Server posture exposure and UI warning with acknowledgement |
| (c) | Docs and Docker notes |
