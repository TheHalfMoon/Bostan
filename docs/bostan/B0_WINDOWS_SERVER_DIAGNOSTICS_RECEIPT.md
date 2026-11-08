# B0-16 — Windows first full Bostan server HTTP 200, persisted organization, and crash cleanup

**Status: disposable Windows source-app E2E PASS for local health, organization persistence, and parent-led PostgreSQL cleanup after backend failure. NOT production Windows support. Release NO-GO.**

Parent: B0-15 private Draft PR #43, commit `38192a5c94d564b4d7c3d5b769cbc92630ca77ef`.
Work branch: `work/b0-windows-server-diagnostics`. Authorized device: Windows `Abdulaziz`, Node 24, PostgreSQL 17.11.

## Work included

- A TEMP-only Windows QA run now captures server stdout/stderr to a fresh private local `server-startup-<pid>-<timestamp>.log` instead of losing diagnostic output in the launcher. Log path is recorded in the terminal upon starting the child process.
- If HTTP readiness fails, the launcher reports the local diagnostic file location and actual child exit code. It does **not** mark a failed run healthy or abandon PostgreSQL.
- Existing macOS/Linux startup behavior retains its original 90 probe budget and inherited stdio.
- Windows **explicit opt-in temporary HOME only** receives a separate bounded **240-poll** source cold-start allowance. The number is a finite readiness polling budget, not a claim about guaranteed startup seconds or consumer installation performance.
- Path and budgeting helpers have regression tests.
- Startup logs may include application data or secrets: never upload or publish; QA captures use disposable profiles only. File mode alone is not an NTFS ACL proof.

## Verified on Windows (October 24, 2026)

- Checked out Bostan's private working branch into a new directory inside user TEMP. Installed workspace dependencies from pnpm cache; SDK dependency builds and production Vite UI build passed.
- Downloaded the vendor's PostgreSQL 17.11-4 ZIP and **verified SHA-256** `b9424ee7bc60b52450ff910a3630225df32e633f3cb29c1d126d9299d59aea28` before extracting only 1,563 `pgsql/bin`, `pgsql/lib`, `pgsql/share` entries (~135 MB). The ZIP was deleted after verification/extraction. PostgreSQL was never installed as a system service.
- With `BOSTAN_WINDOWS_TEMP_QA=1`, native PostgreSQL tools in PATH, and an existing disposable TEMP HOME, `bostan app doctor` passed.
- First source startup with 90 probes failed to reach HTTP 200; the running Node backend used CPU and nearly 1 GB RAM but emitted no useful output before the bounded shutdown. PostgreSQL stopped; the runtime lock was cleared.
- After enabling a *Windows TEMP-QA-only* 240-probe limit, the source runtime successfully reported `Bostan local application: http://127.0.0.1:41755`.
- Live `GET /api/health` response: **HTTP 200**, `status=ok`, `deploymentMode=local_trusted`, `deploymentExposure=private`.
- Live `POST /api/companies` created the synthetic organization `Bostan Windows Synthetic E2E 2026-10-24` and `GET /api/companies` confirmed the same UUID and name.
- As an explicit failure-injection test, only the disposable Bostan child server process (not the launcher and not other Windows applications) was terminated after the successful API writes. The parent launcher reported the abnormal child exit, **did not claim clean task success**, invoked a PostgreSQL fast stop and independently verified no `postmaster.pid` and no Bostan `run.lock` remained. `pg_ctl status` exited **3** (stopped).
- Restarted this private PostgreSQL cluster independently on loopback, queried the synthetic organization's exact UUID/name from the `companies` table and received the original persisted value. Stopped the database cleanly again.
- Automated node tests on actual Windows: **17 passed / 0 failed / 6 POSIX-only fixture skips**, with the skips explicitly marked. Same two modules on macOS: **23/23 PASS**. No full native Windows default-agent E2E has been run.

## Qualification limits — NO-GO

- This is a **source checkout** using Node, pnpm, tsx and portable external PostgreSQL. There is no Windows installable consumer desktop app yet.
- Startup may be slow and CPU/memory intensive on Windows when loading TypeScript from source; the 240 probes are QA-only, not a solution to production startup performance.
- **Normal user Ctrl+C shutdown was not qualified on Windows in this round**: a synthetic *backend child crash* was injected and parent-led database cleanup was verified instead.
- Windows filesystem mode does not prove NTFS ACL security; private on-disk secrets, profile containment, DPAPI integration and ACL enforcement remain unqualified for release.
- No Windows native default-agent lifecycle run, no offline model, no full cross-device backup/restore release test, no packaged/signable app, and no complete egress/privacy audit.
- This test should never be run on a non-disposable HOME or with real customer/production data.

**No release, no public deployment, no GitHub Actions enablement, and no merge to main.**
