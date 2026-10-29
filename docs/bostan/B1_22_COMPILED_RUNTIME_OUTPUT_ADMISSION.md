# B1-22 — compiled runtime output admission before recursive deletion

Date: 2026-10-29. PRIVATE stacked Draft on B1-21 PR #274, exact parent `c8201efb565b927a910c786b03a925eacf9497af`. No main merge, Actions, publish, deploy, package release, paid inference or customer data.

## Production safety gap

`server/scripts/bundle-runtime.mjs` previously called `rm(outdir, { recursive: true, force: true })` directly before esbuild. An incorrect output argument could recursively delete a non-runtime directory, including source or unrelated data. This is a source-level hazardous deletion path; **no destructive baseline reproduction against user/operator files was attempted**.

## Production change

- Before any recursive removal, admit only an absolute output path whose final name is `runtime` or `dist-runtime`, adjacent to the entry's parent directory or its parent.
- Reject a target that contains the source entry, the process working directory, or a volume root, and reject relative paths or unrelated directory names.
- Walk the existing target path with `lstat` and refuse symlinks/junctions, non-directories, and missing ancestors; allow only the final dedicated runtime directory to be absent.
- Preserve the existing runtime bundle generation and externalization behavior after admission. No other cleanup paths or user files are changed.

## Actual executed evidence

The exact GitHub blobs `server/scripts/bundle-runtime-output-admission.mjs` (`8dd76b81032de8889ed6447daf5f5cf97996c87a`) and its test (`8c568fd0d5dbf2e2eda5b8c3131bd64df279ba67`) were copied into marker-owned `D:\\Bostan-B122-temp` on native Windows 11. Their `git hash-object` values matched GitHub. Native Node 24.19.0 `node --check` for both files PASS; `node --test` **3/3 PASS**, 0 failed/skipped, including accepted dedicated outputs, rejected source/volume/unrelated destinations with an untouched sentinel, and a real Windows junction target refused without changing its sentinel. Isolated Linux Node 22.16.0 `node --check` PASS and `node --test` **3/3 PASS**, 0 failed/skipped (dependency-free compatibility only, below Bostan's full Node>=24.11 requirement).

## Limitations and release gates

This is output-path admission, not a full Bostan compiled build or a guarantee against a hostile concurrent filesystem mutation between admission and removal. The integrated esbuild runtime build, Windows 18-stage authenticated HTTP/PG, multi-suite zero-orphan PostgreSQL (#234), Chromium, first free agent, native Mac, installer, and independent security/license/backup/recovery remain UNRUN/NO-GO. Issue #237 remains OPEN. Windows free RAM observed ~2.25-2.33GiB, below preferred >=2.8GiB heavy integration threshold, so no heavy PG/server build was attempted. The B111 checkout was inspected read-only and not modified. Bostan stays PRIVATE and nonpublishing; only a stacked Draft PR is authorized.
