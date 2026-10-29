# B1-59 — Linux native prerequisite must be an executable regular file

Date: 2026-10-30. Strictly PRIVATE, ZERO-COST, NONPUBLISHING. Exact stacked parent B1-58 Draft #312 at `957c737e56c2365077e3445c010653d34fecc2b2`.

## Genuine source-backed defect

`findAdmittedLinuxCommand()` canonicalized an allowlisted Linux path and then used `accessSync(candidate, X_OK)`. On POSIX, `X_OK` for a **directory** checks search permission. Therefore an owned directory named `pnpm`, `pg_ctl`, or another prerequisite in an allowed `/opt` or `/home` PATH directory was incorrectly accepted as a native executable. This could falsely satisfy an individual Linux preflight requirement; it is **not** proof that a full Linux build or server would run.

## Minimal fail-closed repair

After resolving the canonical target and validating its root, require `statSync(target).isFile()` before checking execute permission. Keep legitimate executable regular files (including script wrappers) admitted, while refusing directories and missing/non-executable files. No PATH output, command execution, package installation or host mutation by production preflight.

## Actual RED/GREEN evidence

- Source and inherited tests were extracted via `git archive` from exact parent SHA into marker-owned `/private/tmp/bostan-b159-owned.qs2Yqc` on authorized Mac; original B135 checkout remained untouched.
- On native macOS Node 26, an owned `/opt/homebrew/var/bostan-preflight-dir-owned-*` fixture created a searchable directory called `pnpm` and called the **actual** `findAdmittedLinuxCommand('pnpm', fixture)`.
- **RED unmodified B1-58 source + new regression:** 6 PASS / 1 FAIL, actual admission returned `true` for a directory.
- **GREEN patched source + regression:** 7/7 PASS, 0 fail/skip, including refusal for directory and non-executable regular file, acceptance for executable regular file, inherited CLI symlink and resource guards. `node --check` PASS.
- Source Git blob `cb6046f8534efaebab818a3804bf56dccb86ebad`; test Git blob `30e2e056a8ba95822c17d9dbea2e1b8ad4cd6e15` match locally executed bytes.
- Independent Linux Node 22.16 source-equivalent minimal reproduction in marker-owned `/home/oai/share` returned `admitted:true` for a directory before the same predicate change and `admitted:false` afterward. This was a **minimal reproduction**, not the full exact-source Linux regression or native Node24 qualification.
- Owned fixture teardown used an exact marker; no operator files, unrelated processes or running services were modified.

## Still unqualified

Native Linux Node24+ / pnpm / PostgreSQL + full packed server / Better Auth / Chromium, Windows multi-suite PG orphan proof, installers, agent governance, and independent security/privacy/license/NOTICE/provenance remain release gates. Windows RAM was 1.65 GiB and C disk 4.81 GiB at preflight; no Windows heavy tests were attempted. Main remains unchanged, GitHub Actions OFF, no merge, deployment, npm pack, paid model, cloud or customer data. Release **NO-GO**.
