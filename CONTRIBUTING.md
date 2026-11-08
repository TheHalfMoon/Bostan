# Contributing to Bostan (private development)

Bostan is a private, unreleased autonomous-company orchestration project.
Only authorized collaborators may submit changes. This repository is not a
public contribution channel, and no public release or deployment is approved.

## Before changing code

1. Search the [Bostan issues and draft PRs](https://github.com/TheHalfMoon/Bostan/issues)
   to avoid duplicating work, especially stacked Draft PRs.
2. Read the [foundation and migration plan](docs/bostan/FOUNDATION_AND_MIGRATION.md)
   and distinguish implemented behavior from proposed Bostan fabrics.
3. Preserve source and third-party license obligations. Rebrand user-facing
   entry points without blindly renaming persistent IDs, migrations, package
   namespaces, or compatibility contracts.
4. Keep tests isolated from personal profiles and real user data. No paid
   model, nonlocal network exposure, third-party account access, or side
   effects without explicit authorization.

## Changes and review

Work on a branch and open a **Draft PR** stacked on the correct development
parent. Do not merge into `main`, enable inherited GitHub Actions, publish,
release, or deploy without a separate approval. Provide the exact commit,
platform, test commands, results, skipped tests, and outstanding risks.

At a minimum, run relevant focused tests and `git diff --check`. Run build,
typecheck and integration tests when dependencies and resources permit. Mark
every unrun gate as **not qualified** rather than inferring success.

Review privacy boundaries, company isolation, authorization, budgets,
secrets, persistence, error handling, rollback, and license notices for
affected components. Treat model output and agent task completion as
untrusted until independently verified.

## Bug and security reports

For normal bugs, use Bostan's repository issue templates with synthetic,
redacted evidence. For vulnerabilities, follow [SECURITY.md](SECURITY.md)
and use a private advisory or owner contact; never post exploit details
in an issue.
