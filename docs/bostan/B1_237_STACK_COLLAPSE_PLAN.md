# B1-237 — Plan: collapse the draft stack into `main`

Status: **PLAN, approved for planning by the owner on 2026-11-08.** Nothing here has been executed. Steps marked **OWNER** need an explicit go-ahead at that moment. Release status stays **NO-GO / publication hold** throughout. Merging to `main` is not publication.

## 0. Facts this plan rests on (measured 2026-11-08)

- **Stack:** one linear chain of 465 drafts, #15 to #493.
  - It has no merge commits and is 0 commits behind `main`. The tip is 1,259 commits ahead.
  - No added file is larger than 1 MB.
- **Secret scan:** a regex scan of the full diff found only synthetic fixtures (`postgres://synthetic:temporary@…`, `sk-…-never-display`, and similar). It found no real tokens, keys or private-key blocks.
- **Commit author emails:** `alshehriofficial@gmail.com` (827), `azialshehri@gmail.com` (383), and noreply addresses (49). This is fine privately; it is a scrub item before any future publication.
- **Plan limits:** the account is on GitHub Free, so a private repo has **no branch protection and no rulesets** (API returns 403). `main` stays unprotected, so the order of operations below is the only safeguard.
- **Actions:** disabled. The default `GITHUB_TOKEN` permission is `read`, but workflows that declare `permissions:` still get those scopes.
- **What enabling Actions would trigger today:** the inherited workflows on `main` (verified file by file, same names at the tip) include:
  - `schedule` triggers: `release.yml` (nightly), `runner-chaos-evals`, `runner-full-stack-e2e`, `runner-live-evals` and `runner-protocol-live-evals`.
  - Declared write scopes (`packages`, `contents` or `id-token`), 10 files: `release`, `docker`, `docker-runner-check`, `agent-runtime-images`, `cloud-migrator-artifacts`, `refresh-lockfile`, `runner-full-stack-e2e`, `runner-protocol-live-evals`, `storybook-deploy` and `storybook-visual`.
  - `pull_request_target`: `commitperclip-review`.
  - References to upstream `paperclipai/...` reusable workflows or images: 18 files on `main`, 16 at the tip.

  **Enabling Actions before these are removed from `main` could publish GHCR images or releases.** That is forbidden under the hold.
- **This PC:** 15.7 GB RAM, about 3.5 GB free during this work. The native `tsc` (typescript-go 7.0.2) ran out of memory on `server` and `ui`.

## 1. Strategy

Make **one integration PR**: head is the stack tip plus the quarantine, base is `main`.

- **Merge as a merge commit** (`--merge`, not squash or rebase).
  - The 1,259 commits keep their SHAs, and the existing `docs/bostan/*` receipts cite them.
  - Rollback is a single `git revert -m 1 <merge>`.
- Afterwards, close the superseded drafts with a pointer to the merge. Closing is reversible.

**Rejected alternatives:**
- **Merging 465 PRs one by one:** about 465 manual merges with base retargeting.
- **Squash:** breaks every cited SHA.
- **Rebasing onto `main`:** rewrites SHAs for no benefit.

## 2. Steps

### Step 1 — Quarantine the workflows on `main` first (small PR to `main`)

Branch `work/b1-237-workflow-quarantine` from `main`:

1. Delete all 23 inherited workflows in `.github/workflows/`, then add a single `bostan-ci.yml`:
   - Triggers: `pull_request` (base `main`) and `push` (`main`) only. No `schedule`, no `pull_request_target`, no `workflow_run`.
   - `permissions: contents: read` at the top level. No secrets, no `uses:` of any `paperclipai/*` ref, and every action pinned by full SHA.
   - Job `linux` (`ubuntu-latest`): `pnpm install --frozen-lockfile`, then `pnpm -r --workspace-concurrency=1 typecheck`, then unit tests.
   - Job `windows` (`windows-latest`): `pnpm install --frozen-lockfile`, then the targeted Windows suites. It counts 2× against the free 2,000 private minutes per month, so keep it scoped.
2. Add `scripts/bostan-workflow-quarantine-gate.mjs` with a `node --test` suite. It fails if any workflow has any of:
   - a `schedule`, `pull_request_target` or `workflow_run` trigger;
   - a `write` scope;
   - `secrets.`;
   - a `paperclipai/` reference;
   - a `docker push` or `gh release`/`npm publish` step.

   The CI job runs it first.
3. Keep `.github/dependabot.yml`. Dependabot runs outside Actions minutes.

**OWNER:** review this small diff (no CI exists yet) and approve the merge to `main`.

### Step 2 — Enable Actions (OWNER, repo setting)

- Only after Step 1 is on `main`.
- Keep the default workflow permissions at `read`.
- Verify: `gh api repos/TheHalfMoon/Bostan/actions/workflows` lists only `bostan-ci` and Dependabot.

### Step 3 — Build the integration branch

1. `work/b1-integration` = tip of #493, plus `git merge origin/main`, which brings in the quarantine.
2. Conflicts are expected only in `.github/workflows/*`, because the stack edited the same files. Resolve every one by **taking the deletion**.
3. Rerun the quarantine gate locally.
4. Open draft PR "Integrate B0–B1 stack into main", base `main`. The body lists the exact head SHA, the evidence table, and the superseded PR range.

### Step 4 — Qualify the exact head SHA

Each item below is required. Record results in the PR, and list every failure explicitly.

| Gate | Where | Pass condition |
|---|---|---|
| Quarantine gate | Linux CI and local | 0 violations |
| `pnpm install --frozen-lockfile` | Linux CI, Windows CI, owner PC | exit 0 |
| `pnpm -r --workspace-concurrency=1 typecheck` | Linux CI and owner PC (≥ 8 GB free: stop WSL/Docker and browsers first) | 0 TS errors, including `server` and `ui` |
| Unit tests (`pnpm test:run:general`, then `:serialized`) | Linux CI; owner PC for Windows-specific suites | No unexplained failures. Each known failure gets an issue and is either skipped with a reason or fixed |
| Plugin SDK link and sandbox suites | Windows CI and owner PC | Pass (already green locally in #493) |
| Secret scan (`gitleaks detect` over `main..HEAD`) | Owner PC (download pinned release; verify checksum) | 0 real findings |
| Workflow inventory | API after Step 2 | Only `bostan-ci` and Dependabot |

**Non-goals for this gate**, tracked after integration:
- the full product acceptance from #234 and #237: Windows forced-crash PostgreSQL orphans, and authenticated Chromium;
- macOS;
- desktop packaging.

The integration gate proves that the code builds, typechecks and passes unit tests. It does not prove the product is complete.

If `server` or `ui` typecheck still runs out of memory on the 7 GB private Linux runner:
- set `NODE_OPTIONS=--max-old-space-size=6144`, or
- run that package with the JS `typescript` compiler pinned in `server/package.json`.

Record which one was used. Do not skip the package.

### Step 5 — Merge (OWNER)

```bash
gh pr merge <N> -R TheHalfMoon/Bostan --merge --match-head-commit <qualified SHA>
```

- `--match-head-commit` refuses the merge if the head moved after qualification.
- Do not create tags. Tags would have triggered the deleted `docker.yml`, and they remain off-limits under the hold.

### Step 6 — Clean up (reversible)

1. Close #15 to #493 with the comment: `Integrated into main by <merge SHA> via #<N>; closed as superseded.`
   - Do **not** delete branches. They are provenance, and `delete_branch_on_merge` is already false.
   - Run this as a script with a dry-run listing first. Its pass condition: the open B-series count is 0, and the 23 Dependabot PRs are untouched.
2. Dependabot #1 to #27: comment `@dependabot rebase` on each one that applies cleanly. Close the ones whose files the stack replaced, and let Dependabot reopen them against the new `main`.
3. Issues:
   - Close #430 and #431 as fixed by the stack, citing the merge SHA.
   - Post status updates on #4, #21, #30, #34, #35, #234 and #237.
4. Delete the local recon clone and logs on the owner's PC.

### Step 7 — Working rules after the collapse

1. Every PR targets `main`, is small (aim for under 400 changed lines), and merges when CI is green and the owner approves. Never stack more than two PRs deep.
2. A PR may claim a platform only if a recorded CI or local run on that platform exists.
3. A QA-harness change needs a product defect or acceptance gate it unblocks. Harness-only hardening without a linked gate is deferred.
4. Next product work, in order:
   1. #237: authenticated server plus Chromium on Windows.
   2. #234: Windows PostgreSQL orphan cleanup.
   3. A visible-copy rebrand audit by route, with screenshots (#35).
   4. Agent and task end-to-end flow, plus restart and recovery.
   5. Desktop packaging (#34), private artifacts only.

## 3. Rollback

- **Before Step 5:** nothing on `main` changes except the quarantine. Revert that PR if needed.
- **After Step 5:** open a PR with `git revert -m 1 <merge SHA>`, then reopen any drafts that are still needed. Closed PRs and their branches remain intact.

## 4. Owner decisions needed (in order)

1. Approve the Step 1 quarantine PR into `main`.
2. Enable Actions after Step 1 lands.
3. Approve the Step 5 merge of the qualified SHA.
4. Approve the bulk close in Step 6.

The agent may do everything else (branches, PRs, local qualification, scripts) without further approval.
