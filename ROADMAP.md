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
- [x] B0-35: give macOS/Linux cold source loading a larger finite loopback
  health window (180 probes) and align the opt-in disposable persistence
  harness; 15/15 Node safety tests PASS and real macOS private-local
  PostgreSQL first-run/restart/persistence E2E PASS (exit 0).
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
- [x] B1-06: pending human approvals cannot be unlinked by privileged agents
  to bypass Done; an authenticated board decision is required.
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

- [x] B2-01: real company-scoped, signed decision recommendation route with
  typed alternatives, cited issue-access checks, abstention, declared cost
  ceiling and **no executable effects**; isolated PostgreSQL tests PASS.
- [x] B2-02: read existing human-configured company/agent/project budget
  exposure, abstain when spending/unknown accounting violates hard stops,
  redact board financial details from agent-readable recommendations and bind
  idempotency to a budget snapshot fingerprint. No actual spend authorized.
- [x] B2-03: bind cited evidence identity, source content and version timestamps
  to a private keyed HMAC included in the signed decision and idempotency,
  rejecting reuse of stale recommendations without exposing document text.
- [x] B2-04: real HTTP route and PostgreSQL integration tests for agent-run
  authentication, board/agent separation, tenant isolation and rejection of
  model-authored privileged effects. Browser app acceptance remains open.
- [x] B2-05: a board's positive choice on Bostan advice rechecks exact evidence
  and current scoped board budget HMACs inside the locked decision transaction;
  stale decisions fail closed, while safe defer/dismiss remains possible.
- [x] B2-06: board-only non-executing API to preview whether evidence and budget
  snapshots remain current; scoped HTTP/PG tests and privacy denials PASS.
- [x] B2-07: reuse the existing board DecisionCard/DecisionResolver to display
  freshness, fail-closed positive choices, and recheck server before POST;
  React tests, UI TypeScript and production bundle PASS.
- [ ] Real Chromium end-to-end board review and independent citation
  relevance/readback evaluation remain open.
- [ ] Board-defined actual budget limits, calibrated outcomes, external
  evidence proof/readback, durable model routing, evaluation and UI E2E.

## B3 — Action Fabric

Authorized computer, browser, file, API and connector operations with scoped
permissions, readback, idempotency, durable receipts and unknown-outcome
reconciliation. Never duplicate the existing task/run authority.

- [x] B3-01: board-only, company-scoped read-only action outcome assessment
  built from existing invocation receipts. Never equate success with verified
  external effects or automatically retry unknown-outcome writes.
- [x] B3-02a: actual restricted local-file content readback, bounded and
  no-symlink workspace open, company/issue/invocation scoping and private
  board-only authorization; macOS real-filesystem/SQL tests PASS.
- [x] B3-03: store a private keyed-HMAC, tamper-evident historical file
  readback receipt in existing workspace operations; board-only signed
  integrity GET, company scope, and tampering/SQL/HTTP QA PASS. This still
  does **not** independently attribute a tool's causal effect.
- [x] B3-04: recheck the *current* company-scoped local artifact against the
  exact original private source commitment of a valid signed historical
  receipt; reject forged/mismatched rechecks and issue a distinct fresh
  signed receipt. No claim of tool causality or permission to retry.
- [x] B3-05: fail closed on same-idempotency-key replay of a timed-out,
  failed or cancelled potentially side-effectful Tool Gateway invocation;
  avoid misleading successful replay status, require reconciliation and
  preserve known-safe successful replay. 50/50 real PostgreSQL policy tests
  PASS. Cross-key duplicate reconciliation remains open.
- [ ] B3-02b: external provider/browser effect readback, signed independent
  verifier evidence, unknown-outcome reconciliation and fail-closed retries.
  Local file SHA matching alone must never be treated as full effect proof.
- [ ] Full real computer/browser connector E2E, revocation, recovery and
  effect verification in the B5 founder-to-specialist workflow.

## B4 — Knowledge and Analytics

Scoped retrieval, OCR, evidence provenance, memory and reproducible analytics.
Enforce deletion propagation, tenant boundaries and prompt-injection safety.

- [x] B4-01: reuse canonical task/document links for board-only, company-and-
  issue-authorized source evidence with current revision/HMAC, bounded
  untrusted excerpt and deletion/unlink invalidation. Mac real PostgreSQL
  and HTTP tests 3/3 PASS, including tenant and task-privacy gates.
- [x] B4-02: board-only point-in-time source snapshot freshness API reuses
  the canonical document+issue privacy join and private HMAC, refuses
  stale/missing/inaccessible sources and returns no document body/hash.
  Five cumulative real PostgreSQL/HTTP tests PASS; no decision authority.
- [x] B4-03: bound company-authorized batches of 1–10 distinct citations and
  read all canonical document versions within one repeatable-read, read-only
  PostgreSQL transaction. Fail if any cited source is missing, hidden or
  stale; 7/7 cumulative SQL/HTTP tests PASS.
- [x] B4-04: optionally bind actual current task-document citations to B2's
  signed recommendation and recheck them with row locks inside the final
  existing human-board decision transaction. Changed document fails closed;
  correct source still permits effect-free human choice. 33/33 real SQL
  and service integration tests PASS; factual relevance still unproven.
- [x] B4-05: enforce the *current human reviewer's* canonical task-document
  read condition at positive board decision commit and in its preview, not
  the agent's earlier source access. A newly private document fails even
  with unchanged content/version; 34/34 real SQL/HTTP tests PASS.
- [ ] Extend B4 to general scoped search/OCR, cross-source citation quality,
  provenance through revision conflicts, deletion propagation to external
  caches, injection-resistant agents and reproducible analytics.

## B5 — Autonomous company acceptance

Founder → CEO → specialist → permitted action → independent verifier →
evidence-backed summary. Include retries, duplicate effects, stale approvals,
interruption, recovery, spend and policy failure scenarios.

- [x] B5-01: enforce specialist/verifier agent separation in the canonical
  case handoff request and delayed apply authority, not merely in a prompt.
  Actual Mac PostgreSQL source handoff tests 2/2 and imported schema tests
  29/29 PASS; no external provider was executed.
- [x] B5-02: opt-in case terminal completion requests now require the
  current task's distinct verifier handoff to be actually delivered, not
  merely queued; 3/3 real PostgreSQL handoff tests PASS. Verifier's actual
  signed approval/effect evidence is still open.
- [x] B5-03: opt-in case closure also requires a real canonical successful
  reviewer `heartbeat_runs` record for the same task, agent and company
  finished after delivery; incorrect/older/missing review runs fail closed.
  3/3 real SQL and 14/14 read-only CaseDetail UI tests PASS. Independently
  signed review output and actual model/provider verification remain open.
- [x] B5-04: opt-in case closure also needs a current, trusted-source-only
  `bostan-verification` document whose latest revision was written by the
  distinct reviewer during an actually started-and-succeeded post-delivery
  run. Latest implementer rewrites invalidate review; 3/3 SQL and 14/14
  read-only UI tests PASS. No claim of independent external effect proof.
- [x] B5-05: current verifier-run report is now bounded JSON citing 1–10
  real same-task canonical B4 document HMAC snapshots. Missing, edited or
  unlinked sources invalidate an otherwise accepted report at terminal
  transaction. 3/3 real PostgreSQL and 14/14 CaseDetail UI tests PASS.
- [x] B5-06: a read-only, run/tenant/task/independent-handoff-scoped reviewer
  agent HTTP endpoint now supplies only the canonical source HMAC needed
  for B5-05 reports. Full in-process reviewer GET→report→source-revision
  invalidation→fresh report→inert case closure tests 11/11 real SQL/HTTP
  PASS; actual model fact verification is still unproven.
- [x] B5-07: close the direct Cases POST/upsert/PATCH `approved`/`done`
  bypass for opted-in independent-review cases and make existing case
  review requirements immutable. 2/2 actual PostgreSQL+HTTP tests PASS;
  ordinary cases retain original status transitions.
- [ ] Integrate real authorized agent-run delegation, independent effect
  readback, verifier sign-off and evidence-backed founder summary end-to-end.
  Test duplicate effects, interruption, recovery and budget/consent fences.

## B6 — Distribution readiness (no release without instruction)

Complete branding, onboarding, accessibility, secure default privacy,
portable installers, SBOM/notices, independent E2E and security receipts.
Even after preparation, **do not publish or deploy** until explicitly approved.
