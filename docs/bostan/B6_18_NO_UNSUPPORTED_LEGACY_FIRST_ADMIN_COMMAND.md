# B6-18 — Do not advertise an unsupported legacy first-admin bootstrap executable

Private Bostan source change. No main merge, deploy, public release, paid service or inherited GitHub Actions.

## Concrete blocker

The first-admin bootstrap waiting screen and its UX lab still presented the literal donor npm command (npx paperclipai auth bootstrap-ceo) as though it were a supported Bostan operation.

The actual shipped private preview binary is bostan (cli/src/bostan-preview.mjs), which deliberately rejects the legacy auth bootstrap-ceo command and other inherited high-risk entrypoints; it cannot safely generate or rotate a first-admin token. The old UI therefore misled operators into running an outside donor package, and its claimed Bostan first-admin command did not actually exist.

## Delivered

- Remove the executable fallback instruction entirely from BootstrapPendingPage and the matching BootstrapSetupUxLab fixture.
- For an active invite, direct operators to current Bostan startup logs for the existing first-admin URL. When no invite exists, direct the user to the instance operator instead of inventing a command.
- State explicitly that private Bostan CLI preview does not support creating or rotating invitations using a CLI bootstrap command. Do not suggest a new unimplemented Bostan auth command.
- Update the high-risk-command CLI isolation test to assert auth bootstrap-ceo is refused without creating files or changing managed state.
- Add React server-rendering checks in invite-present/absent states and a permanent source guard against the donor npm instruction or the old fallback constant.
- Leave real account-claim rules, API authority, first-admin invite issuance, private server logs and all technical protocol identifiers untouched.

## Actual Mac verification — 2026-10-26

- New BootstrapPendingPage React rendering: 2/2 PASS. Neither view suggests the donor npm bootstrap command.
- Native Bostan CLI preview isolation: 5/5 PASS, including refusal of auth bootstrap-ceo with status 2 and no filesystem side effects.
- UI TypeScript typecheck: PASS; actual Vite production build: PASS (pre-existing large chunk warning).
- Broad Bostan Node source regression after the new assertion: 148 PASS, 9 Windows-specific SKIP, 0 FAIL (157 total), exit 0.
- No external npm bootstrap package executed, no model inference, no real administrator token generated and no credentials accessed.

## Boundaries

This removes a false and potentially unsafe first-admin instruction. It does not newly implement a supported invite-generation CLI (which requires its own security design and tests), and is not a general Windows installed Bostan release qualification.

Remaining gates: real free-model first-agent task Done/run-owned receipt, independent real-model reviewer/Case, native installed Windows app/installer, official full server TypeScript/build and independent security. Repo private, Actions disabled, stacked Draft, unmerged. Release NO-GO.
