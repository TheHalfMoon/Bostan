# B6-32 — Windows-safe Runner symlink refusal fixture

Private test portability fix. No product runtime or identity behavior changes.

## Change and evidence

The Pi installation refusal test now creates a directory junction. This still presents a linked directory to the verifier, while avoiding the Developer Mode/elevation requirement of a Windows directory symlink.

On native Windows x64 under an unprivileged user, `pnpm --filter @bostan/runner exec vitest run src/drivers/acpx/pi-installation.test.ts src/drivers/acpx/recovery-identity.test.ts` passed: **49 passed, 1 skipped, 0 failed**. This includes profile v29 identity and v28 recovery refusal coverage.

No application data or provider was used. This is a test portability result, not live Pi provider or signed installer qualification. Release remains NO-GO.
