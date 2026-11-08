# B0-57 — Actual Chromium private Bostan invitation & membership UI acceptance

**2026-10-27.** Stacked private Draft above B0-56 PR #205 (`22d4a4b1e6ac19b0418f3f3eff27399d72ed1dfb`). Preserve repo **PRIVATE**, inherited Actions **OFF**, unmerged `main`, no publication/release/deployment, no paid models, and no real-user or customer records. The product-release decision remains **NO-GO**.

## Real gap addressed

B0-56 qualified the production invitation and member update **APIs** with two authenticated Better Auth sessions, but never rendered or clicked the actual Bostan `Organization Members` screen. In particular, it had not proven that the `Invites` tab can create a viewer invitation and that the `Edit member` dialog can actually promote/suspend an invited account while preserving session-based authorization.

## Added opt-in private browser acceptance

A new explicit, fail-closed command extends the existing offline build, relocation, ephemeral PostgreSQL and real authenticated scenario:

```bash
bash scripts/bostan-private-staged-full-app-acceptance.sh --run-relocated-authz-ui
```

The new `--run-deployed-authz-ui` nested smoke path opts the authenticated scenario into Chromium with `BOSTAN_AUTHZ_BROWSER_UI=1`. The previous `--run`, `--run-relocated`, `--run-relocated-authz` and normal Postgres source modes retain their old behavior; **no browser UI path runs by default**. Node and shell admission still require explicitly named modes, an invocation-owned database marker, a literal `127.0.0.1` high port, a separate PostgreSQL database named `bostan_qualification` and `authenticated/private` exposure.

The new `ui/scripts/bostan-private-members-browser.mjs` uses the **actual Better Auth session cookie** of the test admin without printing or persisting it, a disposable company UUID, and the **real company URL prefix** derived from the created company. The helper admits only fixed localhost and valid cookie/prefix/UUID, blocks service workers and **all outgoing browser requests**, and fails on page JavaScript exceptions. Test browser contexts are closed in `finally`, including failures. There is no file screenshot or telemetry upload and no external model call.

In the *actual compiled Bostan production UI* on the moved staging directory, Playwright/Chromium:

1. Signs in via a real previously issued cookie, navigates to `/<company-prefix>/company/settings/members?tab=invites`, selects **Viewer** and **clicks Create invite**. Intercepts the actual POST response in memory, verifies company scope/token, and confirms the returned invite link appears in the real text field.
2. A **third separately authenticated user**, synthetic and with a `.invalid` address, accepts that browser-created human invite over the actual API, then receives **403** when attempting to create an issue as a viewer.
3. Using the already signed-in admin Chromium context, opens the actual **Edit member** dialog on the third user's row, selects **Operator** and **clicks Save member**. Verifies a successful real member PATCH and that the third user's unchanged session can now POST a company task (201).
4. Reopens the actual member dialog, selects **Suspended** and saves via real PATCH. The third user's **unchanged** session now receives **403** both on company detail and issue creation.

This is a live browser/API integration, **not** a mocked component or a manufactured DOM. The scenario's receipt is versioned separately for this opt-in three-session execution (`bostan.three-session-chromium-members.v1`); the original two-session authz mode keeps its schema and scope. The receipt's `requests` count reflects the explicit API scenario; browser-initiated UI requests are exercised but **not counted in that field**.

## Proven results on authorized Mac arm64

Ran the full `--run-relocated-authz-ui` with frozen offline dependencies, compiled and relocated production Bostan server+UI, actual PostgreSQL migrations and Better Auth. **Exit 0, twice** (an initial successful execution and final exact-source retake after updating a product-facing identity string).

Final evidence:

- `sessionUsers=3`, `requests=46` from explicit authz/API requests, plus additional verified Chromium UI HTTP requests.
- `browserUi.realChromiumInviteCreated=1`, `inviteAcceptedByThirdSession=1`, `viewerTaskWriteDenied=1`, `uiPromotionEnablesWrite=1`, `uiSuspensionDenials=2`, `memberUiUpdates=2`.
- `browserUi.browserJsErrors=0`, `externalBrowserRequests=0`, `providerCalls=0`.
- All previous B0-55/B0-56 company-crossing denials, foreign-task existence-oracle checks, viewer writes, promotion, revocation and authenticated health remained green.
- Native `BOSTAN_PRIVATE_RELOCATED_MEMBER_BROWSER_ACCEPTANCE_PASS`, `BOSTAN_AUTHENTICATED_TWO_SESSION_TENANT_ISOLATION_PASS`, `BOSTAN_PRIVATE_RELOCATED_TWO_SESSION_AUTHZ_ACCEPTANCE_PASS`, `BOSTAN_PRIVATE_STAGED_FULL_APP_ACCEPTANCE_PASS` and `CLEANUP_COMPLETED exit=0` printed; no leftover stage, synthetic credentials/accounts, server process or PostgreSQL QA data.
- **31/31 Node source and admission tests PASS** and **20/20 React/Vitest component tests PASS** (`InvitesSection` and `CompanyAccess`), zero failures or skips.
- Fixed a visible donor-facing string in the invitation screen: `This URL includes the current Paperclip domain returned by the server.` -> `This link uses the Bostan instance address returned by the server.` Updated its UI assertion to prevent regression. Historical wire IDs and legally required attributions were not rewritten.

The initial two full-run explorations had **test harness** issues only: encoded Better Auth session-cookie format and an unprefixed URL to the actual `/:companyPrefix` React Router route. They were repaired with strict safe parsing and real company-prefix validation, and were **not** counted as successful runs. Final actual three-session Chromium path passed.

## Not qualified yet

Real user onboarding/first-admin claim **via browser**, email invitation sending, every role/per-grant combination, other platform installations and Linux-native Rust/Windows native lifecycle, real free-model task execution reliability, transitive optional provider correctness, independent security/penetration/license review and release qualification remain **OPEN**. This PR must remain **Draft** and **unmerged**; Bostan must not be publicly deployed or released.
