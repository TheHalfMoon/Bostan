# B0-45 — Native macOS Rust Runner compilation, 403 unit tests, and real offline harness E2E

**Date:** 2026-10-27. **Qualification source:** private Bostan stacked Draft B0-44 at `55242183108e025eb16203bbf5a4955c5a45d859`. **Host:** authorized macOS arm64, Cargo 1.96.0 and rustc 1.96.0, 8 GiB physical RAM, ~7 GiB free disk at start. The private repository stays unpublished with GitHub Actions disabled and no `main` merge.

## Actually executed — Rust source and targets

Cargo was constrained to offline and locked dependency resolution, single build job, incremental builds off and debug info disabled, with a disposable `CARGO_TARGET_DIR` under `/private/tmp`:

```bash
export CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0
export CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0
export CARGO_TARGET_DIR=/private/tmp/bostan-native-rust-qualification
cargo check --manifest-path packages/paperclip-runner/runner/Cargo.toml --locked -p paperclip-runner-core --lib
cargo check --manifest-path packages/paperclip-runner/runner/Cargo.toml --locked -p paperclip-runner-core --all-targets
cargo test --manifest-path packages/paperclip-runner/runner/Cargo.toml --locked -p paperclip-runner-core --lib -- --test-threads=2
cargo test --manifest-path packages/paperclip-runner/runner/Cargo.toml --locked -p paperclip-runner-core --bin paperclip-runnerd -- --test-threads=2
cargo build --manifest-path packages/paperclip-runner/runner/Cargo.toml --locked -p paperclip-runner-core --bin paperclip-runnerd
cargo build --manifest-path packages/paperclip-runner/runner/Cargo.toml --locked -p paperclip-runner-core --bin fake-harness
```

All six targeted build/check/test commands **exited zero**. **399 Rust library tests passed**, then **4 runnerd native binary tests passed**. Zero failed/ignored. Rust emitted existing nonfatal unused/dead-code warnings; no provider models were called. The built macOS `paperclip-runnerd` was a real ~56 MB executable and the fake harness a real ~2.5 MB executable. The native daemon `--build-metadata` exited zero and advertised the preserved `paperclip-runner/runnerd-build-metadata/v1`, binary contract version 2, PRP `paperclip.runner` versions 1–2, and the expected three transport modes. These versioned protocol identifiers intentionally remain for compatibility; they are not visible Bostan product-brand names.

An unrelated, **full all-platform** `cargo metadata --offline --locked` resolution was not qualified because the local cache lacks `inotify v0.11.5` (a cross-target dependency). The targeted macOS `cargo check`, tests, native binaries and actual E2E **did succeed entirely offline**. This result does not cover cross-compile/link for Windows or Linux.

## Actually executed — two native processes exchanging PRP commands

Using the resulting **compiled binaries**, `paperclip-runnerd` was launched with `--run-id`, `--session-id`, `--runner-id`, `--fake-harness`, `--script`. A native fake-harness child ran the source-owned `happy-path.json` and `error.json` fixtures. The disposable controller sent the full PRP sequence `run.prepare`, `session.open`, `turn.start` over stdin without prematurely closing the controller channel. All model-provider keys and AWS credentials were excluded; no inference, network model provider, paid service, user home or real customer database was used.

- **Happy path:** daemon exit `0`, 19 native PRP events, three accepted command receipts, exactly one `run.terminal`, authoritative `runTerminalState=succeeded` and successful child exit `0`.
- **Error path:** daemon exit `0` (transport completed), 15 native PRP events, three accepted command receipts, exactly one `run.terminal`, authoritative `runTerminalState=failed` and **failing child exit `7` correctly preserved**. A harness failure was never reported as success.

No leftover native child processes or disposable HOME files were retained.

## Reusable bounded qualification command

Added `scripts/bostan-native-runner-offline-acceptance.mjs`, which requires explicit opt-in and absolute local binary paths:

```bash
node scripts/bostan-native-runner-offline-acceptance.mjs --plan
node scripts/bostan-native-runner-offline-acceptance.mjs --run \
  --runnerd /absolute/path/to/paperclip-runnerd \
  --fake-harness /absolute/path/to/fake-harness
```

It is a **real executable process** check, not a grep-based source proof. It verifies the native metadata contract, validates both full JSONL streams (schema, identity, contiguous sequence, three accepted controller commands, exactly one terminal, and authoritative success/failure reconciliation), enforces output/timeout bounds, uses a new temporary `HOME` for each scenario and deletes it, strips all model-provider credentials and rejects unsupported platforms or arguments. It is safe by default: a no-argument invocation only prints a read-only plan. Tests for valid and forged/malformed transcripts, false-success terminal states, nonabsolute binary paths and import side effects: **5/5 PASS**.

**Release NO-GO remains in effect**. This does **not** qualify macOS installed application packaging or daemon service integration, Linux/Windows executable compilation and installed UX, external real-agent model evaluation, or independent security review. No publication, `main` merge, release actions, remote inference, or user-data changes were performed.
