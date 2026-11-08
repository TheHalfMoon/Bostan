# B1-90 — Preserve pre-observed packed child close before deadline registration

Date: 2026-10-31. STRICTLY PRIVATE / ZERO COST / NONPUBLISHING / STACKED DRAFT ONLY.
Exact parent B1-89 Draft #344, head 52b9fd2955c95b514153b6b3b707aa299d406863.

## Reproduced failure

The private Windows packed-import probe installs an owned child lifecycle observer
immediately after spawn, but registers its 36-second diagnostic deadline only
after additional capture listeners. A fast failing child can emit close in
that interval. The lifecycle observer records the close, but the later deadline
helper misses the already-fired event and incorrectly waits for the full
deadline before classifying the child. B1-89 correctly refuses nonzero child
exits but does not avoid the needless wait or misleading bounded outcome.

Actual authorized Mac Node 26 reproduction on unchanged B1-89 code:
RED: already-observed close lost; outcome=bounded_36s scheduled=1.
The synthetic reproduction emits close before deadline registration; it starts
no application, PostgreSQL, browser, or model.

## Bounded repair

- Pass the existing owned observer's closeSeen snapshot into the deadline
  helper, after the observer was attached to the same spawned child.
- If close was already observed, immediately classify child_exited,
  without registering a 36-second timer or a second close listener.
- Reject non-boolean snapshot inputs. Preserve the 36-second maximum,
  child-exit fail-closed admission, ownership guard, SHA256 runtime validation,
  blocked loopback PostgreSQL stub, privacy capture and fixture cleanup.
- The helper's close listener remains the normal path when the observer has
  not yet seen the event; JavaScript's single-threaded synchronous snapshot
  and listener registration do not interleave event-loop close callbacks.

## Objective qualification and limitations

Native authorized Mac Node 26 synthetic tests and static syntax/plan checks
are required on this exact head; report their actual outcomes in the Draft PR.
No native Windows execution is authorized while the connected Windows device
ID differs from the originally authorized ID. This does not fix the underlying
Windows packed static-import hang or qualify real Better Auth/HTTP/Chromium,
shared PostgreSQL concurrent writes, multi-suite no-orphan cleanup, installers,
offline agent, security/privacy, or licensing/NOTICE.

Release NO-GO. Repository remains private. Do not merge main, enable
GitHub Actions, publish, deploy, release, npm pack, use paid services, delete
retained QA fixtures, or stop foreign processes.
