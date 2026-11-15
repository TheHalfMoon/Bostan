# Windows Git-context preparation in deep retry workspaces

Actual owned source journeys at260ff36 passed artifact upload/readback,
cancellation, timeout and explicit operator reconciliation, then the backend
crashed with an unhandled stdout Socket readENOTCONN during retry preparation.
This reproduced under Node24.19 and Electron45.2.3's embedded Node24.22.2.
A diagnostic execFile wrapper observed the stream's error event and forwarded
it unchanged: the owner was prepareGitHubExecutionEnvironment's local child.
No command arguments, environment, tokens or error messages were collected.

A small actual-Node reproducer isolated the Windows boundary: a100-character
working directory succeeded; a345-character plain working directory produced
anENOENT callback followed by fatal stdoutENOTCONN; the same345-character
directory succeeded with path.toNamespacedPath. Missing commands, a missing
short directory and an empty environment alone did not reproduce the crash.

Normalize only the local child process's Windows cwd, following the existing
agent-directory probe approach. Logical workspace identity, remote execution,
credential policy, bounded output and15-second preparation timeout remain the
same. No exception suppression, replay bypass or timeout increase is involved.
The regression invokes the real Git-context child in a newly owned deep path,
checks managed/no-network context and is explicitly included in native Windows
CI. Local focused actual-child regression passed1/1. The adjacent GitHub launcher
suite on this Windows host produced9 passes,24 failures and1 skip, predominantly
POSIX shell fixtures failingENOENT. Those failures are retained, not converted
to skips or claimed passing. Independent correctness/security reviews found no
blocker in the scoped normalization. Exact-head CI remains required before merge.

Earlier failures remain retained. A diagnostic journey also exposed a separate
new fixture budgeting error: its artifact program permits two sequential10s
requests but originally used a15s total adapter budget. That fixture now uses
30s for artifact/retry and retains15s for cancellation/timeout holds, with
recorded policy assertions. It remains uncommitted and is not product acceptance.

The repaired source journey subsequently recorded a successful actual task Retry
at26b7a8a7. Its helper incorrectly searched the run-list summary for private
lineage fields; the full run detail is the appropriate API. While it waited, a
separate issue_disposition_repair follow-up reached another plain deep cwd in
heartbeat/workspaces.ts and crashed on the same stdoutENOTCONN boundary. Apply
the same Windows cwd normalization to that owner's checkout/base/remote probes.
No workspace eligibility, Git-error classification or remediation is relaxed.

The workspace regression checks that a deep non-repository returns the existing
typed validation failure, and a normal repository still passes. Initial attempts
to create an actual repository at a deep path failed inside this host's Git,
even with core.longpaths and a namespaced cwd; these failed capability probes are
retained. This change prevents a backend crash, not a claim that every installed
Git version supports deep working directories.

The complete focused workspace module suite passed14/14 locally after this
extension, including the real deep rejection/ordinary repository regression.
Independent correctness/security reviews found no blocker in these four cwd
normalizations. Broad local build/typecheck was not repeated on the16GiB shared
host under memory pressure; exact-head hosted checks remain required and pending.

The next assembled source journey reached task closure and found the same
plain-cwd crash in execution-workspaces.ts's existing runGit helper, called by
close-readiness display hydration. Normalize that helper's Windows child cwd as
well, retaining Git's explicit -C argument, errors, warnings and data-retention
decisions. The diagnostic identified this separate stdout socket owner precisely;
the failed journey is retained. Repaired assembled closure/restart proof remains
required, rather than treating the earlier unit suites as coverage of this path.
