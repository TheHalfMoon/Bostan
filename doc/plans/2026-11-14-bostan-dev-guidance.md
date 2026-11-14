# Bostan developer command and diagnostic identity

The source CLI owns command help; the dev runner and build helper own startup
guidance and diagnostics. This slice finishes their visible Bostan names and
replaces broken worktree recovery suggestions with the installed repository-local
tsx CLI invocation. It changes no environment keys, stored service identifiers,
backup filenames, home paths, bind decisions or publication restrictions.

Five production ASTs were compared after removing string/template text: identical
structure. Actual local CLI worktree help succeeds and exposes init/ensure-seeded;
the root restricted preview checks pass6/6. The build helper already produces
@bostan package names; three stale assertions now expect those actual names.

Local Windows evidence is deliberately incomplete: dev-runner suites31PASS/4FAIL
(two POSIX path expectations and two simulated macOS native-binary fixtures),
and build-helper10PASS/2FAIL (POSIX SIGTERM code expectations on Windows).
The failures remain intact. The helper suite is now explicitly run in the existing
Linux typecheck CI lane so its full12cases receive native Linux evidence. Existing
workflow permissions, action pins and admission/quarantine requirements survive.

Independent production-diff and final workflow-delta correctness/parsimony/product
reviews passed;26workflow/root-command checks and quarantine gate passed. Exact-head
hosted CI remains necessary before merging.
No broad local compiler run was attempted on this memory-constrained machine.
This closes visible developer guidance only; product completion and desktop native
qualification remain separate work.
