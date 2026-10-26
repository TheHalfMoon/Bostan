# B0-17 — Bostan owned UI copy, permission messages and docs preview

Private Bostan work, 26 October 2026. Stacked Draft after B0-16 PR #165, not on main. No merge, publication, deployment, paid models, inherited Actions or removal of legally required notices.

## Exact scope of new user-facing product identity

Previous B0-10 chat UI copy and B0-16 native catalog npm packages now carry Bostan identity. This wave migrates seven more UI surfaces without changing stored adapters, protocol enums or third-party service identities:

- Skill source owner badge and manager text: Bostan instead of inherited Paperclip, translating exact inherited Bostan-owned source labels while retaining external author labels. Default catalog author attribution uses Bostan when no actual source package identity exists.
- User permission copy for app tool calls: Waiting for user permission, provider continuation, and no-automatic-retry messages now say Bostan.
- App-permission risk tooltip attributes the local risk decision to Bostan.
- Hosted experimental setting badge now says "Managed by hosting provider" rather than impersonating a nonexistent Bostan Cloud, and avoids advertising donor-owned hosting as product-controlled.
- Built-in native runner compatibility UI now says "legacy bundled operational skill" while keeping persisted core-skill key and adapter enum.
- System notice demonstration uses Bostan name and a real existing `/agents/all` product route, rather than an invented `/BOS/agents` route. Historical synthetic fixture issue IDs remain fixture data, not promised new routes.
- Design guide owner copy, example issue ID, mock repository example and sample URLs use Bostan-safe references. Demo URL values use reserved example or invalid domains, never a real external service.
- The actual user-facing Bostan CLI command, existing migrated catalog imports and private-release gate from B0-16 are unchanged.

## Qualified evidence

- Direct React UI and permission/settings/company skill regression files: **104 PASS, 0 FAIL** (one preexisting React act warning).
- New Bostan-visible-copy guard: **8 PASS, 0 FAIL**, includes explicit safety assertion that persisted compatibility fields remain unchanged.
- Official UI TypeScript check and production Vite build: **PASS** (existing >500kB Vite chunk warning).
- Further exact-head Node source, native Windows, private Chromium/PostgreSQL runtime and canonical Case regression results are appended after execution.

## Important scope limits

This is **not** completion of B0-09 (#35): many other Bostan-owned packages, actual product-visible screens, asset metadata, command names, documentation examples and release paths still carry inherited identities. Built-in protocol names `paperclip_runner`, `paperclip_managed`, sourceBadge=paperclip, and managed cloud enum keys are saved compatibility identifiers; they cannot be removed by mechanical copy replacement without dual-read and rollback. The icon named Paperclip in Lucide is the graphic for a paperclip, not product branding.

Historical copyright, license and NOTICE facts are unchanged. Whole-product branding and final release remain NO-GO.
