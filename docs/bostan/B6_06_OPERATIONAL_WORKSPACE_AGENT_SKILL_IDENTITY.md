# B6-06 — Operational workspace, agent tool and skill UI identity

**Private source-only development Draft PR. Not deployed, published, released, or merged. No paid services. GitHub Actions remain disabled.**

## Copy-first update

Update end-user English product copy to say **Bostan** in four operational screens without rewriting any runtime APIs, external providers, system IDs, or storage keys:

- Agent Tools: connection verification errors, responsible-person GitHub connection explanation, tool permission approval language.
- Project Workspace: local checkout description, workspace assignment semantics and Services/Jobs JSON guidance.
- Execution Workspace: actual run creation/toast/error copy, provisioning field hint, reused-workspace and port-conflict explanations.
- Agent Skills: stable prompt-bundle description and supported/unsupported adapter guidance.

Do **not** rename the actual legacy `paperclip_runner` adapter ID or its legacy operational skill; this remains a real compatibility marker and is not a fabricated claim that the legacy skill is rebranded or supported by Bostan Runner. Original license and required legal attribution remain untouched.

## Guarding change

Extend `scripts/bostan-agent-interface-brand.test.mjs` with four Bostan-copy fixtures and checks that three operational screens cannot reintroduce the previous product identity. Verify the Agent Skills copy and explicitly preserve the underlying protocol ID and legacy skill context.

The file changes are literal human-visible strings only; they do not alter component structure, state, endpoints, permissions, command execution, or APIs.

## Qualification and limitations

This PR was authored through the connected GitHub API after the authorized Mac's Remote Desktop Commander tool reached its monthly usage limit. Static source and exact-match replacement guards were checked via GitHub fetches, but **local Vitest, TypeScript, Vite production build, actual Mac/Windows browser E2E and Alibaba CLI review were not executed on this branch**. They are required before merging/releasing and must not be inferred from earlier branches. GitHub Actions intentionally remain disabled.

The global application is still not release-ready: free-model two-agent independent reviewer proof, B4 knowledge/OCR analytics, B6 installers, Windows/Chromium qualification and independent security review remain open. **Release NO-GO.**
