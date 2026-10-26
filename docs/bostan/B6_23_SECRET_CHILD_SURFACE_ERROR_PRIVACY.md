# B6-23 — Do not surface raw secret-subsystem errors in UI

Private Bostan Draft stacked on B5-33 PR #143. No main merge, publishing, deployment, paid model or real provider operation. Attribution and external provider policies unchanged.

## Finding and fix

Secret management child components still reflected upstream and provider error.message strings from personal secret create/rotate/clear, user-secret definition create/delete/load, proposal approve/reject, and AWS import preview/load-more/import failures. The AWS import result rows also put raw server-supplied reason into text and title tooltips. Provider text can contain signed URLs, authorization state, request fragments or credentials.

- Centralize fixed user-facing failure copy under ui/src/pages/secrets/secret-error-messages.ts. Retain explicit success/error state, retry buttons, status badges and contract fields.
- Replace raw exception text at all scoped error display points with this constant.
- Replace raw result row reason text AND its tooltip with deterministic messages based on status; never reflect provider reason.
- Only classify AWS permission from trusted API code/status, and throttling from trusted code/429. Remove permissive substring matching from arbitrary upstream exception messages.
- Preserve required upstream legal attribution and protocol identifiers; this does not change any provider API, credential persistence, runtime budget or OAuth flow.

## Actual verification — macOS, 2026-10-26

- Four focused React/helper suites: 50 PASS, 0 FAIL (includes synthetic signed URL/credential and tooltip leak probes, and existing AWS import paths).
- UI TypeScript project check: PASS.
- Real Vite UI build: PASS, preexisting 500-KiB chunk-size advisory.
- No real AWS credentials or network calls used.

## Related validation in same session

- Canonical governed Case/native JWT/HTTP/PostgreSQL test regression: 21 PASS, 0 FAIL (five files).
- Windows native Bostan Node test suite on Abdulaziz: 154 PASS, 0 FAIL, 6 SKIP.
- A resource-constrained official full-server TypeScript attempt on the 8-GiB Mac was manually terminated as excessive swap pressure, and is NOT a pass; prior native compiler qualification is independent evidence.

## Remaining gates

No complete security audit is claimed. Other UI/provider errors may still need inspection. Resource-qualified official full server typecheck/build, installed Windows application/installer, full independent model-driven governed Case (not just deterministic signed bridge), independent security signoff and final release qualification remain OPEN. No deploy or publish. Release NO-GO.
