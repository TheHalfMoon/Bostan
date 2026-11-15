# Windows installer direct-extraction qualification

## Finding

The Windows installed-app job exceeded its unchanged 300-second install limit on the current draft. The failure-only archive measurement completed in 144,629 ms, while the installer also performs a second full file-copy pass from its temporary extraction tree. The declaration-map archive experiment shortened this measurement by about 12 seconds, but did not make the install pass.

## Candidate change

- Use the pinned 7-Zip CLI to extract the exact embedded app archive directly into `$OUTDIR`.
- Run it through a small .NET Framework launcher that owns it in a kill-on-close Windows Job Object and watches the NSIS installer process; killing either owner or installer terminates and awaits the extractor.
- Check the full `resources/runtime` file/link inventory and SHA-256 bytes against the staged build manifest before the installer marks extraction complete.
- Return an error before registration or launch for nonzero archive status or any manifest difference.
- Preserve the existing retry/cancel behavior and the 300-second Windows installer budget.
- Record a fixed native phase receipt so the installed-app qualification proves it executed this path.

## Evidence so far

- Native Windows scratch NSIS fixture: direct extraction succeeds with spaces and deep paths; a truncated archive returns code 2.
- Windows launcher fixture: complete runtime manifest passes; changed hash and unexpected files return code 78.
- Forced launcher termination closes the Job Object and terminates its extraction child before the child can write afterward.
- Compiled NSIS fixture selects the pinned include override, installs the fixture bytes, records `extraction_direct_complete`, returns exit code 2 for the corrupt archive without a success receipt, and kills a deliberately long-running extractor when NSIS itself is terminated.
- Packaging inventory records the 7-Zip notices at their actual embedded `$PLUGINSDIR` member names.
- Targeted launcher test: passed (13.4 s).
- Compiled NSIS success/corrupt-archive/NSIS-owner-termination fixture: passed (61.2 s).
- `npm test --prefix desktop`: 59 passed, 1 skipped, 0 failed (65.1 s), including the NSIS-owner lifecycle fixture.
- First full candidate CI head `750daa05`: Windows installer and archive integrity completed in 143,137 ms with the expected `extraction_direct_complete` receipt; the Windows job then failed because legacy Windows PowerShell could not load its security module from the inherited PowerShell 7 module path. The macOS package mounted, installed, and launched, but the first task API hire returned HTTP 403. Both failures are being investigated; this head is not qualified.
- Follow-up `f90dde90` isolates the pinned Windows PowerShell 5.1 inbox module path for the unsigned-signature check and limits task API failure diagnostics to a validated fixed-format code. Exact-head CI is pending.
- On `f902f2c4`, macOS again installed and launched, then the task API returned 403. The server guard requires a trusted same-origin `Origin` for browser-session mutations; the Playwright `page.request` helper is not a page-originated browser fetch, so it omitted that header. The next local follow-up supplies the exact installed-app origin on mutation requests; syntax and diff checks pass. The `f902f2c4` Windows packaging/installer CI is still running.

## Still required

- Run the exact follow-up candidate on native Windows and qualify the full installed onboarding, process/artifact control, restart persistence, and uninstall journey under the unchanged 300-second limit; diagnose the macOS task API 403.
- Keep the PR Draft if Windows qualification fails.
- Complete the 7-Zip source and license review before any signing or release.

ADR: [0004 direct Windows extraction](../../docs/adr/0004-direct-windows-installation-with-job-contained-7zip.md).
