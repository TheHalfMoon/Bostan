# B0-51 — Production dependency closure enforced in private staged Bostan deployments

**2026-10-27.** Stacked private Draft above B0-50 / PR #199 at commit `4b01efd7d77654321da8b6c56a9ff1e90bbfc626`. Repository stays **PRIVATE**; inherited GitHub Actions **DISABLED**; do not merge `main`, publish a release, enable provider inference or use paid models.

## Remaining problem addressed

Earlier stages proved that the compiled server, PostgreSQL and Chromium UI could boot, and B0-50 added the required ACP SDK file to the stage. However stage qualification checked only a short hand-picked list of known assets: losing *another production dependency* could still produce a passing health check until an unrelated code path first accessed the missing module. Peer-dependency warnings also conflated **optional React/Vitest UI/testing peers** with **direct production runtime dependencies**, so warnings alone were not reliable proof of deployability.

## Change

`auditProductionDependencyClosure(stage)` now reads the **actual staged private `@bostan/server` manifest** and validates every package name declared in its `dependencies`. Each must have a readable `node_modules/<name>/package.json` **inside the deployed production stage** whose `name` matches the declaration. Invalid dependency names (including traversal), absent packages, or wrong manifest identities fail the stage. The required `@anthropic-ai/sdk` must be declared and shipped at the **exact locked production version `0.129.0`**, rather than merely passing a filename-exists check. The existing `verifyStage` invokes this check as part of normal private-stage acceptance and reports `productionDependencies`, `productionDependencyClosure`, and `requiredAcpSdkVersion`. The existing independent scan still rejects symlinks escaping the production stage, and SQL/assets checks remain unchanged.

This contract is intentionally scoped to **direct production package declarations and the explicitly pinned ACP SDK**, not arbitrary optional/test peer dependencies or a claim that every transitive provider runtime has been independently executed. It does not install anything or contact remote model services.

## Real evidence on authorized macOS arm64

- Frozen filtered dependencies: `pnpm install --offline --frozen-lockfile --ignore-scripts --filter '@bostan/server...'` **exit 0**, **zero downloads**.
- Actual `pnpm --filter @bostan/server deploy --prod --offline --ignore-scripts` **exit 0** in a temporary private stage. Fixed only the known generated pnpm self-link to point **inside** the deployment via `--repair-owned-self-link`.
- **Real staged production manifest: 72 / 72 direct runtime dependencies present with matching package identities; `@anthropic-ai/sdk` version `0.129.0`; zero failed direct-closure requirements.** The staged root is a genuine ~1.5-GiB pnpm production deployment, not a simulated fixture. For this lightweight dependency audit, *compiled JS/UI assets were not rebuilt*, so `verifyStage` as a whole was **not** claimed to have passed for this particular raw package; the direct dependency closure check was executed independently and passed. Full compiled app / Postgres / Chromium acceptance had already passed on B0-50.
- **14/14 fail-closed Node tests passed**, covering missing direct production modules, forged manifest identity, changed ACP SDK version, invalid dependency names, missing dependencies map, opt-in behavior, link boundaries, protected owned repair, and optional React/Vitest peer declarations that must not falsely fail a server-stage dependency audit.
- `git diff --check` clean. No production inference, paid provider, customer data, public deployment, or `main` merge.

## Still open

The production stage may contain optional and transitive dependencies whose feature-specific runtime has not been independently exercised. The `pnpm deploy` log still warns about optional React/Vitest/Vite peer interactions; the new check does **not** declare these warnings resolved. End-user Windows installer and PostgreSQL/runner life-cycle, real Linux deployment and Rust/native integration, governed real free-model agent benchmarks, full-RAM server type-check, independent security/license review and release packaging remain **UNQUALIFIED**. WSL Ubuntu was briefly probed on the Windows host but stopped immediately after RAM fell below 1 GiB; that lightweight Linux probe **does not qualify** a Linux Bostan runtime. Release remains **NO-GO**.
