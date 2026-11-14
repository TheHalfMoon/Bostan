# Windows installer registration qualification

Candidate ce4f8ef811a4bf86caf24ee2651ff24b3c623e30, run43591860574,
finished with16 passing jobs and1 failing Windows desktop job. macOS installed
onboarding, restart and uninstall passed again. The Windows installer completed
in288861ms, reached install_complete and created Bostan.exe. Its subsequent
registration assertion failed because the qualifier expected the bare display
name Bostan. Pinned electron-builder26.18.0 uses Bostan followed by the version.
This preserves the failure; it does not establish that registration was absent.

Derive the exact stable GUID and versioned display name from the pinned builder
and desktop manifest. The read-only HKCU reader matches the stable key or known
display names, preserving refusal of an existing older installation. After
installation require exactly one matching identity/version, with the quoted
expected uninstaller inside the owned installation. After uninstall require no
matching registration. Registry subprocess output is captured explicitly and
errors disclose only a fixed message. No registry values or installer metadata
are changed, and installation, startup and uninstall budgets remain unchanged.

Local desktop suite:46 passed,1 platform skip. Independent correctness review
found no blocker. Independent security review found implicit stderr forwarding;
explicit piped stdio fixes it. Native CI must qualify the new candidate before
claiming Windows installed-app success. Installation latency remains a product
concern, separate from functional qualification.

Run43620830568 at1f55b4bd reported one generic-api-key finding. Pinned
gitleaks8.30.1 current-script scanning identified the literal synthetic NSIS GUID
override assertion on test line22. Independent review confirmed this value is
only an identity fixture, with no authentication or network use. Generate the
override with randomUUID and compare the returned identity to that variable.
The exact historical commit/file/rule/line fingerprint alone is allowlisted;
the full-history gate remains required. No broad rule or path exclusion is added.
