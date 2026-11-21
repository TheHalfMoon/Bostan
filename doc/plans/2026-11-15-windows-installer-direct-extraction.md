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
- On `f902f2c4`, macOS again installed and launched, then the task API returned 403. The server guard requires a trusted same-origin `Origin` for browser-session mutations; the Playwright `page.request` helper is not a page-originated browser fetch, so it omitted that header. Commit `d2bfa95b` supplies the exact installed-app origin on mutation requests.
- Windows job `132943545338` in run `43757118165` reached `Mode Installer` at 20:44 UTC, then the 60-minute job timeout canceled it at 21:17 UTC. The standard-user wrapper buffered child output, so the installer subphase result was unknown. The installer-level 300-second limit was unchanged.
- On exact head `df1c1b61` in run `43763219600`, macOS passed the full installed onboarding/task-control/restart/uninstall journey, including `provider_ready`, artifact verification, cancellation cleanup, timeout cleanup, retry reconciliation, exact retry success, and restart persistence. The same run passed all non-desktop gates and Windows server checks.
- Windows job `132962429060` in run `43763219600` reached `Mode Installer` at 21:40 UTC, then the 60-minute job timeout canceled it at 22:21 UTC. The wrapper still buffered child output on that head; the installer subphase result was unknown.
- Instrumented exact head `2fe6bde1` in run `43769206948` passed macOS, all non-desktop gates, and Windows server checks. Windows installed the payload in 162,000 ms with `budgetMs:300000` and emitted all four NSIS phases (`pre_init`, `multiuser_ready`, `extraction_direct_complete`, `install_complete`). The worker exited code 1 about 420 seconds after start without reaching the deterministic task journey. The diagnostic-only archive extraction completed in 152,643 ms. The exact post-install failure boundary remains unknown. The next follow-up emits fixed receipts around registration, Authenticode, and Electron startup, captures a generic uncaught qualification failure, strictly validates startup receipts, and caps Authenticode at 180 seconds.
- The normal parallel desktop suite hit the compiled NSIS fixture's existing 30-second child-process bound twice on this low-memory workstation (`spawnSync` returned no status); running that fixture alone passed. Serializing test files without changing the fixture timeout passed all 59 runnable tests with 1 existing skip in 115.1 seconds. The desktop `test` script now uses Node's `--test-concurrency=1` to keep this native installer fixture deterministic under contention. A later `npm test` could not run the packaging cases because this worktree no longer had `electron-builder` installed; the sequential full suite evidence is from the direct Node test command before that dependency went missing.

## Still required

- Run the instrumented exact follow-up candidate on native Windows, determine where `Mode Installer` stalls, and qualify the full installed onboarding, process/artifact control, restart persistence, and uninstall journey under the unchanged 300-second limit.
- Keep the PR Draft if Windows qualification fails.
- Complete the 7-Zip source and license review before any signing or release.

ADR: [0004 direct Windows extraction](../../docs/adr/0004-direct-windows-installation-with-job-contained-7zip.md).
