# B1-135 — Board chat visible brand and private UI identity gate

PRIVATE, ZERO COST, DRAFT UNMERGED, RELEASE NO-GO. Stacked on B1-134 PR #391 exact HEAD fbaf469b06de4477444bf9a757931a23ccd86aba.

## Verified visible brand defect

The actual Bostan `ui/src/pages/BoardChat.tsx` rendered `/paperclip-thinking.svg` while sending. The actual asset still contained the donor's animated paperclip-shaped stroke artwork. Its source was directly visible in the active chat status line. `ui/README.md` still represented the private UI as a published Paperclip board package. By contrast, `ui/index.html`, `ui/public/site.webmanifest` and the favicon already identified Bostan. Exact GitHub sources were fetched and verified before editing.

## Bounded fix

The BoardChat status icon now references `/bostan-thinking.svg`, a lightweight animated B mark with reduced-motion support. The legacy static URL `/paperclip-thinking.svg` is retained for cached client compatibility, but now serves **identical Bostan content**, not the donor icon. The README explicitly marks the private UI as **not release-qualified / not public npm distributable**. A dependency-free read-only JS gate and eight authored tests pin BoardChat, icon bytes, reduced-motion policy, legacy alias, HTML metadata, PWA manifest and private package disclosure. Root npm scripts: `check:bostan-ui`, `test:bostan-ui`.

## Tests actually executed

Against the exact in-memory patched Bostan source and existing GitHub HTML/manifest, the actual pure brand auditor returned **zero findings**. Seven exact authored fixture callbacks executed in an isolated JavaScript V8 environment: **7/7 PASS**. The eighth filesystem-checkout test is authored but **NOT RUN**; original Node `node --test` on a full private checkout and UI Vitest/build/e2e are **NOT RUN**. Do not imply source-native UI qualification. No app packaging, deployment, paid providers, real data, main merge or legal attribution deletion.

## Release blockers

Further user-facing donor branding and internal compatibility paths remain to classify. Cross-platform installed UI, service worker, agent consent/effects, privacy/security, third-party provenance/NOTICE, Linux sandbox Vitest5/TS7/rootless bwrap, and Windows embedded PostgreSQL stress (#234) still unqualified. RELEASE NO-GO.
