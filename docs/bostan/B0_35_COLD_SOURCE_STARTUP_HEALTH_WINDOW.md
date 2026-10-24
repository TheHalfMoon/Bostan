# B0-35 — Bound, but do not prematurely kill, a cold Bostan source startup

**Private development, October 24, 2026; no published installer.**

## Real defect observed during B3-02 qualification

The original Mac/Linux Bostan source CLI stopped checking localhost health
after just 90 probes. On a loaded Mac, cold TypeScript module loading and
first database migrations pushed an otherwise healthy private-local startup
beyond that window. The B3-02 full local persistence test therefore exited
before first health, despite its separate, longer outer smoke timeout.
A bounded diagnostic replay using the same **synthetic** private test HOME
did eventually reach HTTP 200 at `/api/health`, then shut down cleanly.
That is evidence of a startup-timing race, not proof of a full new HOME
persistence journey.

## Scoped repair (not a performance claim)

- Preserve system PostgreSQL, private loopback-only host binding, source
  identity, health response requirements, opt-in check, existing safe
  runtime permissions and clean shutdown policy.
- Increase the *finite* macOS/Linux source-loader probe count from 90 to
  180, allowing slower cold source dependency loading to complete before
  classifying startup failed. Disposable Windows QA keeps its existing 360
  probes; Windows installer/runtime release remains not qualified.
- Increase the **outer** explicitly opted-in disposable Mac/Linux
  persistence smoke's health deadline from 115 seconds to 215 seconds;
  it must not kill the source loader while the inner health-probe window is
  still valid. This is only a test safety margin, not a production retry.
- No network exposure, background daemon, secret persistence outside the
  newly created synthetic HOME, updates or package installation.

## Tests

`node --test scripts/bostan-local-runtime.test.mjs scripts/bostan-local-live-persistence-e2e.test.mjs`

**15/15 PASS, zero failures/skips**, including cold-source health bounds,
UTF8 database guard, private source environment, refusal of actual Windows
user HOME, explicit opt-in and no premature filesystem changes.

A new real Mac first-run + PostgreSQL persistence smoke is required to
qualify the increased bound. A longer deadline does NOT make the product
fast; imported TSX graph optimization/compact prebuilt runtime and installer
qualification remain separate backlog items. Any live result must be
recorded accurately below.

The repository remains private with Actions disabled; Draft PR only,
main unmodified, no public deploy/release or paid service. **NO-GO**.

## Actual source application result — latest B0-35 head

`BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs`
returned **PASS, exit 0** (October 24, 2026, Mac). Verified private
loopback-only health, a real synthetic company INSERT into freshly created
PostgreSQL, graceful application/DB shutdown, restart with exact persisted
company readback, and second clean shutdown. The disposable successful test
HOME was removed and no background Bostan QA process was retained. Full
latest branch backend TypeScript still remains a separate unqualified gate;
this smoke is not a Windows installed-product or browser-agent acceptance.
