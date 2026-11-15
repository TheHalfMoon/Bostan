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

## Still required

- Run the exact candidate on native Windows and qualify the full installed onboarding, process/artifact control, restart persistence, and uninstall journey under the unchanged 300-second limit.
- Keep the PR Draft if Windows qualification fails.
- Complete the 7-Zip source and license review before any signing or release.

ADR: [0004 direct Windows extraction](../../docs/adr/0004-direct-windows-installation-with-job-contained-7zip.md).
