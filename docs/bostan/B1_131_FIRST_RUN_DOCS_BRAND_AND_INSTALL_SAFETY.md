# B1-131 — Private docs identity and safe first-run contract

Date: 2026-10-31 Asia/Riyadh. **PRIVATE / DRAFT / UNMERGED / NO PUBLICATION / RELEASE NO-GO**.
Direct parent: B1-130 private Draft PR #387 exact HEAD `289a177e22eb80fe1de90d7d846c1f99115dc3c7`.

## Observed user-facing identity and safety defect

At the exact parent source, `docs/docs.json` identified the active Mintlify documentation site as **Paperclip**, linked the navigation bar and footer to the upstream Paperclip GitHub repository, and listed a donor-branded introduction page. The visible `docs/start/quickstart.md` instructed readers to execute `npx paperclipai onboard --yes` and `npx paperclipai run`. These commands install/start the **different upstream product**, not Bostan. Recommending a non-existent/unqualified Bostan registry installer would also be unsafe: Bostan's own CLI is only a private local-source preview, and releases/publication are explicitly prohibited.

The real repo root `README.md` already states that Bostan is not release-ready and its standard source-development commands have not been qualified. The root/CLI metadata were checked before rewriting instructions; the private `cli/package.json` identifies a `bostan` **preview** but its prepack/release path is disabled.

## Changes saved in the private stacked branch

- `docs/docs.json`: Mintlify site name **Bostan**, both GitHub links now point to `https://github.com/TheHalfMoon/Bostan`, and introduction navigation now points to `start/what-is-bostan`.
- New `docs/start/what-is-bostan.md`: canonical Bostan concept, policy/approval model, and unambiguous **not yet a qualified installable product** statement.
- `docs/start/what-is-paperclip.md`: retain the historical path solely as a compatibility page pointing to the canonical Bostan introduction, not as an active navigation entry. This does NOT remove upstream legally required license or copyright notices.
- `docs/start/quickstart.md`: remove unsafe `npx paperclipai` installation/run examples and unverified 5-minute deployment claims; describe only a source-development preview with Node>=24.11, pinned pnpm, disposable synthetic-only environment and explicit warnings that `pnpm install` can access package registries. **No `npx bostan` release/install instruction.**
- `docs/start/core-concepts.md`: replace donor product name with Bostan in user-facing architecture prose.
- `docs/start/architecture.md`: replace user-facing product references with Bostan. Keep a factual legacy `skills/paperclip/` filesystem compatibility path rather than falsifying real source imports or existing env variables; no unverified `run --watch` command promise.
- `scripts/bostan-private-docs-entry-gate.mjs`: Node-only, zero-dependency, read-only checker for site identity, correct private GitHub links, canonical navigation/page existence, preview-only messaging, unsafe donor/unpublished install **shell examples**, and compatibility route. CLI emits `BOSTAN_DOCS_PREVIEW_GATE=PASS` only after all checks; handles checkout paths with `%` or `#` via `fileURLToPath`.
- `scripts/bostan-private-docs-entry-gate.test.mjs`: **nine authored** Node tests, including actual checkout snapshot and deliberate failures for old brand/link/route, donor and unpublished install commands, absent introduction, legacy route and false positives on warning prose.
- Root `package.json`: exposes zero-cost `npm run check:bostan-docs` and `npm run test:bostan-docs` (scripts run Node only, no install). Do not run install or release as part of verification.

## Verification ACTUALLY performed

Using the connected private GitHub source at the new branch SHA (not copied/hypothesized source), the full `docs/docs.json` JSON was parsed, all five exact checked-in `docs/start/*.md` pages were fetched, and the **actual pure validation implementation extracted from** `scripts/bostan-private-docs-entry-gate.mjs` was evaluated in a side-effect-free V8 isolate.

**Actual outcome:**
- Real GitHub Bostan docs snapshot: **PASS**, zero findings.
- Eight independent negative mutation cases (old site name, old GitHub URL, old navigation route, donor `npx` shell installer, unpublished Bostan `npx` shell installer, missing canonical intro, donor product name in concepts, broken legacy link): **8/8 REFUSED**, fail-closed.
- The **exact eight pure synthetic cases authored in** `scripts/bostan-private-docs-entry-gate.test.mjs` were executed against the actual GitHub validator in V8: **8/8 PASS**.
- Both new Node-only root script aliases parsed from actual checked-in `package.json` and pointed at the expected exact scripts.

**Strict limit:** the ninth Node test, which invokes the disk-reading `auditBostanDocsCheckout` on an authorized actual private repo checkout, was **authored but not executed** in the isolated model environment. The complete `node --test` file was **not run** as a true checked-out source-native test. This wave did **not** qualify Mintlify deployment, compiled Bostan UI, CLI packaging or public site operation. Model environment lacks private full checkout and source-native Node24/TypeScript7/Vitest5/rootless bwrap. No GitHub Actions, release, downloads, paid cloud or customer data used.

## Remaining brand migration inventory — not yet completed

GitHub `git/trees/<head>?recursive=1` returned **12,509 files**, not truncated, including **1,471 filenames/paths containing `paperclip`** (case-insensitive). Of these, 1,346 are under `packages/`, with additional `server/`, `ui/`, `skills/`, `integrations/`, historical internal docs, and other paths. This is a **path inventory, not a claim of 1,471 user-visible product defects**. Many are private history, upstream compatibility APIs, runner package internals, tests or legally required attribution. Each needs individual classification and source-native regression before wholesale renaming. This wave closes only the **top-level documentation identity and unsafe first-run links**, not full Bostan rebranding.

## Release remains NO-GO

Full source-native four-suite Linux sandbox/Vitest5+TypeScript7+genuine rootless bubblewrap is still unrun; cross-platform installed Windows/macOS/Linux app, governed tool effects/consent, repeated real Windows PostgreSQL no-orphan stress issue #234, tenant/privacy/security and third-party licenses/NOTICE/provenance remain outstanding. Preserve upstream legally required notices. The current Bostan GitHub repository and all new work must stay PRIVATE and DRAFT UNMERGED, main unchanged, Actions disabled, no public docs deployment, paid services, customer data, unowned cleanup or npm publication.

**Suggested next source-native checks on an authorized private checkout:** `node scripts/bostan-private-docs-entry-gate.mjs`; `node --test scripts/bostan-private-docs-entry-gate.test.mjs`; existing true Bostan Linux gate once Node>=24.11, TS7, Vitest5 and rootless bwrap are installed. Stop and report any failure; never weaken guards to obtain a green result.
