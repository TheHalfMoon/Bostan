# Bostan connector broker

A self-hosted, operator-controlled OAuth broker that lets Bostan instances connect
Google Workspace accounts without each instance holding the OAuth client secret.
It implements the protocol the Bostan server already speaks
(`server/src/services/paperclip-cloud-connector.ts`); nothing is sent to Paperclip
or any other third-party broker.

## How it works

1. **Enrollment.** An instance administrator starts enrollment in Bostan. The
   broker records the instance's Ed25519 signing key and X25519 sealing key and
   shows an approval page. The broker operator approves it with the operator
   token; the instance then proves possession of its signing key to finish.
2. **Authorization.** For each connection, the instance sends a signed session
   request for a fixed profile (for example `gmail.draft`). The user sees a
   broker confirmation page that lists the exact permissions, then Google's
   consent screen (authorization code + PKCE S256).
3. **Claim.** The broker exchanges the code, keeps Google's refresh token
   encrypted, and returns credentials sealed to the instance's key. The
   instance receives Google's short-lived access token and an **opaque broker
   refresh handle**, never Google's refresh token.
4. **Refresh and revoke.** Signed requests carrying the handle obtain new access
   tokens, or destroy the broker's copy of the grant. The broker does not call
   Google's revocation endpoint: it removes the OAuth client's access for the
   whole Google account, which would also disconnect the user's other profiles.
   Users remove the broker's access entirely at myaccount.google.com.

## Security properties

- Every instance request is an Ed25519-signed JWS with exact audience, operation,
  environment, 120-second maximum lifetime and single-use `jti`.
- Grants are bound to (instance, company, subject, profile); another instance,
  company or user cannot use a handle.
- Profiles have fixed scope sets. A broadened request is refused, and a narrowed
  Google consent is discarded and reported as `access_denied`.
- Google refresh tokens, PKCE verifiers, return states and claim payloads are
  stored only as AES-256-GCM ciphertext bound to their record; handles and codes
  are stored as SHA-256 hashes.
- Audit receipts (`audit.jsonl`) hold identifiers and outcomes only, with hashed
  subjects.
- Provider calls have 10-second timeouts; refresh and revoke retry twice on
  network/429/5xx errors; code exchange is never retried.
- Rate limits apply per address (enrollment, operator approval) and per instance
  (sessions, token operations).
- Browser forms require the broker's own `Origin`; pages send a strict CSP,
  `frame-ancestors 'none'` and `no-referrer`.

Decisions about *using* a token (read versus write tools, approvals for
consequential actions, per-agent grants) stay in the Bostan instance's tool
access policy; the broker only issues tokens for the profile that was approved.

## Running

The broker listens on plain HTTP (default `127.0.0.1:8787`) and must sit behind
a TLS reverse proxy on port 443. Instances set
`BOSTAN_CLOUD_CONNECTOR_ENABLED=1` and `BOSTAN_CLOUD_CONNECTOR_BASE_URL` to the
broker's public origin.

| Variable | Purpose |
|---|---|
| `BOSTAN_BROKER_PUBLIC_ORIGIN` | Exact `https://` origin on port 443 |
| `BOSTAN_BROKER_ENVIRONMENT` | `development`, `test`, `staging` or `production` (must match instances) |
| `BOSTAN_BROKER_DATA_DIR` | State (`broker-state.json`) and audit log directory |
| `BOSTAN_BROKER_MASTER_KEY_FILE` | 32 random bytes, base64url (`openssl rand 32 \| basenc --base64url`) |
| `BOSTAN_BROKER_OPERATOR_TOKEN_FILE` | At least 32 characters; approves enrollments |
| `BOSTAN_BROKER_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET_FILE` | Google OAuth web client (optional) |
| `BOSTAN_BROKER_GOOGLE_PROFILES` | Comma-separated profiles to offer (default: all) |
| `BOSTAN_BROKER_ALLOWED_INSTANCE_ORIGINS` | Optional allowlist of instance origins |
| `BOSTAN_BROKER_LISTEN_HOST` / `_PORT` | Listener (default `127.0.0.1:8787`) |
| `BOSTAN_BROKER_TRUST_PROXY` | `1` to rate-limit by the last `X-Forwarded-For` hop (the address your single trusted proxy saw) |

Secret files must be mode `600` on POSIX. Register
`<public origin>/oauth/google/callback` as the Google client's redirect URI.
`node --conditions=bostan-compiled dist/main.js --doctor` validates the
configuration without starting the server.

The store is a single JSON file written atomically; run one broker process per
data directory and back up the data directory together with the master key.

## Not yet supported

- Notion (the instance client has no Notion provider yet).
- Slack, Asana, GitHub apps, webhook bindings and event leases (return 404).
- Qualification against real Google accounts: tests use a fake Google token
  endpoint. A live pass requires an operator-provided Google OAuth client and
  test account.
