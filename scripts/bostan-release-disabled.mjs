// Fail closed even if a contributor invokes inherited root publishing tasks.
process.stderr.write(
  "Bostan: release, registry bootstrap, npm packaging and rollback are disabled until an independently qualified Bostan release flow is approved.\n",
);
process.exitCode = 2;
