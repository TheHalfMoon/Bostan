# B5-21 — Isolate OpenCode discovery and qualify real free-model hello in source QA

**PRIVATE DRAFT. No main merge, publishing, deployment, paid resources, GitHub Actions or release.**

## Reproduced root cause of B5-20 failure

The Mac source-only Bostan and PostgreSQL integrated test failed to admit the first opencode_local worker, reporting harness_test_failed even though the same free model answered through an isolated direct OpenCode preflight.

A separate standalone execution of the actual OpenCode testEnvironment adapter reproduced the precise problem: the opencode models metadata command timed out and produced an error-level opencode_models_discovery_failed check, while the *actual hello invocation of opencode/deepseek-v4.1-flash-free succeeded*. The aggregate adapter result was fail solely because the metadata error remained fatal. This is a real integration contract mismatch, not a missing model reply.

Discovery also unconditionally replaced an explicit temporary HOME with os.userInfo().homedir. That normalizes stale runuser HOME for regular processes, but violates the isolation of Bostan's specially marked source-only disposable HOME.

## Bounded copy-first repair

- When BOSTAN_OPENCODE_STANDALONE=1, honor an explicitly supplied absolute HOME during OpenCode catalog operations. Do not select real account config during the temporary source-runtime test. Keep ordinary non-Bostan runuser HOME correction unchanged; reject relative HOME for isolated selection.
- For opencode_local in explicitly flagged local source-only Bostan mode, validate only two exact known allowed free-model IDs by running the **existing actual model hello probe** directly instead of waiting for potentially unavailable metadata catalog. OpenCode CLI, provider resolution, free model access, real successful reply, exit status and authentication are still checked. Do not bypass the catalog in ordinary agents, paid or unknown models, remote execution or general production.
- This does not authorize subscriptions, enable spend, skip permission checks or change any production source contract. The opt-in Bostan live QA script independently refuses all non-allowlisted or paid model IDs.

## Executed evidence — Mac, October 25, 2026

- Prior independent adapter reproduction: metadata opencode models **TIMEOUT**, real free-model hello **PASS**, entire former testEnvironment **FAIL** from stale discovery error.
- Scoped OpenCode adapter models, standalone and testEnvironment unit suites: **33/33 PASS** with no skipped cases. They cover preserved disposable HOME, unchanged ordinary model discovery, allowlisted hello probe admission, and no general model bypass.
- OpenCode adapter TypeScript typecheck: **PASS**.
- Full disposable Bostan live free-model two-worker source evidence read/review test: **FAIL / BLOCKED**, exit 1, before the first agent became ready. Agent lifecycle reported harness_test_failed after the adapter reported an environment check failure; neither agent produced new review evidence. A standalone exact adapter test showed that the original catalog path timed out while the hello step once passed, explaining one false-negative gate. After the scoped catalog bypass, direct hello independently returned opencode_hello_probe_failed twice, including a controlled positional-input experiment. Because that input change did not help, it was reverted rather than landed.
- No actual source review run completed under B5-21. Model/provider reachability and adapter subprocess behavior must be debugged with bounded check codes before any release qualification.
- Earlier B5-20 exact run-provenance guards: **27/27 PASS**; real B5-20 acceptance had FAILED before the agent reached ready. Full native signed-JWT document-HMAC Case closure remains not yet model-qualified.

## Limits

Even a successful real two-worker test is not equivalent to the full canonical Case approval path: B5-16 requires native-runner signed HTTP/JSON source-HMAC documents and governed terminal handoff, and B4, external effects readback/consent, Windows/Chromium, packaging and independent security remain open. Zero reported model cost in a test does not guarantee future free access.

**Release: NO-GO.**
