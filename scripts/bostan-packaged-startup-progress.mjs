export function classifyPackagedStartupProgress(evidence, now = Date.now()) {
  if (now - evidence.lastPhaseAt <= 30_000) return "phase_progress_within_30s";
  if (now - evidence.lastProcessActivityAt > 30_000) {
    return "no_observed_phase_or_process_progress_for_30s";
  }
  const activity = [
    ["cpu", evidence.lastCpuActivityAt],
    ["memory", evidence.lastMemoryChangeAt],
    ["process", evidence.lastProcessCountChangeAt],
  ].sort((left, right) => right[1] - left[1])[0]?.[0];
  return activity === "cpu"
    ? "cpu_progress_without_phase_progress"
    : activity === "process"
      ? "process_tree_change_without_phase_progress"
      : "memory_progress_without_phase_progress";
}

export function packagedStartupFailure(evidence) {
  const code = typeof evidence?.firstFailureCode === "string"
    && /^[A-Z0-9_]{1,80}$/.test(evidence.firstFailureCode)
    ? evidence.firstFailureCode
    : null;
  if (!code) return null;
  const issue = typeof evidence.firstFailureIssue === "string"
    && /^POSTGRES_START_[A-Z0-9_]{1,64}$/.test(evidence.firstFailureIssue)
    ? `_${evidence.firstFailureIssue}`
    : "";
  return `packaged_startup_failure_${code}${issue}`;
}
