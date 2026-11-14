# Measured Windows installation budget

At exact7f93cb56, run43568899387 completed16jobs PASS and Windows desktop FAIL.
The macOS ARM64 installed journey passed installation, signup/admin claim,
onboarding, restart persistence, clean PostgreSQL shutdown and uninstall with
data preserved. It deferred AI setup and does not qualify agent execution.

The Windows installer still exceeded120seconds. Its separate failure-only
diagnostic verified the complete candidate and recognized its embedded runtime
archive. Inventory took611ms; actual full extraction completed in130,542ms.
The payload is2.16GB across76,080entries. That observed extraction cost exceeds
the old installer budget. It supports revising the budget but is not a proven
NSIS lower bound: the extractor, cache state and execution context can differ.

Set a300second bounded functional installation budget and log actual elapsed
installation time on success or failure. Retain every functional assertion,
process ownership check, fatal timeout, onboarding/restart/uninstall/data
preservation requirement, and earlier120second failure receipt. Change no other
operation's deadline. This is an evidence-based budget correction, not an
installation speed improvement or a successful Windows acceptance claim.

Independent correctness/product assessment read the original instruction
against increasing timeouts merely to conceal defects, reviewed the exact
measurement and recommends this bounded revision. A fresh complete Windows
journey must pass. If300seconds fails, diagnose the observed phase rather than
extending again without new evidence. The payload/file-count cost remains a
product performance concern even if functional qualification succeeds.
