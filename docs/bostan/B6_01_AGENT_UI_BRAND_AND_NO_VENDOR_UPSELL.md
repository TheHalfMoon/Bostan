# B6-01 — Bostan first-party agent UI identity and no inherited paid upsell

**Scope:** private source-only development. No merge into main, release, publication, deployment, paid service, or GitHub Actions.

## Problem

Bostan has a copy-first foundation, but multiple ordinary UI surfaces still presented the old product name as the source of permission, cost, agent operations, summaries, and configuration. A trust policy card linked users directly to the source project's paid enterprise offering, which is inappropriate for an unreleased, private Bostan product.

## Changes

- Display **Bostan Runner** in the native runtime adapter registry, settings, agent selection and task composer, onboarding, and transcript status text. The underlying paperclip_runner / paperclip protocol IDs and @paperclipai internal package imports are intentionally unchanged until a compatibility-controlled migration.
- Use **Bostan** for source-controlled built-in agent prompts, Summarizer hints, workspace paths, budget warnings, token issuance explanations, internal tool summaries, local adapter settings, app catalog source label, and example project-search text.
- Remove the inherited external enterprise sales link from the first-party trust policy editor. State that the UI supports one boundary and that approved APIs are required for advanced policy configuration; the actual read-only state remains intact.
- Preserve alphabetical order of the experimental settings cards after the native runner's visible name changed.
- Add source-focused identity and protocol compatibility assertions; update existing UI expectations for actual changed labels.

## Evidence and boundaries

The new source guard at scripts/bostan-agent-interface-brand.test.mjs tests display copy, internal protocol name compatibility, and the absence of an inherited enterprise CTA. Relevant React UI suites also cover native runner selection, settings, configuration, importer, and trust policy boundaries.

This is a targeted B6 identity grain, **not** a claim that all inherited brand copy is gone. In particular, Paperclip Cloud managed-service flows, credential names, URLs, installer/service identities, and internal package namespaces require explicit migration or containment decisions and broader independent testing. The full B4/B5 company journey, Windows browser and installer qualification, whole-server TypeScript, full security review, and consumer readiness are not proven by this change.

**Release remains NO-GO.**

## Mac source qualification — 2026-10-25

- Source identity guard: **3/3 PASS** (Node test runner).
- Nine impacted UI suites: **436/436 PASS**, 0 skipped (Vitest). First run exposed a card-ordering regression; fixed by placing the renamed runner card in alphabetic order. Two updated help-text assertions then passed.
- UI TypeScript: **PASS** (Storybook structure map and tsc -b). The first isolated-worktree attempt lacked links to cached workspace modules; the re-run used existing installed local modules and passed, without external installation.
- UI production bundle: **PASS** (Vite), with preexisting large-chunk size advisories; bundling is not deployment or consumer-installer qualification.
- No changes to branch main; no hosted provider execution.
