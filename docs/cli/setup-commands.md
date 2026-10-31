---
title: Bostan setup commands — engineering preview
summary: Setup and diagnostics interfaces require source-native verification
---

**Bostan is not release-qualified.** Do not interpret imported CLI usage examples or upstream registry commands as approved Bostan installation instructions.

## Commands under review

| Interface concept | Intended behavior | Critical qualification |
|-------------------|------------------|------------------------|
| `run` | Start a configured source instance | No unapproved auto-onboarding or external effects |
| `onboard` | Create initial configuration | Disposable synthetic-only state and explicit consent |
| `doctor` | Inspect dependencies and configuration | Read-only checks distinguished from repairs |
| `configure` | Change local server, secrets or storage settings | Correct instance ownership and secret boundaries |
| `env` | Display resolved configuration | Redaction of credentials and sensitive paths |
| `allowed-hostname` | Change accepted hostnames | No unauthorized network exposure |

The actual command names and flags must be matched against checked-in Bostan CLI source and validated by source-native tests before end-user instructions are released. In particular, diagnostic repair flags may modify files and configuration, so do not run them against existing environments without proven ownership and a reviewed rollback procedure.

## Filesystem and environment compatibility

Some source-internal configuration roots still use inherited paths and variable names. Do not rename or delete those files in-place until migration tests and rollback are verified. Never include API keys, personal data or customer workloads in qualification tests.

See the [CLI preview](/cli/overview), [development quickstart](/start/quickstart) and [security-conscious deployment overview](/deploy/overview). **No public or container-based setup is authorized.**
