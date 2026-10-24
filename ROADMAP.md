# Bostan development roadmap

**Private development — not released.** This roadmap tracks Bostan's own
engineering qualification, not the inherited source project's claims.
An imported feature is not Bostan-qualified until its real behavior,
privacy boundaries, and platform support are independently verified.

The [foundation plan](docs/bostan/FOUNDATION_AND_MIGRATION.md) is the
canonical technical decision record. The latest evidence for completed
work is in [Bostan receipts](docs/bostan/).

## B0 — Foundation, source runtime and product identity (in progress)

- [x] Import the authorized complete source snapshot into a private Bostan repository.
- [x] Keep inherited Actions disabled and publication commands blocked.
- [x] Add a separate Bostan local preview CLI and a guarded source-only runtime.
- [x] B0-31 macOS real source-runtime regression: two separate loopback starts,
  synthetic company creation, restart persistence and clean PostgreSQL shutdown.
  This is **not** a Windows or standalone installer qualification.
- [x] Qualify an isolated macOS first-agent smoke and one real Windows task
  using a free-labeled online OpenCode model; this is **not offline inference**.
- [x] Refuse Windows legacy non-UTF8 PostgreSQL data without destroying it.
- [ ] Rerun the complete native Windows first-agent CLI acceptance harness
  against the fixed UTF8 runtime and verify repeated clean termination.
- [ ] Migrate the entire user-visible UI, package metadata, docs, binary,
  installer and runtime identity, preserving mandatory legal notices.
- [ ] Reproducible, minimal-footprint Mac and Windows installation, start,
  stop, upgrade, cold backup, restore, and rollback without a source checkout.
  B0-30 verified **17/17 cold-snapshot Node tests on each platform**;
  this does not qualify an actual standalone installer.
- [ ] Finish B0-26/B0-29 feedback-export qualification: **macOS real
  PostgreSQL persistence (17 PASS), server typecheck (PASS)**; Windows,
  browser/consumer E2E, and cross-platform safety acceptance remain open.
- [ ] Qualify the B0-27 private Cloud broker with an operator-owned service,
  real enrollment/credentials test, migration plan and no upstream requests.
- [ ] Complete dependency, licensing, privacy, and security qualification.

## B1 — Reliable company orchestration

Qualify companies, teams, task ownership, approvals, budgets, scheduling,
company isolation, worker leases, crashes, recovery and trustworthy task
completion. Introduce strong negative-path and concurrent workload tests.

- [x] B1-01: prevent agent self-certified Done while a task has unresolved
  linked human approval; real isolated PostgreSQL integration verified.
- [x] B1-02: deny agent Done for pending, task-scoped governed interaction
  (tool/secret/connection/document), while ordinary questions and unrelated
  AI account logins remain nonblocking; real PostgreSQL integration verified.
- [x] B1-03: transactional approval-link admission serializes with Done on
  a locked task row; bulk links are atomic and cannot cross tenants.
- [x] B1-04: atomic formal board-approval creation in Tool Gateway; no
  orphan pending approvals or links after concurrent Done (real PostgreSQL).
- [x] B1-05: native status committer rechecks fresh human governance under
  the authoritative issue lock before applying Done; real corpus PASS.
- [ ] Stress independent finalization, revocation and effect verification
  through multiple live agents and adverse scheduling.
- [ ] Qualify remaining governed creation paths, actual external-effect
  verification, approval revocation and concurrent lease recovery.
- [ ] Complete independent output/effect verification, concurrency and
  approval creation races, cross-tenant policy, recovery and budget gates.

## B2 — Decision Fabric

Typed, evidence-linked recommendations; calibration, model routing, abstention,
explicit escalation, and bounded cost. No model may authorize its own
privileged effects.

## B3 — Action Fabric

Authorized computer, browser, file, API and connector operations with scoped
permissions, readback, idempotency, durable receipts and unknown-outcome
reconciliation. Never duplicate the existing task/run authority.

## B4 — Knowledge and Analytics

Scoped retrieval, OCR, evidence provenance, memory and reproducible analytics.
Enforce deletion propagation, tenant boundaries and prompt-injection safety.

## B5 — Autonomous company acceptance

Founder → CEO → specialist → permitted action → independent verifier →
evidence-backed summary. Include retries, duplicate effects, stale approvals,
interruption, recovery, spend and policy failure scenarios.

## B6 — Distribution readiness (no release without instruction)

Complete branding, onboarding, accessibility, secure default privacy,
portable installers, SBOM/notices, independent E2E and security receipts.
Even after preparation, **do not publish or deploy** until explicitly approved.
