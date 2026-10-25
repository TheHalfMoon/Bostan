# B6-04 — Bostan identity on local secrets, task and workspace surfaces

**Private Draft PR. No main merge, publishing, deployment, Actions or paid resources.**

## Implemented

Replace inherited end-user text with Bostan on several functional UI paths: AWS and vault secret import conflict/help messages, local secret provider example placeholders, task run stop/continuation controls, workspace operation status/error messages, skill import guidance and unnamed service fallback. This includes text for external-secrets access and task chat control. These are human-facing words only: none of the upstream API, adapter protocols, persisted mode enums, localStorage keys, OAuth/provider identities or legally required attribution were renamed.

Examples such as the AWS KMS alias and project-id placeholders now suggest Bostan, not a previous product. An existing stored provider health prefix/default remains unchanged because it might represent a real configured upstream secret prefix, not just decorative UI.

## Verification

- Four focused Bostan branding/compatibility guard tests PASS, including explicit preservation of legacy protocol and state keys.
- 203/203 real Vitest UI cases PASS over task IssueDetail, external vault import, workspace-access-state and skill-policy-denial.
- UI TypeScript typecheck PASS.
- UI Vite production build PASS. Vite still warns about inherited large chunks; the warning was not ignored or treated as an E2E performance qualification.
- No AI model required; no paid service. No user data changed.

## Not yet qualified

Complete migration of remaining vendor-facing UI/docs text, disconnected old-hosted SaaS integration strings, installable signed Windows and macOS distributions, browser-installed E2E, B4/B5 model-backed independent evidence/Case approval and full security/egress review remain OPEN. Protocol identifiers and attribution are deliberately preserved until migration guarantees compatibility.

**Not release-qualified.**
